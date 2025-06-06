import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Clock, MapPin, Zap, Heart, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NostrEvent } from '@nostrify/nostrify';

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

interface AuctionCardProps {
  event: NostrEvent;
  currentBid?: number;
  bidCount?: number;
  onBid?: () => void;
  onViewDetails?: () => void;
}

export function AuctionCard({ event, currentBid, bidCount = 0, onBid, onViewDetails }: AuctionCardProps) {
  const [auctionData, setAuctionData] = useState<AuctionData | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isActive, setIsActive] = useState(false);
  const author = useAuthor(event.pubkey);

  useEffect(() => {
    try {
      const data = JSON.parse(event.content) as AuctionData;
      setAuctionData(data);
    } catch (error) {
      console.error('Failed to parse auction data:', error);
    }
  }, [event.content]);

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
          setTimeLeft(`${days}d ${hours}h ${minutes}m`);
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

  if (!auctionData) {
    return (
      <Card className="animate-pulse">
        <div className="aspect-square bg-muted rounded-t-lg" />
        <CardContent className="p-4">
          <div className="h-4 bg-muted rounded mb-2" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const displayName = author.data?.metadata?.name ?? genUserName(event.pubkey);
  const profileImage = author.data?.metadata?.picture;
  const displayBid = currentBid || auctionData.starting_bid;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <div className="aspect-square overflow-hidden">
          <img
            src={auctionData.images[0]}
            alt={auctionData.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Live" : "Ended"}
          </Badge>
        </div>
        {auctionData.reserve_price && currentBid && currentBid >= auctionData.reserve_price && (
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              Reserve Met
            </Badge>
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profileImage} />
            <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">{auctionData.artist_info.name}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{auctionData.title}</h3>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current bid</span>
            <div className="flex items-center space-x-1">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="font-semibold">{displayBid.toLocaleString()} sats</span>
            </div>
          </div>
          
          {bidCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Bids</span>
              <span className="text-sm font-medium">{bidCount}</span>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">{timeLeft}</span>
          </div>

          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Ships to {auctionData.shipping.local.countries.join(', ')} + International
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Heart className="h-4 w-4" />
              <span>0</span>
            </div>
            <div className="flex items-center space-x-1">
              <MessageCircle className="h-4 w-4" />
              <span>0</span>
            </div>
          </div>
          <span>
            Started {formatDistanceToNow(new Date(auctionData.start_date * 1000), { addSuffix: true })}
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-0 space-x-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onViewDetails}
        >
          View Details
        </Button>
        <Button
          className="flex-1"
          onClick={onBid}
          disabled={!isActive}
        >
          {isActive ? 'Place Bid' : 'Auction Ended'}
        </Button>
      </CardFooter>
    </Card>
  );
}