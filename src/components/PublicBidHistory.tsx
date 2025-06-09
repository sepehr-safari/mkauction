import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuctionBids, useAuctionBidConfirmations } from '@/hooks/useAuctions';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

import { 
  Zap, 
  TrendingUp, 
  Users,
  AlertCircle,
  Check,
  X,
  Clock,
  Crown,
  MessageCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NostrEvent } from '@nostrify/nostrify';

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

interface PublicBidHistoryProps {
  auctionEventId: string;
  className?: string;
}

interface BidWithConfirmation {
  bid: NostrEvent;
  bidData: BidData;
  confirmation: NostrEvent | undefined;
  confirmationData: BidConfirmationData | undefined;
  status: string;
}

function getStatusIcon(status: string) {
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
}

function getStatusColor(status: string) {
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
}

export function PublicBidHistory({ auctionEventId, className }: PublicBidHistoryProps) {
  const { data: bids, isLoading: bidsLoading } = useAuctionBids(auctionEventId);
  const { data: confirmations, isLoading: confirmationsLoading } = useAuctionBidConfirmations(auctionEventId);

  const isLoading = bidsLoading || confirmationsLoading;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Bid History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!bids || bids.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Bid History</span>
            <Badge variant="outline">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No bids placed yet</p>
            <p className="text-sm">Be the first to place a bid!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse and validate bids with their confirmations
  const bidsWithConfirmations: BidWithConfirmation[] = bids
    .map(bid => {
      try {
        const bidData = JSON.parse(bid.content) as BidData;
        
        // Find confirmation for this bid
        const confirmation = confirmations?.find(conf => 
          conf.tags.some(tag => tag[0] === 'e' && tag[1] === bid.id)
        );

        let confirmationData: BidConfirmationData | undefined;
        if (confirmation) {
          try {
            confirmationData = JSON.parse(confirmation.content) as BidConfirmationData;
          } catch {
            // Invalid confirmation data
          }
        }

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
          status 
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is BidWithConfirmation => 
      item !== null && item.bidData && item.bidData.amount > 0
    );

  if (bidsWithConfirmations.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Bid History</span>
            <Badge variant="outline">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No valid bids found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const highestBid = bidsWithConfirmations[0];
  const totalBidders = new Set(bidsWithConfirmations.map(item => item.bid.pubkey)).size;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Bid History</span>
          <Badge variant="outline">{bidsWithConfirmations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Highest Bid</span>
            </div>
            <p className="text-lg font-bold">{highestBid.bidData.amount.toLocaleString()} sats</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Bidders</span>
            </div>
            <p className="text-lg font-bold">{totalBidders}</p>
          </div>
        </div>

        {/* Bid List */}
        <ScrollArea className="h-80">
          <div className="space-y-3">
            {bidsWithConfirmations.map((item, index) => (
              <PublicBidItem
                key={item.bid.id}
                bidWithConfirmation={item}
                isHighest={index === 0}
                rank={index + 1}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PublicBidItem({ 
  bidWithConfirmation, 
  isHighest, 
  rank 
}: { 
  bidWithConfirmation: BidWithConfirmation;
  isHighest: boolean;
  rank: number;
}) {
  const { bid, bidData, confirmationData, status } = bidWithConfirmation;
  const author = useAuthor(bid.pubkey);
  const displayName = author.data?.metadata?.name ?? genUserName(bid.pubkey);
  const profileImage = author.data?.metadata?.picture;

  return (
    <div className={`p-4 border rounded-lg transition-colors ${
      isHighest ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              isHighest ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
            }`}>
              #{rank}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={profileImage} />
              <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
          <div>
            <p className="font-medium text-sm">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(bid.created_at * 1000), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center space-x-1">
            <Zap className="h-4 w-4 text-orange-500" />
            <span className={`font-semibold ${isHighest ? 'text-green-700' : ''}`}>
              {bidData.amount.toLocaleString()} sats
            </span>
          </div>
          
          {/* Status Badge */}
          <div className="flex items-center space-x-2 mt-1">
            {isHighest && (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                Leading Bid
              </Badge>
            )}
            <Badge variant="outline" className={getStatusColor(status)}>
              {getStatusIcon(status)}
              <span className="ml-1 capitalize">{status}</span>
            </Badge>
          </div>
          
          <div className="text-xs text-muted-foreground mt-1">
            {bidData.shipping_option} • {bidData.buyer_country}
          </div>
        </div>
      </div>
      
      {/* Bid Message */}
      {bidData.message && bidData.message.trim() && (
        <div className="mt-3 pt-3 border-t border-muted">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground mb-1 font-medium">Message from bidder:</p>
            <p className="text-sm whitespace-pre-wrap break-words">{bidData.message}</p>
          </div>
        </div>
      )}

      {/* Bid Confirmation Message */}
      {confirmationData?.message && (
        <div className="mt-3 pt-3 border-t border-muted">
          <div className={`rounded-lg p-3 ${
            status === 'accepted' ? 'bg-green-50 border border-green-200' :
            status === 'rejected' ? 'bg-red-50 border border-red-200' :
            status === 'winner' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Response from auction owner:</p>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{confirmationData.message}</p>
            

            
            {confirmationData.duration_extended && (
              <div className="mt-1">
                <p className="text-xs text-muted-foreground">
                  Auction extended by {confirmationData.duration_extended} seconds
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}