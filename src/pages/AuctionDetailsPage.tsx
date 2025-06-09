import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { BidDialog } from '@/components/BidDialog';
import { AuctionComments } from '@/components/AuctionComments';
import { AuctionManagement } from '@/components/AuctionManagement';
import { PublicBidHistory } from '@/components/PublicBidHistory';
import { RelaySelector } from '@/components/RelaySelector';
import { useAuction, useAuctionByDTag, useAuctionBids } from '@/hooks/useAuctions';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { 
  Clock, 
  Zap, 
  Heart, 
  MessageCircle, 
  Share2, 
  ExternalLink,
  Truck,
  User,
  Calendar,
  Tag
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AuctionData {
  id: string;
  title: string;
  description: string;
  images: string[];
  starting_bid: number;
  reserve_price?: number;
  start_date: number;
  duration: number;
  auto_extend: boolean;
  extension_time: number;
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

interface BidData {
  amount: number;
  shipping_option: string;
  buyer_country: string;
  message: string;
}

export function AuctionDetailsPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const { toast } = useToast();
  
  // Check if auctionId looks like a UUID (d tag) or event ID
  const isUUID = auctionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auctionId);
  
  const { data: auctionByDTag, isLoading: isLoadingByDTag, error: errorByDTag } = useAuctionByDTag(isUUID ? auctionId || '' : '');
  const { data: auctionById, isLoading: isLoadingById, error: errorById } = useAuction(!isUUID ? auctionId || '' : '');
  
  // Use the appropriate auction data
  const auction = isUUID ? auctionByDTag : auctionById;
  const isLoading = isUUID ? isLoadingByDTag : isLoadingById;
  const error = isUUID ? errorByDTag : errorById;
  
  const { data: bids } = useAuctionBids(auction?.id || '');
  
  const [auctionData, setAuctionData] = useState<AuctionData | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isActive, setIsActive] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  const author = useAuthor(auction?.pubkey || '');

  // Parse auction data
  useEffect(() => {
    if (auction) {
      try {
        const data = JSON.parse(auction.content) as AuctionData;
        setAuctionData(data);
      } catch (error) {
        console.error('Failed to parse auction data:', error);
      }
    }
  }, [auction]);

  // Update countdown timer
  useEffect(() => {
    if (!auctionData) return;

    const updateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const endTime = auctionData.start_date + auctionData.duration;
      const remaining = endTime - now;

      if (remaining <= 0) {
        setTimeLeft('Auction ended');
        setIsActive(false);
      } else {
        setIsActive(true);
        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;

        if (days > 0) {
          setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        } else if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${seconds}s`);
        }
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [auctionData]);

  const getCurrentBid = () => {
    if (!bids || bids.length === 0) {
      return auctionData?.starting_bid || 0;
    }
    
    try {
      const highestBid = bids[0];
      const bidData = JSON.parse(highestBid.content) as BidData;
      return bidData.amount;
    } catch {
      return auctionData?.starting_bid || 0;
    }
  };

  const handleLike = () => {
    if (!user || !auction) return;

    createEvent({
      kind: 7,
      content: '+',
      tags: [
        ['e', auction.id],
        ['p', auction.pubkey],
        ['k', '30020'],
      ],
    }, {
      onSuccess: () => {
        setHasLiked(true);
        toast({
          title: 'Liked!',
          description: 'You liked this auction',
        });
      },
    });
  };

  const handleComment = () => {
    // Scroll to comments section
    const commentsSection = document.getElementById('comments-section');
    if (commentsSection) {
      commentsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: auctionData?.title,
        text: `Check out this art auction: ${auctionData?.title}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link copied',
        description: 'Auction link copied to clipboard',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded" />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !auction || !auctionData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              {error ? `Error: ${error.message}` : 'Auction not found'}
            </p>
            {auctionId && (
              <div className="text-xs text-muted-foreground">
                <p>Looking for auction ID: {auctionId}</p>
                <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
                <p>Auction found: {auction ? 'Yes' : 'No'}</p>
                <p>Auction data parsed: {auctionData ? 'Yes' : 'No'}</p>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm">Try switching to a different relay:</p>
              <RelaySelector className="max-w-xs mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = author.data?.metadata?.name ?? genUserName(auction.pubkey);
  const profileImage = author.data?.metadata?.picture;
  const currentBid = getCurrentBid();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="relative">
            <img
              src={auctionData.images[selectedImageIndex]}
              alt={auctionData.title}
              className="w-full aspect-square object-cover rounded-lg"
            />
            <div className="absolute top-4 right-4">
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "Live" : "Ended"}
              </Badge>
            </div>
            {auctionData.reserve_price && currentBid >= auctionData.reserve_price && (
              <div className="absolute top-4 left-4">
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  Reserve Met
                </Badge>
              </div>
            )}
          </div>
          
          {auctionData.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {auctionData.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`aspect-square rounded overflow-hidden border-2 transition-colors ${
                    selectedImageIndex === index ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${auctionData.title} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auction Details */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{auctionData.title}</h1>
            <div className="flex items-center space-x-2 mb-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profileImage} />
                <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">Artist: {auctionData.artist_info.name}</p>
              </div>
            </div>
          </div>

          {/* Current Bid */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium">Current Bid</span>
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  <span className="text-2xl font-bold">{currentBid.toLocaleString()} sats</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Starting bid</span>
                  <p className="font-medium">{auctionData.starting_bid.toLocaleString()} sats</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bids</span>
                  <p className="font-medium">{bids?.length || 0}</p>
                </div>
              </div>

              {auctionData.reserve_price && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Reserve price</span>
                    <span className="text-sm font-medium">
                      {auctionData.reserve_price.toLocaleString()} sats
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Left */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Time Remaining</span>
              </div>
              <p className="text-2xl font-bold text-primary">{timeLeft}</p>
              {auctionData.auto_extend && isActive && (
                <p className="text-sm text-muted-foreground mt-2">
                  Auto-extends by 5 minutes if bid placed in last 5 minutes
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex space-x-2">
            <Button
              className="flex-1"
              onClick={() => setBidDialogOpen(true)}
              disabled={!isActive || !user}
            >
              {isActive ? 'Place Bid' : 'Auction Ended'}
            </Button>
            <Button variant="outline" size="icon" onClick={handleLike} disabled={!user || hasLiked}>
              <Heart className={`h-4 w-4 ${hasLiked ? 'fill-current text-red-500' : ''}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleComment}>
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{auctionData.description}</p>
            </CardContent>
          </Card>

          {/* Shipping Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Truck className="h-5 w-5" />
                <span>Shipping</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Local Shipping</h4>
                <p className="text-sm text-muted-foreground mb-1">
                  {auctionData.shipping.local.countries.join(', ')}
                </p>
                <p className="font-medium">{auctionData.shipping.local.cost.toLocaleString()} sats</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">International Shipping</h4>
                <p className="font-medium">{auctionData.shipping.international.cost.toLocaleString()} sats</p>
              </div>
            </CardContent>
          </Card>

          {/* Artist Info */}
          {auctionData.artist_info.bio && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>About the Artist</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium">{auctionData.artist_info.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{auctionData.artist_info.bio}</p>
                </div>
                {auctionData.artist_info.website && (
                  <a
                    href={auctionData.artist_info.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Visit Artist Website</span>
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Auction Details */}
          <Card>
            <CardHeader>
              <CardTitle>Auction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Started</span>
                </div>
                <span className="text-sm">
                  {formatDistanceToNow(new Date(auctionData.start_date * 1000), { addSuffix: true })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Auction ID</span>
                </div>
                <span className="text-sm font-mono">{auctionData.id.slice(0, 8)}...</span>
              </div>
            </CardContent>
          </Card>

          {/* Public Bid History - Visible to everyone */}
          <PublicBidHistory auctionEventId={auction.id} />

          {/* Auction Management - Only visible to auction creator */}
          {user && user.pubkey === auction.pubkey && (
            <AuctionManagement auction={auction} auctionData={auctionData} />
          )}

          {/* Comments Section */}
          <div id="comments-section">
            <AuctionComments auction={auction} />
          </div>
        </div>
      </div>

      <BidDialog
        open={bidDialogOpen}
        onOpenChange={setBidDialogOpen}
        auction={auction}
        currentBid={currentBid}
      />
    </div>
  );
}

