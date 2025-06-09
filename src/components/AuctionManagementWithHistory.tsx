import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AuctionManagement } from '@/components/AuctionManagement';
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

interface AuctionManagementWithHistoryProps {
  auction: NostrEvent;
  auctionData: AuctionData;
}

export function AuctionManagementWithHistory({ auction, auctionData }: AuctionManagementWithHistoryProps) {
  const { user } = useCurrentUser();

  // Only show to auction creator
  if (!user || user.pubkey !== auction.pubkey) {
    return null;
  }

  return (
    <div>
      {/* Auction Management Section */}
      <AuctionManagement 
        auction={auction}
        auctionData={auctionData}
      />
    </div>
  );
}