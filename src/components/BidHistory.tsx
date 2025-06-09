import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useAuctionBids, useAuctionBidConfirmations } from '@/hooks/useAuctions';
import { useAuctionCommunications, useSendAuctionMessage, AUCTION_MESSAGE_TYPES } from '@/hooks/useAuctionCommunications';
import { genUserName } from '@/lib/genUserName';

import { 
  MessageCircle, 
  Send, 
  Zap, 
  Clock, 
  Check, 
  X, 
  AlertCircle,
  User,
  Crown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NostrEvent } from '@nostrify/nostrify';

interface BidHistoryProps {
  auctionEventId: string;
  auctionId: string;
  auctionTitle: string;
  className?: string;
}

interface BidData {
  amount: number;
  shipping_option: string;
  buyer_country: string;
  message: string;
}

interface BidConfirmationData {
  status: string;
  message?: string;
  duration_extended?: number;
  total_cost?: number;
}

interface BidWithMessages {
  bid: NostrEvent;
  bidData: BidData | null;
  confirmation?: NostrEvent;
  confirmationData?: BidConfirmationData | null;
  messages: Array<{
    event: NostrEvent;
    decrypted: {
      type?: number;
      message?: string;
      auction_id?: string;
      auction_title?: string;
    } | null;
    isFromMe: boolean;
  }>;
  status: string;
}

function getMessageTypeLabel(type: number): string {
  switch (type) {
    case AUCTION_MESSAGE_TYPES.BID_INQUIRY:
      return 'Bid Inquiry';
    case AUCTION_MESSAGE_TYPES.PAYMENT_REQUEST:
      return 'Payment Request';
    case AUCTION_MESSAGE_TYPES.SHIPPING_UPDATE:
      return 'Shipping Update';
    case AUCTION_MESSAGE_TYPES.GENERAL:
      return 'General Message';
    default:
      return 'Message';
  }
}

function getBidConfirmationStyle(status: string): string {
  switch (status) {
    case 'accepted':
      return 'bg-green-500 text-white border-green-600';
    case 'rejected':
      return 'bg-red-500 text-white border-red-600';
    case 'winner':
      return 'bg-yellow-500 text-black border-yellow-600';
    default:
      return 'bg-orange-500 text-white border-orange-600';
  }
}

function getBidConfirmationIcon(status: string) {
  switch (status) {
    case 'accepted':
      return <Check className="h-3 w-3 opacity-75" />;
    case 'rejected':
      return <X className="h-3 w-3 opacity-75" />;
    case 'winner':
      return <Crown className="h-3 w-3 opacity-75" />;
    default:
      return <Clock className="h-3 w-3 opacity-75" />;
  }
}

function getBidConfirmationTextColor(status: string): string {
  switch (status) {
    case 'accepted':
      return 'text-green-100';
    case 'rejected':
      return 'text-red-100';
    case 'winner':
      return 'text-yellow-100';
    default:
      return 'text-orange-100';
  }
}

function getBidConfirmationBadgeStyle(status: string): string {
  switch (status) {
    case 'accepted':
      return 'border-green-200 text-green-100';
    case 'rejected':
      return 'border-red-200 text-red-100';
    case 'winner':
      return 'border-yellow-200 text-yellow-100';
    default:
      return 'border-orange-200 text-orange-100';
  }
}

