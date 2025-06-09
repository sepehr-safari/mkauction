import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BidHistory } from '@/components/BidHistory';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { User } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';

interface AuctionData {
  id: string;
  title: string;
  start_date: number;
  duration: number;
  auto_extend: boolean;
  extension_time: number;
  shipping: {
    local: { cost: number; countries: string[] };
    international: { cost: number };
  };
}

interface StandaloneBidHistoryProps {
  auction: NostrEvent;
  auctionData: AuctionData;
  className?: string;
}

/**
 * Standalone Bid History component that can be used independently
 * Shows the bid history section above any other content
 */
export function StandaloneBidHistory({ auction, auctionData, className }: StandaloneBidHistoryProps) {
  const { user } = useCurrentUser();

  // Only show to auction creator
  if (!user || user.pubkey !== auction.pubkey) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Bid History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Only the auction owner can view bid history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <BidHistory 
        auctionEventId={auction.id}
        auctionId={auctionData.id}
        auctionTitle={auctionData.title}
      />
    </div>
  );
}