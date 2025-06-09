import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMyBids } from '@/hooks/useAuctions';
import { useAuctionCommunications } from '@/hooks/useAuctionCommunications';

import { 
  MessageCircle, 
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

interface MyBidHistoryProps {
  auctionEventId?: string;
  className?: string;
}

interface BidData {
  amount: number;
  shipping_option: string;
  buyer_country: string;
  message: string;
}

interface MyBidWithMessages {
  bid: NostrEvent;
  bidData: BidData | null;
  auctionEventId: string;
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

export function MyBidHistory({ auctionEventId, className }: MyBidHistoryProps) {
  const { user } = useCurrentUser();
  const { data: myBids, isLoading } = useMyBids(user?.pubkey);
  const { data: communications } = useAuctionCommunications();

  if (!user) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>My Bid History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Please log in to view your bid history</p>
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
            <span>My Bid History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
            <p>Loading your bid history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter bids for specific auction if provided
  const filteredBids = auctionEventId 
    ? myBids?.filter(bid => 
        bid.tags.some(tag => tag[0] === 'e' && tag[1] === auctionEventId)
      ) || []
    : myBids || [];

  // Combine bids with their related messages
  const bidsWithMessages: MyBidWithMessages[] = filteredBids.map(bid => {
    let bidData: BidData | null = null;
    try {
      bidData = JSON.parse(bid.content) as BidData;
    } catch {
      // Invalid bid data
    }

    // Get auction event ID from tags
    const auctionEventId = bid.tags.find(tag => tag[0] === 'e')?.[1] || '';

    // Find messages related to this auction
    const relatedMessages = communications?.find(thread => 
      thread.messages.some(msg => 
        msg.decrypted?.auction_id && 
        msg.decrypted.auction_id.includes(auctionEventId.substring(0, 8))
      )
    )?.messages || [];

    // Determine status from messages (simplified)
    let status = 'pending';
    const hasAcceptedMessage = relatedMessages.some(msg => 
      msg.decrypted?.type === 2 && msg.decrypted?.message?.toLowerCase().includes('accept')
    );
    const hasRejectedMessage = relatedMessages.some(msg => 
      msg.decrypted?.type === 2 && msg.decrypted?.message?.toLowerCase().includes('reject')
    );
    const hasWinnerMessage = relatedMessages.some(msg => 
      msg.decrypted?.type === 1 || msg.decrypted?.message?.toLowerCase().includes('winner')
    );

    if (hasWinnerMessage) status = 'winner';
    else if (hasAcceptedMessage) status = 'accepted';
    else if (hasRejectedMessage) status = 'rejected';

    return {
      bid,
      bidData,
      auctionEventId,
      messages: relatedMessages,
      status,
    };
  });

  // Sort by bid timestamp (most recent first)
  bidsWithMessages.sort((a, b) => b.bid.created_at - a.bid.created_at);

  if (bidsWithMessages.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>My Bid History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No bids placed yet</p>
            <p className="text-sm">Your bid history will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5" />
          <span>My Bid History</span>
          <Badge variant="outline">{bidsWithMessages.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {bidsWithMessages.map((bidWithMessages) => (
              <MyBidHistoryItem
                key={bidWithMessages.bid.id}
                bidWithMessages={bidWithMessages}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MyBidHistoryItem({ 
  bidWithMessages 
}: { 
  bidWithMessages: MyBidWithMessages;
}) {
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
      {/* Bid Info */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-orange-500" />
            <span className="font-semibold">{bidWithMessages.bidData.amount.toLocaleString()} sats</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(bidWithMessages.bid.created_at * 1000), { addSuffix: true })}
          </p>
        </div>
        <Badge variant="outline" className={getStatusColor(bidWithMessages.status)}>
          {getStatusIcon(bidWithMessages.status)}
          <span className="ml-1 capitalize">{bidWithMessages.status}</span>
        </Badge>
      </div>

      {/* Bid Message */}
      {bidWithMessages.bidData.message && (
        <div className="bg-muted/50 p-3 rounded">
          <p className="text-sm font-medium mb-1">Your Message:</p>
          <p className="text-sm">{bidWithMessages.bidData.message}</p>
        </div>
      )}

      {/* Recent Messages */}
      {bidWithMessages.messages.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Messages ({bidWithMessages.messages.length}):</p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {bidWithMessages.messages.slice(-2).map((msg, index) => (
              <div
                key={`${msg.event.id}-${index}`}
                className={`text-xs p-2 rounded ${
                  msg.isFromMe 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">
                    {msg.isFromMe ? 'You' : 'Auction Owner'}
                  </span>
                  <span className="opacity-70">
                    {formatDistanceToNow(new Date(msg.event.created_at * 1000), { addSuffix: true })}
                  </span>
                </div>
                <p>{msg.decrypted?.message || 'Encrypted message'}</p>
              </div>
            ))}
            {bidWithMessages.messages.length > 2 && (
              <p className="text-xs text-muted-foreground text-center">
                And {bidWithMessages.messages.length - 2} more messages...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Shipping Info */}
      <div className="text-xs text-muted-foreground">
        <span>Shipping: {bidWithMessages.bidData.shipping_option} to {bidWithMessages.bidData.buyer_country}</span>
      </div>
    </div>
  );
}