export function BidHistory({ auctionEventId, auctionId, auctionTitle, className }: BidHistoryProps) {
  const { user } = useCurrentUser();
  const { data: bids, isLoading: bidsLoading } = useAuctionBids(auctionEventId);
  const { data: confirmations, isLoading: confirmationsLoading } = useAuctionBidConfirmations(auctionEventId);
  const { data: communications } = useAuctionCommunications(auctionId);
  const { sendAuctionMessage, isPending: isSending } = useSendAuctionMessage();

  const [selectedBidder, setSelectedBidder] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  
  // Get author data for selected bidder
  const selectedBidderAuthor = useAuthor(selectedBidder || '');

  const isLoading = bidsLoading || confirmationsLoading;

  // Combine bids with their confirmations and related messages
  const bidsWithMessages: BidWithMessages[] = (bids || []).map(bid => {
    let bidData: BidData | null = null;
    try {
      bidData = JSON.parse(bid.content) as BidData;
    } catch {
      // Invalid bid data
    }

    // Find confirmation for this bid
    const confirmation = confirmations?.find(conf => 
      conf.tags.some(tag => tag[0] === 'e' && tag[1] === bid.id)
    );

    let confirmationData: BidConfirmationData | null = null;
    if (confirmation) {
      try {
        confirmationData = JSON.parse(confirmation.content) as BidConfirmationData;
      } catch {
        // Invalid confirmation data
      }
    }

    // Find messages related to this bidder
    const bidderThread = communications?.find(thread => thread.participant === bid.pubkey);
    const relatedMessages = bidderThread?.messages || [];

    // Add bid confirmation as a message if it exists
    const allMessages = [...relatedMessages];
    if (confirmation && confirmationData) {
      allMessages.push({
        event: confirmation,
        decrypted: {
          id: `bid_confirmation_${confirmation.id}`,
          type: AUCTION_MESSAGE_TYPES.GENERAL,
          message: confirmationData.message || `Bid ${confirmationData.status}`,
          auction_id: auctionId,
          auction_title: auctionTitle,
          created_at: confirmation.created_at,
        },
        isFromMe: true, // Confirmation is from auction owner
      });
    }

    // Sort all messages by timestamp
    allMessages.sort((a, b) => a.event.created_at - b.event.created_at);

    // Determine status
    let status = 'pending';
    if (confirmationData) {
      status = confirmationData.status;
    }

    return {
      bid,
      bidData,
      confirmation,
      confirmationData,
      messages: allMessages,
      status,
    };
  });

  // Sort by bid amount (highest first)
  bidsWithMessages.sort((a, b) => {
    const amountA = a.bidData?.amount || 0;
    const amountB = b.bidData?.amount || 0;
    return amountB - amountA;
  });

  const handleSendMessage = async () => {
    if (!selectedBidder || !newMessage.trim()) return;

    try {
      await sendAuctionMessage(selectedBidder, {
        id: `bid_response_${auctionId}_${Date.now()}`,
        type: AUCTION_MESSAGE_TYPES.GENERAL,
        message: newMessage.trim(),
        auction_id: auctionId,
        auction_title: auctionTitle,
      });
      setNewMessage('');
      setMessageDialogOpen(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const openMessageDialog = (bidderPubkey: string) => {
    setSelectedBidder(bidderPubkey);
    setMessageDialogOpen(true);
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Bid History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Please log in to view bid history</p>
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
            <span>Bid History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
            <p>Loading bid history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bidsWithMessages.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>Bid History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No bids received yet</p>
            <p className="text-sm">Bid history and messages will appear here</p>
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
            <span>Bid History</span>
            <Badge variant="outline">{bidsWithMessages.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {bidsWithMessages.map((bidWithMessages) => (
                <BidHistoryItem
                  key={bidWithMessages.bid.id}
                  bidWithMessages={bidWithMessages}
                  onSendMessage={() => openMessageDialog(bidWithMessages.bid.pubkey)}
                  isOwner={user.pubkey === bidWithMessages.bid.pubkey}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <span>Message Conversation</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Show conversation history */}
            {selectedBidder && (() => {
              const bidWithMessages = bidsWithMessages.find(b => b.bid.pubkey === selectedBidder);
              const bidderName = selectedBidderAuthor.data?.metadata?.name ?? genUserName(selectedBidder);
              
              return (
                <>
                  <div className="text-sm text-muted-foreground mb-4">
                    Conversation with <span className="font-medium">{bidderName}</span>
                  </div>
                  
                  {bidWithMessages?.messages.length ? (
                    <ScrollArea className="h-64 border rounded-lg p-3">
                      <div className="space-y-3">
                        {bidWithMessages.messages.map((msg, index) => (
                          <div
                            key={`${msg.event.id}-${index}`}
                            className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] p-2 rounded-lg text-sm ${
                                msg.event.kind === 1022
                                  ? getBidConfirmationStyle(bidWithMessages?.status || 'pending')
                                  : msg.isFromMe 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              <div className="flex items-center space-x-1 mb-1">
                                {msg.event.kind === 1022 ? (
                                  getBidConfirmationIcon(bidWithMessages?.status || 'pending')
                                ) : msg.isFromMe ? (
                                  <Crown className="h-3 w-3 opacity-75" />
                                ) : (
                                  <User className="h-3 w-3 opacity-75" />
                                )}
                                <span className={`text-xs font-medium ${
                                  msg.event.kind === 1022 
                                    ? getBidConfirmationTextColor(bidWithMessages?.status || 'pending')
                                    : msg.isFromMe 
                                      ? 'text-blue-100' 
                                      : 'text-gray-600'
                                }`}>
                                  {msg.event.kind === 1022 
                                    ? 'Bid Confirmation' 
                                    : msg.isFromMe 
                                      ? 'You' 
                                      : bidderName}
                                </span>
                                <span className={`text-xs opacity-75 ${
                                  msg.event.kind === 1022 
                                    ? getBidConfirmationTextColor(bidWithMessages?.status || 'pending')
                                    : msg.isFromMe 
                                      ? 'text-blue-200' 
                                      : 'text-gray-500'
                                }`}>
                                  {formatDistanceToNow(new Date(msg.event.created_at * 1000), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap break-words">
                                {msg.decrypted?.message || 'Encrypted message'}
                              </p>
                              {msg.event.kind === 1022 && (
                                <div className="mt-1">
                                  <Badge variant="outline" className={`text-xs ${getBidConfirmationBadgeStyle(bidWithMessages?.status || 'pending')}`}>
                                    {(bidWithMessages?.status || 'pending').toUpperCase()}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Start the conversation below</p>
                    </div>
                  )}
                </>
              );
            })()}
            
            <Separator />
            
            <div className="space-y-3">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[80px]"
              />
              <div className="flex space-x-2">
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSending ? 'Sending...' : 'Send Message'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMessageDialogOpen(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BidHistoryItem({ 
  bidWithMessages, 
  onSendMessage, 
  isOwner 
}: { 
  bidWithMessages: BidWithMessages;
  onSendMessage: () => void;
  isOwner: boolean;
}) {
  const author = useAuthor(bidWithMessages.bid.pubkey);
  const displayName = author.data?.metadata?.name ?? genUserName(bidWithMessages.bid.pubkey);
  const profileImage = author.data?.metadata?.picture;

  if (!bidWithMessages.bidData) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <X className="h-4 w-4 text-red-500" />;
      case 'winner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-orange-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'winner':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-orange-100 text-orange-800 border-orange-300';
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Bidder Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{displayName}</p>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(bidWithMessages.bid.created_at * 1000), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="flex items-center space-x-1">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="font-semibold">{bidWithMessages.bidData.amount.toLocaleString()} sats</span>
            </div>
            <Badge variant="outline" className={getStatusColor(bidWithMessages.status)}>
              {getStatusIcon(bidWithMessages.status)}
              <span className="ml-1 capitalize">{bidWithMessages.status}</span>
            </Badge>
          </div>
          {!isOwner && (
            <Button size="sm" variant="outline" onClick={onSendMessage}>
              <MessageCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Bid Message */}
      {bidWithMessages.bidData.message && (
        <div className="bg-muted/50 p-3 rounded">
          <p className="text-sm font-medium mb-1">Bid Message:</p>
          <p className="text-sm">{bidWithMessages.bidData.message}</p>
        </div>
      )}



      {/* Message History */}
      {bidWithMessages.messages.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Message History ({bidWithMessages.messages.length})</p>
              <Badge variant="outline" className="text-xs">
                {bidWithMessages.messages.filter(m => !m.isFromMe).length} from bidder • {bidWithMessages.messages.filter(m => m.isFromMe).length} from you
              </Badge>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {bidWithMessages.messages.map((msg, index) => (
                <div
                  key={`${msg.event.id}-${index}`}
                  className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg shadow-sm ${
                      // Check if this is a bid confirmation message
                      msg.event.kind === 1022
                        ? getBidConfirmationStyle(bidWithMessages.status)
                        : msg.isFromMe 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {msg.event.kind === 1022 ? (
                          getBidConfirmationIcon(bidWithMessages.status)
                        ) : msg.isFromMe ? (
                          <Crown className="h-3 w-3 opacity-75" />
                        ) : (
                          <User className="h-3 w-3 opacity-75" />
                        )}
                        <span className="text-xs font-medium">
                          {msg.event.kind === 1022 
                            ? 'Bid Confirmation' 
                            : msg.isFromMe 
                              ? 'Auction Owner' 
                              : displayName}
                        </span>
                      </div>
                      <span className={`text-xs opacity-75 ${
                        msg.event.kind === 1022 
                          ? getBidConfirmationTextColor(bidWithMessages.status)
                          : msg.isFromMe 
                            ? 'text-blue-100' 
                            : 'text-gray-500'
                      }`}>
                        {formatDistanceToNow(new Date(msg.event.created_at * 1000), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.decrypted?.message || 'Encrypted message'}
                    </p>
                    {msg.event.kind === 1022 && (
                      <div className="mt-2">
                        <Badge variant="outline" className={`text-xs ${getBidConfirmationBadgeStyle(bidWithMessages.status)}`}>
                          {bidWithMessages.status.toUpperCase()}
                        </Badge>
                      </div>
                    )}
                    {msg.decrypted?.type && msg.event.kind !== 1022 && (
                      <div className={`mt-2 text-xs opacity-75 ${msg.isFromMe ? 'text-blue-100' : 'text-gray-500'}`}>
                        <Badge variant="outline" className={`text-xs ${msg.isFromMe ? 'border-blue-200 text-blue-100' : 'border-gray-300 text-gray-600'}`}>
                          {getMessageTypeLabel(msg.decrypted.type)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Shipping Info */}
      <div className="text-xs text-muted-foreground">
        <span>Shipping: {bidWithMessages.bidData.shipping_option} to {bidWithMessages.bidData.buyer_country}</span>
        {bidWithMessages.confirmationData?.total_cost && (
          <span className="ml-2">
            • Total: {bidWithMessages.confirmationData.total_cost.toLocaleString()} sats
          </span>
        )}
      </div>
    </div>
  );
}