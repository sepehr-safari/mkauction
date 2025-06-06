import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuctionBidsWithConfirmations, useBidConfirmation, useAuctionStatusUpdate, usePaymentRequest } from '@/hooks/useAuctionManagement';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { genUserName } from '@/lib/genUserName';
import { 
  Check, 
  X, 
  Clock, 
  Crown, 
  Zap, 
  MessageSquare, 
  DollarSign,
  Package,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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

interface BidItem {
  bid: NostrEvent;
  bidData: BidData | null;
  confirmation?: NostrEvent;
  confirmationData?: BidConfirmationData | null;
  isValid: boolean;
  status: string;
}

interface AuctionManagementProps {
  auction: NostrEvent;
  auctionData: AuctionData;
}

export function AuctionManagement({ auction, auctionData }: AuctionManagementProps) {
  const { user } = useCurrentUser();
  const { data: bidsWithConfirmations, isLoading } = useAuctionBidsWithConfirmations(auction.id);
  const { confirmBid, isPending: isConfirming } = useBidConfirmation();
  const { updateAuctionStatus } = useAuctionStatusUpdate();
  const { sendPaymentRequest, isPending: isSendingPayment } = usePaymentRequest();
  
  const [selectedBid, setSelectedBid] = useState<BidItem | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [extendTime, setExtendTime] = useState(300); // 5 minutes default
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [lightningInvoice, setLightningInvoice] = useState('');
  const [isAuctionEnded, setIsAuctionEnded] = useState(false);

  // Check if auction has ended
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    const endTime = auctionData.start_date + auctionData.duration;
    setIsAuctionEnded(now > endTime);
  }, [auctionData]);

  // Only show to auction creator
  if (!user || user.pubkey !== auction.pubkey) {
    return null;
  }

  const handleConfirmBid = (status: 'accepted' | 'rejected' | 'pending') => {
    if (!selectedBid || !selectedBid.bidData) return;

    const totalCost = selectedBid.bidData.amount + getShippingCost(selectedBid.bidData);
    const durationExtended = status === 'accepted' && shouldExtendAuction() ? extendTime : undefined;

    confirmBid(
      selectedBid.bid,
      auction.id,
      status,
      confirmationMessage || undefined,
      durationExtended,
      totalCost
    );

    setSelectedBid(null);
    setConfirmationMessage('');
  };

  const handleSelectWinner = (bidItem: BidItem) => {
    if (!bidItem.bidData) return;
    
    const totalCost = bidItem.bidData.amount + getShippingCost(bidItem.bidData);
    
    confirmBid(
      bidItem.bid,
      auction.id,
      'winner',
      'Congratulations! You won the auction.',
      undefined,
      totalCost
    );

    // Update auction status to completed
    updateAuctionStatus(
      auction.id,
      auctionData.id,
      'completed',
      undefined,
      bidItem.bidData.amount,
      bidItem.bid.pubkey,
      'Auction completed successfully'
    );
  };

  const handleSendPaymentRequest = () => {
    const winner = bidsWithConfirmations?.find(item => item.status === 'winner');
    if (!winner || !lightningInvoice) return;

    const totalCost = winner.bidData ? winner.bidData.amount + getShippingCost(winner.bidData) : 0;
    
    sendPaymentRequest(
      winner.bid.pubkey,
      `order-${auction.id}-${Date.now()}`,
      totalCost,
      [{ type: 'ln', link: lightningInvoice }],
      `Payment for auction: ${auctionData.title}`
    );

    setPaymentDialogOpen(false);
    setLightningInvoice('');
  };

  const getShippingCost = (bidData: BidData) => {
    const isLocal = auctionData.shipping.local.countries.includes(bidData.buyer_country);
    return isLocal ? auctionData.shipping.local.cost : auctionData.shipping.international.cost;
  };

  const shouldExtendAuction = () => {
    if (!auctionData.auto_extend) return false;
    const now = Math.floor(Date.now() / 1000);
    const endTime = auctionData.start_date + auctionData.duration;
    const timeLeft = endTime - now;
    return timeLeft <= 300 && timeLeft > 0; // Last 5 minutes
  };



  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auction Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading bids...</p>
        </CardContent>
      </Card>
    );
  }

  const acceptedBids = bidsWithConfirmations?.filter(item => item.status === 'accepted') || [];
  const pendingBids = bidsWithConfirmations?.filter(item => item.status === 'pending') || [];
  const winner = bidsWithConfirmations?.find(item => item.status === 'winner');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Package className="h-5 w-5" />
          <span>Auction Management</span>
          {isAuctionEnded && (
            <Badge variant="outline" className="bg-orange-100 text-orange-800">
              Auction Ended
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {bidsWithConfirmations?.length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Total Bids</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {acceptedBids.length}
            </div>
            <div className="text-sm text-muted-foreground">Accepted</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {pendingBids.length}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
        </div>

        <Separator />

        {/* Winner Section */}
        {winner && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center space-x-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span>Auction Winner</span>
            </h3>
            <BidItem 
              bidItem={winner} 
              onAction={() => setPaymentDialogOpen(true)}
              actionLabel="Send Payment Request"
              actionIcon={<DollarSign className="h-4 w-4" />}
            />
          </div>
        )}

        {/* Pending Bids */}
        {pendingBids.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span>Pending Bids ({pendingBids.length})</span>
            </h3>
            <div className="space-y-3">
              {pendingBids.map((bidItem) => (
                <BidItem
                  key={bidItem.bid.id}
                  bidItem={bidItem}
                  onAction={() => setSelectedBid(bidItem)}
                  actionLabel="Review"
                  actionIcon={<MessageSquare className="h-4 w-4" />}
                />
              ))}
            </div>
          </div>
        )}

        {/* Accepted Bids */}
        {acceptedBids.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center space-x-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Accepted Bids ({acceptedBids.length})</span>
            </h3>
            <div className="space-y-3">
              {acceptedBids.slice(0, 5).map((bidItem) => (
                <BidItem
                  key={bidItem.bid.id}
                  bidItem={bidItem}
                  onAction={isAuctionEnded ? () => handleSelectWinner(bidItem) : undefined}
                  actionLabel={isAuctionEnded ? "Select Winner" : undefined}
                  actionIcon={isAuctionEnded ? <Crown className="h-4 w-4" /> : undefined}
                />
              ))}
              {acceptedBids.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  And {acceptedBids.length - 5} more accepted bids...
                </p>
              )}
            </div>
          </div>
        )}

        {/* No Bids */}
        {(!bidsWithConfirmations || bidsWithConfirmations.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No bids received yet</p>
            <p className="text-sm">Share your auction to get more visibility!</p>
          </div>
        )}

        {/* Bid Confirmation Dialog */}
        <Dialog open={!!selectedBid} onOpenChange={() => setSelectedBid(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Bid</DialogTitle>
            </DialogHeader>
            {selectedBid && selectedBid.bidData && (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Bid Amount</span>
                    <div className="flex items-center space-x-1">
                      <Zap className="h-4 w-4 text-orange-500" />
                      <span className="font-bold">{selectedBid.bidData.amount.toLocaleString()} sats</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    + {getShippingCost(selectedBid.bidData).toLocaleString()} sats shipping
                  </div>
                  <div className="text-sm font-medium">
                    Total: {(selectedBid.bidData.amount + getShippingCost(selectedBid.bidData)).toLocaleString()} sats
                  </div>
                </div>

                {selectedBid.bidData.message && (
                  <div>
                    <Label>Bidder Message</Label>
                    <p className="text-sm bg-muted/50 p-3 rounded mt-1">
                      {selectedBid.bidData.message}
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="confirmation-message">Response Message (Optional)</Label>
                  <Textarea
                    id="confirmation-message"
                    value={confirmationMessage}
                    onChange={(e) => setConfirmationMessage(e.target.value)}
                    placeholder="Add a message for the bidder..."
                    className="mt-1"
                  />
                </div>

                {shouldExtendAuction() && (
                  <div>
                    <Label htmlFor="extend-time">Extend Auction (seconds)</Label>
                    <Input
                      id="extend-time"
                      type="number"
                      value={extendTime}
                      onChange={(e) => setExtendTime(parseInt(e.target.value) || 300)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Bid placed in last 5 minutes - auction can be extended
                    </p>
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleConfirmBid('accepted')}
                    disabled={isConfirming}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleConfirmBid('rejected')}
                    disabled={isConfirming}
                    variant="destructive"
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Request Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Payment Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="lightning-invoice">Lightning Invoice</Label>
                <Textarea
                  id="lightning-invoice"
                  value={lightningInvoice}
                  onChange={(e) => setLightningInvoice(e.target.value)}
                  placeholder="Paste Lightning invoice here..."
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={handleSendPaymentRequest}
                  disabled={isSendingPayment || !lightningInvoice}
                  className="flex-1"
                >
                  Send Payment Request
                </Button>
                <Button
                  onClick={() => setPaymentDialogOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function BidItem({ 
  bidItem, 
  onAction, 
  actionLabel, 
  actionIcon 
}: { 
  bidItem: BidItem;
  onAction?: () => void; 
  actionLabel?: string; 
  actionIcon?: React.ReactNode; 
}) {
  const author = useAuthor(bidItem.bid.pubkey);
  const displayName = author.data?.metadata?.name ?? genUserName(bidItem.bid.pubkey);
  const profileImage = author.data?.metadata?.picture;

  if (!bidItem.bidData) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center space-x-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profileImage} />
          <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{displayName}</p>
          <p className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(bidItem.bid.created_at * 1000), { addSuffix: true })}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <div className="text-right">
          <div className="flex items-center space-x-1">
            <Zap className="h-4 w-4 text-orange-500" />
            <span className="font-semibold">{bidItem.bidData.amount.toLocaleString()} sats</span>
          </div>
          <Badge variant="outline" className={getStatusColor(bidItem.status)}>
            {bidItem.status}
          </Badge>
        </div>
        {onAction && actionLabel && (
          <Button onClick={onAction} size="sm" variant="outline">
            {actionIcon}
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'accepted': return 'bg-green-100 text-green-800 border-green-300';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
    case 'winner': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}