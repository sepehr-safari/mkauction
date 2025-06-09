import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useAuctionCommunications, useAuctionMessageThread, useSendAuctionMessage, AUCTION_MESSAGE_TYPES } from '@/hooks/useAuctionCommunications';
import { SendPaymentRequestDialog } from '@/components/SendPaymentRequestDialog';
import { genUserName } from '@/lib/genUserName';

import { 
  MessageCircle, 
  Send, 
  DollarSign, 
  User, 
  Clock,
  Zap,
  Truck
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NostrEvent } from '@nostrify/nostrify';

interface AuctionCommunicationsProps {
  auctionId?: string;
  auctionTitle?: string;
  className?: string;
}

interface MessageItemProps {
  event: NostrEvent;
  decrypted: {
    type?: number;
    message?: string;
    bid_amount?: number;
    payment_options?: Array<{ type: string; link: string }>;
    tracking_number?: string;
    paid?: boolean;
    shipped?: boolean;
  } | null;
  isFromMe: boolean;
  className?: string;
}

function MessageItem({ event, decrypted, isFromMe, className }: MessageItemProps) {
  const author = useAuthor(event.pubkey);
  const displayName = author.data?.metadata?.name ?? genUserName(event.pubkey);

  const getMessageIcon = (type: number) => {
    switch (type) {
      case AUCTION_MESSAGE_TYPES.PAYMENT_REQUEST:
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case AUCTION_MESSAGE_TYPES.BID_INQUIRY:
        return <Zap className="h-4 w-4 text-blue-500" />;
      case AUCTION_MESSAGE_TYPES.SHIPPING_UPDATE:
        return <Truck className="h-4 w-4 text-purple-500" />;
      default:
        return <MessageCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMessageTypeLabel = (type: number) => {
    switch (type) {
      case AUCTION_MESSAGE_TYPES.PAYMENT_REQUEST:
        return 'Payment Request';
      case AUCTION_MESSAGE_TYPES.BID_INQUIRY:
        return 'Bid Inquiry';
      case AUCTION_MESSAGE_TYPES.SHIPPING_UPDATE:
        return 'Shipping Update';
      default:
        return 'Message';
    }
  };

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} ${className}`}>
      <div className={`max-w-[80%] ${isFromMe ? 'bg-blue-500 text-white' : 'bg-muted'} rounded-lg p-3`}>
        <div className="flex items-center space-x-2 mb-1">
          {getMessageIcon(decrypted?.type || 0)}
          <span className="text-xs font-medium">
            {isFromMe ? 'You' : displayName}
          </span>
          <Badge variant="outline" className="text-xs">
            {getMessageTypeLabel(decrypted?.type || 0)}
          </Badge>
          <span className="text-xs opacity-70">
            {formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}
          </span>
        </div>
        
        <div className="text-sm">
          {decrypted?.message}
        </div>

        {decrypted?.bid_amount && (
          <div className="mt-2 text-xs opacity-80">
            Bid Amount: {new Intl.NumberFormat().format(decrypted.bid_amount)} sats
          </div>
        )}

        {decrypted?.payment_options && decrypted.payment_options.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-xs opacity-80">Payment Options:</div>
            {decrypted.payment_options.map((option, index: number) => (
              <div key={index} className="text-xs bg-black/10 rounded p-1">
                {option.type.toUpperCase()}: {option.link.substring(0, 20)}...
              </div>
            ))}
          </div>
        )}

        {decrypted?.tracking_number && (
          <div className="mt-2 text-xs opacity-80">
            Tracking: {decrypted.tracking_number}
          </div>
        )}

        {decrypted?.paid && (
          <Badge variant="outline" className="mt-2 text-xs bg-green-100 text-green-800">
            Paid
          </Badge>
        )}

        {decrypted?.shipped && (
          <Badge variant="outline" className="mt-2 text-xs bg-blue-100 text-blue-800">
            Shipped
          </Badge>
        )}
      </div>
    </div>
  );
}

interface ThreadType {
  participant: string;
  unreadCount: number;
  lastMessage?: {
    message: string;
  };
}

function ThreadItem({ 
  thread, 
  isSelected, 
  onClick 
}: { 
  thread: ThreadType; 
  isSelected: boolean; 
  onClick: () => void; 
}) {
  const author = useAuthor(thread.participant);
  const displayName = author.data?.metadata?.name ?? genUserName(thread.participant);
  
  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-blue-100 border-blue-300' 
          : 'hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{displayName}</span>
        {thread.unreadCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {thread.unreadCount}
          </Badge>
        )}
      </div>
      {thread.lastMessage && (
        <div className="text-xs text-muted-foreground line-clamp-2">
          {thread.lastMessage.message}
        </div>
      )}
    </div>
  );
}

function ThreadHeader({ 
  selectedThread, 
  onSendPaymentRequest 
}: { 
  selectedThread: string; 
  onSendPaymentRequest: (pubkey: string, name: string) => void; 
}) {
  const author = useAuthor(selectedThread);
  const displayName = author.data?.metadata?.name ?? genUserName(selectedThread);
  
  return (
    <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
      <h3 className="font-medium text-sm">{displayName}</h3>
      <div className="flex space-x-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSendPaymentRequest(selectedThread, displayName)}
        >
          <DollarSign className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AuctionCommunications({ auctionId, auctionTitle, className }: AuctionCommunicationsProps) {
  const { user } = useCurrentUser();
  const { data: communications, isLoading } = useAuctionCommunications(auctionId);
  const { sendAuctionMessage, isPending: isSending } = useSendAuctionMessage();

  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentRecipient, setPaymentRecipient] = useState<{ pubkey: string; name: string } | null>(null);

  const { data: threadMessages } = useAuctionMessageThread(selectedThread || '', auctionId);

  const handleSendMessage = async () => {
    if (!selectedThread || !newMessage.trim() || !auctionId) return;

    try {
      await sendAuctionMessage(selectedThread, {
        id: `general_${auctionId}_${Date.now()}`,
        type: AUCTION_MESSAGE_TYPES.GENERAL,
        message: newMessage.trim(),
        auction_id: auctionId,
        auction_title: auctionTitle,
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleSendPaymentRequest = (recipientPubkey: string, recipientName: string) => {
    setPaymentRecipient({ pubkey: recipientPubkey, name: recipientName });
    setShowPaymentDialog(true);
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Communications</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Please log in to view communications</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Communications</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
            <p>Loading communications...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!communications || communications.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Communications</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No communications yet</p>
            <p className="text-sm">Messages with auction participants will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Communications</span>
            <Badge variant="outline">{communications.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-96">
            {/* Thread List */}
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-muted/50">
                <h3 className="font-medium text-sm">Conversations</h3>
              </div>
              <ScrollArea className="h-80">
                <div className="space-y-1 p-2">
                  {communications.map((thread) => (
                    <ThreadItem
                      key={thread.participant}
                      thread={thread}
                      isSelected={selectedThread === thread.participant}
                      onClick={() => setSelectedThread(thread.participant)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Message Thread */}
            <div className="border rounded-lg">
              {selectedThread ? (
                <>
                  <ThreadHeader
                    selectedThread={selectedThread}
                    onSendPaymentRequest={handleSendPaymentRequest}
                  />
                  
                  <ScrollArea className="h-64 p-3">
                    <div className="space-y-3">
                      {threadMessages?.map((msg, index) => (
                        <MessageItem
                          key={`${msg!.event.id}-${index}`}
                          event={msg!.event}
                          decrypted={msg!.decrypted}
                          isFromMe={msg!.isFromMe}
                        />
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="p-3 border-t">
                    <div className="flex space-x-2">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 min-h-[60px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || isSending}
                        size="sm"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Select a conversation to view messages</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Request Dialog */}
      {paymentRecipient && (
        <SendPaymentRequestDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          recipientPubkey={paymentRecipient.pubkey}
          recipientName={paymentRecipient.name}
          auctionId={auctionId}
          auctionTitle={auctionTitle}
        />
      )}
    </>
  );
}