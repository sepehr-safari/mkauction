import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AuctionCard } from '@/components/AuctionCard';
import { PaymentMessages } from '@/components/PaymentMessages';
import { BidDialog } from '@/components/BidDialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMyAuctions, useMyBids } from '@/hooks/useAuctions';
import { useEncryptedMessages } from '@/hooks/useEncryptedMessages';
import { 
  User, 
  Gavel, 
  TrendingUp, 
  Mail, 
  Plus,
  Package,
  Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { NostrEvent } from '@nostrify/nostrify';

export function DashboardPage() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [selectedAuction, setSelectedAuction] = useState<NostrEvent | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);

  const { data: myAuctions, isLoading: auctionsLoading } = useMyAuctions(user?.pubkey);
  const { data: myBids, isLoading: bidsLoading } = useMyBids(user?.pubkey);
  const { data: messages } = useEncryptedMessages();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Please Log In</h2>
            <p className="text-muted-foreground">
              Connect your Nostr account to access your dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleViewAuction = (auction: NostrEvent) => {
    const dTag = auction.tags.find(([name]) => name === 'd')?.[1];
    if (dTag) {
      navigate(`/auction/${dTag}`);
    }
  };

  const handleBid = (auction: NostrEvent) => {
    setSelectedAuction(auction);
    setBidDialogOpen(true);
  };

  const getCurrentBid = (auction: NostrEvent) => {
    try {
      const data = JSON.parse(auction.content);
      return data.starting_bid;
    } catch {
      return 0;
    }
  };

  const getAuctionStatus = (auction: NostrEvent) => {
    try {
      const data = JSON.parse(auction.content);
      const now = Math.floor(Date.now() / 1000);
      const endTime = data.start_date + data.duration;
      return now > endTime ? 'ended' : 'active';
    } catch {
      return 'unknown';
    }
  };

  const activeAuctions = myAuctions?.filter(auction => getAuctionStatus(auction) === 'active') || [];
  const endedAuctions = myAuctions?.filter(auction => getAuctionStatus(auction) === 'ended') || [];
  const paymentMessages = messages?.filter(msg => msg.decrypted?.type === 1) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your auctions, bids, and payments
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Gavel className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-muted-foreground">My Auctions</span>
            </div>
            <div className="text-2xl font-bold mt-2">{myAuctions?.length || 0}</div>
            <div className="text-xs text-muted-foreground">
              {activeAuctions.length} active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">My Bids</span>
            </div>
            <div className="text-2xl font-bold mt-2">{myBids?.length || 0}</div>
            <div className="text-xs text-muted-foreground">
              Total placed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium text-muted-foreground">Messages</span>
            </div>
            <div className="text-2xl font-bold mt-2">{messages?.length || 0}</div>
            <div className="text-xs text-muted-foreground">
              {paymentMessages.length} payment requests
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-muted-foreground">Completed</span>
            </div>
            <div className="text-2xl font-bold mt-2">{endedAuctions.length}</div>
            <div className="text-xs text-muted-foreground">
              Auctions ended
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="auctions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="auctions" className="flex items-center space-x-2">
            <Gavel className="h-4 w-4" />
            <span>My Auctions</span>
            {myAuctions && myAuctions.length > 0 && (
              <Badge variant="secondary">{myAuctions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bids" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>My Bids</span>
            {myBids && myBids.length > 0 && (
              <Badge variant="secondary">{myBids.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center space-x-2">
            <Mail className="h-4 w-4" />
            <span>Messages</span>
            {paymentMessages.length > 0 && (
              <Badge variant="secondary">{paymentMessages.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* My Auctions Tab */}
        <TabsContent value="auctions" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">My Auctions</h2>
            <Link to="/create-auction">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Auction
              </Button>
            </Link>
          </div>

          {auctionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="aspect-square bg-muted rounded-t-lg" />
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded mb-2" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : myAuctions && myAuctions.length > 0 ? (
            <div className="space-y-6">
              {activeAuctions.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                    <span>Active Auctions</span>
                    <Badge variant="outline">{activeAuctions.length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeAuctions.map((auction) => (
                      <AuctionCard
                        key={auction.id}
                        event={auction}
                        currentBid={getCurrentBid(auction)}
                        bidCount={0}
                        onBid={() => handleBid(auction)}
                        onViewDetails={() => handleViewAuction(auction)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {endedAuctions.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                    <span>Ended Auctions</span>
                    <Badge variant="outline">{endedAuctions.length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {endedAuctions.map((auction) => (
                      <AuctionCard
                        key={auction.id}
                        event={auction}
                        currentBid={getCurrentBid(auction)}
                        bidCount={0}
                        onBid={() => handleBid(auction)}
                        onViewDetails={() => handleViewAuction(auction)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Gavel className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No auctions yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first auction to start selling your artwork
                </p>
                <Link to="/create-auction">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Auction
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* My Bids Tab */}
        <TabsContent value="bids" className="space-y-6">
          <h2 className="text-xl font-semibold">My Bids</h2>

          {bidsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : myBids && myBids.length > 0 ? (
            <div className="space-y-4">
              {myBids.map((bid) => {
                try {
                  const bidData = JSON.parse(bid.content);
                  return (
                    <Card key={bid.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <Zap className="h-4 w-4 text-orange-500" />
                              <span className="font-semibold">
                                {bidData.amount.toLocaleString()} sats
                              </span>
                              <Badge variant="outline">
                                {bidData.shipping_option}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Bid placed {formatDistanceToNow(new Date(bid.created_at * 1000), { addSuffix: true })}
                            </p>
                            {bidData.message && (
                              <p className="text-sm mt-2 bg-muted/50 p-2 rounded">
                                "{bidData.message}"
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="mb-2">
                              Pending
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              Country: {bidData.buyer_country}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                } catch {
                  return null;
                }
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No bids yet</h3>
                <p className="text-muted-foreground mb-4">
                  Browse auctions and place your first bid
                </p>
                <Link to="/auctions">
                  <Button>
                    <Gavel className="h-4 w-4 mr-2" />
                    Browse Auctions
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <PaymentMessages />
        </TabsContent>
      </Tabs>

      {/* Bid Dialog */}
      {selectedAuction && (
        <BidDialog
          open={bidDialogOpen}
          onOpenChange={setBidDialogOpen}
          auction={selectedAuction}
          currentBid={getCurrentBid(selectedAuction)}
        />
      )}
    </div>
  );
}