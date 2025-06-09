import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSendEncryptedMessage } from '@/hooks/useEncryptedMessages';
import { useWebLN } from '@/hooks/useWebLN';
import { useToast } from '@/hooks/useToast';
import { 
  Zap, 
  Copy, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  FileText
} from 'lucide-react';

interface PaymentRequestData {
  amount: number;
  description: string;
  memo?: string;
  invoice?: string;
}

interface SendPaymentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientPubkey: string;
  recipientName?: string;
  auctionId?: string;
  auctionTitle?: string;
  defaultAmount?: number;
  defaultDescription?: string;
}

export function SendPaymentRequestDialog({
  open,
  onOpenChange,
  recipientPubkey,
  recipientName,
  auctionId,
  auctionTitle,
  defaultAmount = 0,
  defaultDescription = '',
}: SendPaymentRequestDialogProps) {
  const { user } = useCurrentUser();
  const { sendEncryptedMessage, isPending: isSending } = useSendEncryptedMessage();
  const { makeInvoice, isLoading: isGeneratingInvoice } = useWebLN();
  const { toast } = useToast();

  const [paymentData, setPaymentData] = useState<PaymentRequestData>({
    amount: defaultAmount,
    description: defaultDescription || (auctionTitle ? `Payment for auction: ${auctionTitle}` : ''),
    memo: '',
  });

  const [step, setStep] = useState<'form' | 'invoice' | 'sending' | 'sent'>('form');
  const [generatedInvoice, setGeneratedInvoice] = useState<string>('');

  const handleGenerateInvoice = async () => {
    if (!paymentData.amount || paymentData.amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount in satoshis',
        variant: 'destructive',
      });
      return;
    }

    if (!paymentData.description.trim()) {
      toast({
        title: 'Description required',
        description: 'Please provide a description for the payment',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await makeInvoice(
        paymentData.amount,
        paymentData.memo || paymentData.description
      );

      if (result?.paymentRequest) {
        setGeneratedInvoice(result.paymentRequest);
        setPaymentData(prev => ({ ...prev, invoice: result.paymentRequest }));
        setStep('invoice');
      } else {
        toast({
          title: 'Failed to generate invoice',
          description: 'Could not create Lightning invoice. Please check your wallet connection.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Invoice generation error:', error);
      toast({
        title: 'Invoice generation failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleSendPaymentRequest = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to send payment requests',
        variant: 'destructive',
      });
      return;
    }

    if (!user.signer?.nip04?.encrypt) {
      toast({
        title: 'NIP-04 encryption not available',
        description: 'Please use a signer that supports NIP-04 encryption for direct messages',
        variant: 'destructive',
      });
      return;
    }

    if (!generatedInvoice) {
      toast({
        title: 'No invoice generated',
        description: 'Please generate an invoice first',
        variant: 'destructive',
      });
      return;
    }

    setStep('sending');

    try {
      // Create payment request message following the existing format
      const paymentMessage = {
        id: auctionId || `payment_${Date.now()}`,
        type: 1, // Payment request type
        message: paymentData.description,
        payment_options: [
          {
            type: 'ln',
            link: generatedInvoice,
          }
        ],
        paid: false,
        shipped: false,
        amount: paymentData.amount,
        memo: paymentData.memo,
        created_at: Math.floor(Date.now() / 1000),
      };

      await sendEncryptedMessage(recipientPubkey, paymentMessage);
      
      setStep('sent');
      
      toast({
        title: 'Payment request sent',
        description: `Encrypted payment request sent to ${recipientName || 'recipient'}`,
      });

      // Auto-close after 2 seconds
      setTimeout(() => {
        onOpenChange(false);
        // Reset state for next use
        setStep('form');
        setGeneratedInvoice('');
        setPaymentData({
          amount: defaultAmount,
          description: defaultDescription || (auctionTitle ? `Payment for auction: ${auctionTitle}` : ''),
          memo: '',
        });
      }, 2000);

    } catch (error) {
      console.error('Failed to send payment request:', error);
      setStep('invoice');
      toast({
        title: 'Failed to send payment request',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  const copyInvoice = () => {
    if (generatedInvoice) {
      navigator.clipboard.writeText(generatedInvoice);
      toast({
        title: 'Invoice copied',
        description: 'Lightning invoice copied to clipboard',
      });
    }
  };

  const formatSats = (sats: number) => {
    return new Intl.NumberFormat().format(sats);
  };

  const estimateUSD = (sats: number) => {
    // Rough estimate: 1 BTC = $45,000, 1 BTC = 100,000,000 sats
    return ((sats / 100000000) * 45000).toFixed(2);
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <span>Authentication Required</span>
            </DialogTitle>
            <DialogDescription>
              Please log in to send encrypted payment requests via NIP-04
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <span>Send Payment Request</span>
          </DialogTitle>
          <DialogDescription>
            {recipientName ? `Send encrypted payment request to ${recipientName}` : 'Send encrypted payment request via NIP-04'}
            {auctionTitle && (
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  {auctionTitle}
                </Badge>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'form' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (satoshis)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  value={paymentData.amount || ''}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    amount: parseInt(e.target.value) || 0 
                  }))}
                  placeholder="Enter amount in sats"
                />
                {paymentData.amount > 0 && (
                  <div className="text-sm text-muted-foreground">
                    ≈ ${estimateUSD(paymentData.amount)} USD
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={paymentData.description}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    description: e.target.value 
                  }))}
                  placeholder="What is this payment for?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memo">Memo (optional)</Label>
                <Input
                  id="memo"
                  value={paymentData.memo}
                  onChange={(e) => setPaymentData(prev => ({ 
                    ...prev, 
                    memo: e.target.value 
                  }))}
                  placeholder="Additional notes for the invoice"
                />
              </div>

              <Separator />

              <Button
                onClick={handleGenerateInvoice}
                disabled={isGeneratingInvoice || !paymentData.amount || !paymentData.description.trim()}
                className="w-full"
              >
                {isGeneratingInvoice ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Invoice...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Invoice & Continue
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'invoice' && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold">{formatSats(paymentData.amount)} sats</div>
                    <div className="text-sm text-muted-foreground">
                      ≈ ${estimateUSD(paymentData.amount)} USD
                    </div>
                    <div className="text-sm">{paymentData.description}</div>
                    {paymentData.memo && (
                      <div className="text-xs text-muted-foreground italic">
                        {paymentData.memo}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Lightning Invoice</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyInvoice}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs font-mono break-all bg-muted p-2 rounded max-h-20 overflow-y-auto">
                      {generatedInvoice}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('form')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSendPaymentRequest}
                  disabled={isSending}
                  className="flex-1"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Send Request
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'sending' && (
            <Card>
              <CardContent className="p-6 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
                <div className="font-medium">Encrypting and sending payment request...</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Using NIP-04 encryption for secure direct messaging
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'sent' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-4 text-green-600" />
                <div className="font-medium text-green-800">Payment request sent successfully!</div>
                <div className="text-sm text-green-700 mt-1">
                  The recipient will receive an encrypted message with your payment request
                </div>
              </CardContent>
            </Card>
          )}

          {(step === 'form' || step === 'invoice') && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}