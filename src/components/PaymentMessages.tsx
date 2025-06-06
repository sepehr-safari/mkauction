import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEncryptedMessages, useSendEncryptedMessage } from '@/hooks/useEncryptedMessages';

import { PaymentDialog } from '@/components/PaymentDialog';
import { 
  Mail, 
  Zap, 
  Package, 
  ExternalLink, 
  Copy, 
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NostrEvent } from '@nostrify/nostrify';

interface DecryptedMessage {
  id: string;
  type: number;
  message: string;
  payment_options?: Array<{
    type: string;
    link: string;
  }>;
  paid?: boolean;
  shipped?: boolean;
}

interface MessageItem {
  event: NostrEvent;
  decrypted: DecryptedMessage | null;
  isPaymentMessage: boolean;
}

export function PaymentMessages() {
  const { data: messages, isLoading } = useEncryptedMessages();
  const { sendEncryptedMessage } = useSendEncryptedMessage();

  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState('');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Payment Messages</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading messages...</p>
        </CardContent>
      </Card>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Payment Messages</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No payment messages</p>
            <p className="text-sm">Win an auction to receive payment requests here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handlePayInvoice = (invoice: string) => {
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = async (_preimage: string) => {
    if (!selectedMessage?.decrypted) return;

    // Send payment confirmation back to seller
    const confirmationMessage = {
      id: selectedMessage.decrypted.id,
      type: 2,
      message: 'Payment completed successfully',
      paid: true,
      shipped: false,
    };

    await sendEncryptedMessage(selectedMessage.event.pubkey, confirmationMessage);
    setPaymentDialogOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getMessageTypeInfo = (type: number) => {
    switch (type) {
      case 1:
        return {
          title: 'Payment Request',
          icon: <Zap className="h-4 w-4 text-orange-500" />,
          color: 'bg-orange-100 text-orange-800 border-orange-300',
        };
      case 2:
        return {
          title: 'Order Update',
          icon: <Package className="h-4 w-4 text-blue-500" />,
          color: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      default:
        return {
          title: 'Message',
          icon: <Mail className="h-4 w-4 text-gray-500" />,
          color: 'bg-gray-100 text-gray-800 border-gray-300',
        };
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Payment Messages</span>
            <Badge variant="outline">{messages.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {messages.map((message) => {
              const typeInfo = getMessageTypeInfo(message.decrypted?.type || 0);
              const isPaid = message.decrypted?.paid;
              const isShipped = message.decrypted?.shipped;

              return (
                <div
                  key={message.event.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedMessage(message)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {typeInfo.icon}
                      <span className="font-medium">{typeInfo.title}</span>
                      <Badge variant="outline" className={typeInfo.color}>
                        {message.decrypted?.type === 1 ? 'Payment Due' : 'Update'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isPaid && (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Paid
                        </Badge>
                      )}
                      {isShipped && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                          <Package className="h-3 w-3 mr-1" />
                          Shipped
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.event.created_at * 1000), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {message.decrypted?.message}
                  </p>
                  {message.decrypted?.payment_options && message.decrypted.payment_options.length > 0 && !isPaid && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const lightningOption = message.decrypted?.payment_options?.find(
                            (opt) => opt.type === 'ln'
                          );
                          if (lightningOption) {
                            handlePayInvoice(lightningOption.link);
                          }
                        }}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Pay Now
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedMessage && getMessageTypeInfo(selectedMessage.decrypted?.type || 0).title}
            </DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div>
                <p className="text-sm">{selectedMessage.decrypted?.message}</p>
              </div>

              {selectedMessage.decrypted?.payment_options && (
                <div className="space-y-3">
                  <h4 className="font-medium">Payment Options</h4>
                  {selectedMessage.decrypted?.payment_options?.map((option, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{option.type}</span>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(option.link)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {option.type === 'ln' && (
                            <Button
                              size="sm"
                              onClick={() => handlePayInvoice(option.link)}
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              Pay
                            </Button>
                          )}
                          {option.type === 'url' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(option.link, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-mono break-all bg-muted p-2 rounded">
                        {option.link}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {selectedMessage.decrypted?.paid && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Payment Confirmed</span>
                  </div>
                </div>
              )}

              {selectedMessage.decrypted?.shipped && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-blue-800">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Item Shipped</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
        amount={0} // Will be extracted from invoice
        description="Auction Payment"
        onPaymentSuccess={handlePaymentSuccess}
      />
    </>
  );
}