import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { MyBidHistory } from '@/components/MyBidHistory';
import { BidDialog } from '@/components/BidDialog';
import { AuctionComments } from '@/components/AuctionComments';

import { 
  Eye, 
  MessageCircle, 
  Zap, 
  Clock,
  Package
} from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';

interface AuctionData {
  id: string;
  title: string;
  description: string;
  starting_bid: number;
  reserve_price?: number;
  shipping: {
    local: {
      cost: number;
      countries: string[];
    };
    international: {
      cost: number;
    };
  };
  artist_info: {
    name: string;
    bio: string;
    website: string;
  };
}

interface AuctionDetailViewProps {
  auction: NostrEvent;
  auctionData: AuctionData;
  currentBid?: number;
  bidCount?: number;
  className?: string;
}

export function AuctionDetailView({ 
  auction, 
  auctionData, 
  currentBid, 
  bidCount = 0, 
  className 
}: AuctionDetailViewProps) {
  const { user } = useCurrentUser();
  const [bidDialogOpen, setBidDialogOpen] = useState(false);

  return (
    <div className={className}>
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>Details</span>
          </TabsTrigger>
          <TabsTrigger value="bids" className="flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span>My Bids</span>
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center space-x-2">
            <MessageCircle className="h-4 w-4" />
            <span>Comments</span>
          </TabsTrigger>
          <TabsTrigger value="shipping" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Shipping</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Auction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{auctionData.title}</h3>
                <p className="text-muted-foreground">{auctionData.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Current Bid</p>
                  <div className="flex items-center space-x-1">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold">{(currentBid || auctionData.starting_bid).toLocaleString()} sats</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Total Bids</p>
                  <span className="font-semibold">{bidCount}</span>
                </div>
              </div>

              {auctionData.reserve_price && (
                <div>
                  <p className="text-sm font-medium">Reserve Price</p>
                  <div className="flex items-center space-x-2">
                    <span>{auctionData.reserve_price.toLocaleString()} sats</span>
                    {currentBid && currentBid >= auctionData.reserve_price && (
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        Reserve Met
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Artist Information</p>
                <div className="bg-muted/50 p-3 rounded">
                  <p className="font-medium">{auctionData.artist_info.name}</p>
                  <p className="text-sm text-muted-foreground">{auctionData.artist_info.bio}</p>
                  {auctionData.artist_info.website && (
                    <a 
                      href={auctionData.artist_info.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Visit Website
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bids" className="mt-6">
          {user ? (
            <MyBidHistory 
              auctionEventId={auction.id}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Please log in to view your bid history</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comments" className="mt-6">
          <AuctionComments auction={auction} />
        </TabsContent>

        <TabsContent value="shipping" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium mb-2">Local Shipping</p>
                <div className="bg-muted/50 p-3 rounded">
                  <p className="text-sm">
                    <span className="font-medium">Cost:</span> {auctionData.shipping.local.cost.toLocaleString()} sats
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Countries:</span> {auctionData.shipping.local.countries.join(', ')}
                  </p>
                </div>
              </div>

              <div>
                <p className="font-medium mb-2">International Shipping</p>
                <div className="bg-muted/50 p-3 rounded">
                  <p className="text-sm">
                    <span className="font-medium">Cost:</span> {auctionData.shipping.international.cost.toLocaleString()} sats
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Available to all countries not listed in local shipping
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bid Dialog */}
      <BidDialog
        open={bidDialogOpen}
        onOpenChange={setBidDialogOpen}
        auction={auction}
        currentBid={currentBid || auctionData.starting_bid}
      />
    </div>
  );
}