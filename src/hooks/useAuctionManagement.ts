import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';

interface BidData {
  amount: number;
  shipping_option: string;
  buyer_country: string;
  message: string;
}

interface BidConfirmationData {
  status: 'accepted' | 'rejected' | 'pending' | 'winner';
  message?: string;
  duration_extended?: number;
  total_cost?: number;
}

export function useAuctionBidsWithConfirmations(auctionEventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['auction-bids-with-confirmations', auctionEventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get all bids for this auction
      const bids = await nostr.query([{ 
        kinds: [1021], 
        '#e': [auctionEventId],
        limit: 100 
      }], { signal });

      // Get all bid confirmations for this auction
      const confirmations = await nostr.query([{ 
        kinds: [1022], 
        '#e': [auctionEventId],
        limit: 100 
      }], { signal });

      // Combine bids with their confirmations
      const bidsWithConfirmations = bids.map(bid => {
        const confirmation = confirmations.find(conf => 
          conf.tags.some(([name, value]) => name === 'e' && value === bid.id)
        );

        let bidData: BidData | null = null;
        let confirmationData: BidConfirmationData | null = null;

        try {
          bidData = JSON.parse(bid.content);
        } catch {
          // Invalid bid data
        }

        if (confirmation) {
          try {
            confirmationData = JSON.parse(confirmation.content);
          } catch {
            // Invalid confirmation data
          }
        }

        return {
          bid,
          bidData,
          confirmation,
          confirmationData,
          isValid: bidData !== null,
          status: confirmationData?.status || 'pending',
        };
      });

      // Sort by bid amount (highest first)
      return bidsWithConfirmations
        .filter(item => item.isValid)
        .sort((a, b) => (b.bidData?.amount || 0) - (a.bidData?.amount || 0));
    },
    enabled: !!auctionEventId,
    staleTime: 10000,
    refetchInterval: 15000,
  });
}

export function useBidConfirmation() {
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();

  const confirmBid = (
    bidEvent: NostrEvent,
    auctionEventId: string,
    status: 'accepted' | 'rejected' | 'pending' | 'winner',
    message?: string,
    durationExtended?: number,
    totalCost?: number
  ) => {
    const confirmationData: BidConfirmationData = {
      status,
      message,
      duration_extended: durationExtended,
      total_cost: totalCost,
    };

    const tags = [
      ['e', bidEvent.id], // Reference to the bid
      ['e', auctionEventId], // Reference to the auction
      ['p', bidEvent.pubkey], // Bidder's pubkey
    ];

    createEvent({
      kind: 1022,
      content: JSON.stringify(confirmationData),
      tags,
    }, {
      onSuccess: () => {
        toast({
          title: 'Bid confirmation sent',
          description: `Bid ${status} successfully`,
        });
      },
      onError: (error) => {
        toast({
          title: 'Failed to confirm bid',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return {
    confirmBid,
    isPending,
  };
}

export function useAuctionStatusUpdate() {
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();

  const updateAuctionStatus = (
    auctionEventId: string,
    auctionId: string,
    status: 'active' | 'extended' | 'completed' | 'cancelled',
    endTime?: number,
    winningBid?: number,
    winnerPubkey?: string,
    message?: string
  ) => {
    const statusData = {
      auction_id: auctionId,
      status,
      end_time: endTime,
      winning_bid: winningBid,
      winner_pubkey: winnerPubkey,
      message,
    };

    const tags = [
      ['e', auctionEventId],
      ['status', status],
    ];

    if (endTime) {
      tags.push(['end_time', endTime.toString()]);
    }

    createEvent({
      kind: 1023,
      content: JSON.stringify(statusData),
      tags,
    }, {
      onSuccess: () => {
        toast({
          title: 'Auction status updated',
          description: `Auction marked as ${status}`,
        });
      },
      onError: (error) => {
        toast({
          title: 'Failed to update auction status',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return {
    updateAuctionStatus,
    isPending,
  };
}

export function usePaymentRequest() {
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();

  const sendPaymentRequest = (
    winnerPubkey: string,
    orderId: string,
    totalAmount: number,
    paymentOptions: Array<{ type: string; link: string }>,
    message?: string
  ) => {
    const paymentData = {
      id: orderId,
      type: 1, // Payment request type
      message: message || 'Congratulations! You won the auction.',
      payment_options: paymentOptions,
    };

    const tags = [
      ['p', winnerPubkey],
    ];

    // Send encrypted DM (kind 4) - Note: This is simplified, real implementation would use proper NIP-04 encryption
    createEvent({
      kind: 4,
      content: JSON.stringify(paymentData),
      tags,
    }, {
      onSuccess: () => {
        toast({
          title: 'Payment request sent',
          description: 'Winner has been notified with payment details',
        });
      },
      onError: (error) => {
        toast({
          title: 'Failed to send payment request',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return {
    sendPaymentRequest,
    isPending,
  };
}