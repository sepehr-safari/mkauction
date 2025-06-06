import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuctionCard } from '@/components/AuctionCard';
import { BidDialog } from '@/components/BidDialog';
import { RelaySelector } from '@/components/RelaySelector';
import { useAuctions } from '@/hooks/useAuctions';
import { Plus, Filter, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { NostrEvent } from '@nostrify/nostrify';

export function AuctionsPage() {
  const { data: auctions, isLoading, error } = useAuctions();
  const [selectedAuction, setSelectedAuction] = useState<NostrEvent | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const navigate = useNavigate();



  const handleBid = (auction: NostrEvent) => {
    setSelectedAuction(auction);
    setBidDialogOpen(true);
  };

  const handleViewDetails = (auction: NostrEvent) => {
    // For replaceable events (kind 30020), we should use the 'd' tag value
    const dTag = auction.tags.find(([name]) => name === 'd')?.[1];
    if (dTag) {
      navigate(`/auction/${dTag}`);
    } else {
      // Fallback to event ID if no d tag found
      navigate(`/auction/${auction.id}`);
    }
  };

  const getCurrentBid = (auctionEventId: string) => {
    // This would normally come from the bids query for each auction
    // For now, we'll return the starting bid from the auction data
    const auction = auctions?.find(a => a.id === auctionEventId);
    if (!auction) return 0;
    
    try {
      const data = JSON.parse(auction.content);
      return data.starting_bid;
    } catch {
      return 0;
    }
  };

  const getBidCount = (_auctionEventId: string) => {
    // This would normally come from the bids query for each auction
    // For now, return 0
    return 0;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Art Auctions</h1>
            <p className="text-muted-foreground mt-2">Discover and bid on unique artworks</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <Skeleton className="aspect-square rounded-t-lg" />
              <CardContent className="p-4">
                <Skeleton className="h-4 mb-2" />
                <Skeleton className="h-3 w-2/3 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Art Auctions</h1>
            <p className="text-muted-foreground mt-2">Discover and bid on unique artworks</p>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                Failed to load auctions. Try another relay?
              </p>
              <RelaySelector className="w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!auctions || auctions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Art Auctions</h1>
            <p className="text-muted-foreground mt-2">Discover and bid on unique artworks</p>
          </div>
          <Link to="/create-auction">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Auction
            </Button>
          </Link>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">No auctions found</h3>
                <p className="text-muted-foreground">
                  Be the first to create an art auction or try another relay to discover more content.
                </p>
              </div>
              <div className="flex flex-col space-y-3">
                <Link to="/create-auction">
                  <Button className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Auction
                  </Button>
                </Link>
                <RelaySelector className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Art Auctions</h1>
          <p className="text-muted-foreground mt-2">
            Discover and bid on unique artworks • {auctions.length} active auctions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Link to="/create-auction">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Auction
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            event={auction}
            currentBid={getCurrentBid(auction.id)}
            bidCount={getBidCount(auction.id)}
            onBid={() => handleBid(auction)}
            onViewDetails={() => handleViewDetails(auction)}
          />
        ))}
      </div>

      {selectedAuction && (
        <BidDialog
          open={bidDialogOpen}
          onOpenChange={setBidDialogOpen}
          auction={selectedAuction}
          currentBid={getCurrentBid(selectedAuction.id)}
        />
      )}
    </div>
  );
}