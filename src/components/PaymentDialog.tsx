import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { useWebLN } from '@/hooks/useWebLN';
import { useToast } from '@/hooks/useToast';
import { Zap, Copy, ExternalLink, Loader2, CheckCircle } from 'lucide-react';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: string;
  amount: number;
  description: string;
  onPaymentSuccess?: (preimage: string) => void;
}

export function PaymentDialog({ 
  open, 
  onOpenChange, 
  invoice, 
  amount, 
  description,
  onPaymentSuccess 
}: PaymentDialogProps) {
  const { isAvailable, isEnabled, isLoading, enable, sendPayment } = useWebLN();
  const { toast } = useToast();
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paying' | 'success' | 'failed'>('pending');
  const [preimage, setPreimage] = useState<string>('');

  const handleWebLNPayment = async () => {
    if (!invoice) return;

    setPaymentStatus('paying');
    
    if (!isEnabled) {
      const enabled = await enable();
      if (!enabled) {
        setPaymentStatus('failed');
        return;
      }
    }

    const result = await sendPayment(invoice);
    if (result) {
      setPaymentStatus('success');
      setPreimage(result.preimage);
      onPaymentSuccess?.(result.preimage);
    } else {
      setPaymentStatus('failed');
    }
  };

  const copyInvoice = () => {
    if (invoice) {
      navigator.clipboard.writeText(invoice);
      toast({
        title: 'Invoice copied',
        description: 'Lightning invoice copied to clipboard',
      });
    }
  };

  const openInWallet = () => {
    if (invoice) {
      window.open(`lightning:${invoice}`, '_blank');
    }
  };

  const formatSats = (sats: number) => {
    return new Intl.NumberFormat().format(sats);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <span>Lightning Payment</span>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Amount */}
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatSats(amount)} sats</div>
                <div className="text-sm text-muted-foreground">
                  ≈ ${((amount / 100000000) * 45000).toFixed(2)} USD
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Status */}
          {paymentStatus === 'success' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Payment Successful!</span>
                </div>
                {preimage && (
                  <div className="mt-2 text-xs text-green-700">
                    <span className="font-medium">Preimage:</span>
                    <div className="font-mono break-all">{preimage}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {paymentStatus === 'failed' && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="text-red-800 font-medium">Payment Failed</div>
                <div className="text-sm text-red-700 mt-1">
                  Please try again or use a different payment method.
                </div>
              </CardContent>
            </Card>
          )}

          {/* WebLN Payment */}
          {isAvailable && paymentStatus !== 'success' && (
            <div className="space-y-2">
              <Button
                onClick={handleWebLNPayment}
                disabled={!invoice || paymentStatus === 'paying' || isLoading}
                className="w-full"
              >
                {paymentStatus === 'paying' || isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Pay with WebLN
                  </>
                )}
              </Button>
              <div className="text-xs text-center text-muted-foreground">
                Pay instantly with your connected Lightning wallet
              </div>
            </div>
          )}

          {/* Manual Payment Options */}
          {invoice && paymentStatus !== 'success' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or pay manually
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={copyInvoice}
                  className="w-full"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Invoice
                </Button>
                
                <Button
                  variant="outline"
                  onClick={openInWallet}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Wallet
                </Button>
              </div>

              {/* Invoice Display */}
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs font-medium mb-2">Lightning Invoice:</div>
                  <div className="text-xs font-mono break-all bg-muted p-2 rounded">
                    {invoice}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* WebLN Not Available */}
          {!isAvailable && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="text-blue-800 font-medium mb-2">
                  Install a Lightning Wallet
                </div>
                <div className="text-sm text-blue-700 mb-3">
                  For instant payments, install a WebLN-compatible wallet:
                </div>
                <div className="space-y-1 text-sm">
                  <a
                    href="https://getalby.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:underline"
                  >
                    • Alby Browser Extension
                  </a>
                  <a
                    href="https://lightningjoule.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:underline"
                  >
                    • Joule Browser Extension
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Close Button */}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {paymentStatus === 'success' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}