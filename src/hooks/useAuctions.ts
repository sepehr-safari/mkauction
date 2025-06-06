import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
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

function validateAuctionEvent(event: NostrEvent): boolean {
  // Check if it's an auction event kind
  if (event.kind !== 30020) return false;

  try {
    const data = JSON.parse(event.content) as AuctionData;
    
    // Check for required fields
    if (!data.id || !data.title || !data.starting_bid || !data.start_date || !data.duration) {
      return false;
    }

    // Check if images array exists and has at least one image
    if (!Array.isArray(data.images) || data.images.length === 0) {
      return false;
    }

    // Check if shipping info is properly structured
    if (data.shipping?.local?.cost === undefined || data.shipping?.international?.cost === undefined) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function useAuctions() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['auctions'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{ kinds: [30020], limit: 50 }], { signal });
      
      // Filter and validate auction events
      return events
        .filter(validateAuctionEvent)
        .sort((a, b) => b.created_at - a.created_at);
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

export function useAuction(auctionId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['auction', auctionId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{ 
        kinds: [30020], 
        ids: [auctionId],
        limit: 1 
      }], { signal });
      
      const auction = events.find(validateAuctionEvent);
      if (!auction) {
        throw new Error('Auction not found');
      }
      
      return auction;
    },
    enabled: !!auctionId,
  });
}

export function useAuctionByDTag(dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['auction-by-d', dTag],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{ 
        kinds: [30020], 
        '#d': [dTag],
        limit: 1 
      }], { signal });
      
      const auction = events.find(validateAuctionEvent);
      if (!auction) {
        throw new Error('Auction not found');
      }
      
      return auction;
    },
    enabled: !!dTag,
  });
}

export function useAuctionBids(auctionEventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['auction-bids', auctionEventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{ 
        kinds: [1021], 
        '#e': [auctionEventId],
        limit: 100 
      }], { signal });
      
      // Sort bids by amount (highest first)
      return events
        .filter(event => {
          try {
            const bidData = JSON.parse(event.content);
            return typeof bidData.amount === 'number' && bidData.amount > 0;
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          const amountA = JSON.parse(a.content).amount;
          const amountB = JSON.parse(b.content).amount;
          return amountB - amountA;
        });
    },
    enabled: !!auctionEventId,
    staleTime: 10000, // 10 seconds
    refetchInterval: 15000, // 15 seconds
  });
}

export function useAuctionBidConfirmations(auctionEventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['auction-bid-confirmations', auctionEventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{ 
        kinds: [1022], 
        '#e': [auctionEventId],
        limit: 100 
      }], { signal });
      
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!auctionEventId,
    staleTime: 10000, // 10 seconds
    refetchInterval: 20000, // 20 seconds
  });
}

export function useMyAuctions(pubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['my-auctions', pubkey],
    queryFn: async (c) => {
      if (!pubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{ 
        kinds: [30020], 
        authors: [pubkey],
        limit: 50 
      }], { signal });
      
      return events
        .filter(validateAuctionEvent)
        .sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!pubkey,
  });
}

export function useMyBids(pubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['my-bids', pubkey],
    queryFn: async (c) => {
      if (!pubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{ 
        kinds: [1021], 
        authors: [pubkey],
        limit: 100 
      }], { signal });
      
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!pubkey,
  });
}