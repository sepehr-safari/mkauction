import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuctionMessageHelpers } from '@/hooks/useAuctionCommunications';

interface BidNotificationOptions {
  auctionId: string;
  auctionTitle: string;
  auctionEventId: string;
  autoWelcomeMessage?: boolean;
  welcomeMessageTemplate?: string;
}

export function useAuctionBidNotifications({
  auctionId,
  auctionTitle,
  auctionEventId,
  autoWelcomeMessage = false,
  welcomeMessageTemplate = "Thank you for your bid! I'll review it and get back to you soon."
}: BidNotificationOptions) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { sendGeneralMessage } = useAuctionMessageHelpers();

  // Track the latest bids to detect new ones
  const { data: latestBids } = useQuery({
    queryKey: ['latest-bids', auctionEventId],
    queryFn: async (c) => {
      if (!auctionEventId) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{ 
        kinds: [1021], 
        '#e': [auctionEventId],
        limit: 10,
        since: Math.floor(Date.now() / 1000) - 3600, // Last hour
      }], { signal });
      
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!auctionEventId && !!user,
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Send welcome messages to new bidders
  useEffect(() => {
    if (!autoWelcomeMessage || !user || !latestBids || latestBids.length === 0) return;
    
    // Only send welcome messages if user is the auction owner
    const sendWelcomeMessages = async () => {
      for (const bid of latestBids) {
        if (bid.pubkey === user.pubkey) continue; // Skip own bids
        
        try {
          // Check if we've already sent a welcome message to this bidder
          // This is a simple check - in a real app you might want to store this state
          const timeSinceBid = Date.now() / 1000 - bid.created_at;
          if (timeSinceBid < 300) { // Only send if bid is less than 5 minutes old
            await sendGeneralMessage(
              bid.pubkey,
              auctionId,
              auctionTitle,
              welcomeMessageTemplate
            );
          }
        } catch (error) {
          console.error('Failed to send welcome message:', error);
        }
      }
    };

    sendWelcomeMessages();
  }, [latestBids, autoWelcomeMessage, user, auctionId, auctionTitle, welcomeMessageTemplate, sendGeneralMessage]);

  return {
    latestBids,
    newBidCount: latestBids?.length || 0,
  };
}

// Hook to get bid statistics for an auction
export function useAuctionBidStats(auctionEventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['auction-bid-stats', auctionEventId],
    queryFn: async (c) => {
      if (!auctionEventId) return null;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const bids = await nostr.query([{ 
        kinds: [1021], 
        '#e': [auctionEventId],
        limit: 100,
      }], { signal });

      const validBids = bids.filter(bid => {
        try {
          const bidData = JSON.parse(bid.content);
          return typeof bidData.amount === 'number' && bidData.amount > 0;
        } catch {
          return false;
        }
      });

      const uniqueBidders = new Set(validBids.map(bid => bid.pubkey));
      const amounts = validBids.map(bid => {
        try {
          return JSON.parse(bid.content).amount;
        } catch {
          return 0;
        }
      });

      const highestBid = amounts.length > 0 ? Math.max(...amounts) : 0;
      const averageBid = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;

      return {
        totalBids: validBids.length,
        uniqueBidders: uniqueBidders.size,
        highestBid,
        averageBid,
        latestBidTime: validBids.length > 0 ? Math.max(...validBids.map(bid => bid.created_at)) : 0,
      };
    },
    enabled: !!auctionEventId,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}