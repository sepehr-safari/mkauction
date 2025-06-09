import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';

interface AuctionMessage {
  id: string;
  type: number; // Use number to match PaymentMessage interface
  message: string;
  auction_id?: string;
  auction_title?: string;
  bid_amount?: number;
  payment_options?: Array<{
    type: string;
    link: string;
  }>;
  paid?: boolean;
  shipped?: boolean;
  tracking_number?: string;
  created_at: number;
}

// Type constants for auction message types
export const AUCTION_MESSAGE_TYPES = {
  BID_INQUIRY: 3,
  PAYMENT_REQUEST: 1,
  SHIPPING_UPDATE: 4,
  GENERAL: 5,
} as const;

interface MessageThread {
  participant: string;
  messages: Array<{
    event: NostrEvent;
    decrypted: AuctionMessage | null;
    isFromMe: boolean;
  }>;
  lastMessage?: AuctionMessage;
  unreadCount: number;
}

export function useAuctionCommunications(auctionId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['auction-communications', user?.pubkey, auctionId],
    queryFn: async (c) => {
      if (!user || !auctionId) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // First, get the auction event to find its event ID
      const auctionEvents = await nostr.query([{
        kinds: [30020], // NIP-15 auction events
        '#d': [auctionId],
        limit: 1,
      }], { signal });

      const auctionEvent = auctionEvents[0];
      if (!auctionEvent) return [];

      // Get all bids and bid confirmations for this auction to identify participants
      const [bids, bidConfirmations] = await Promise.all([
        nostr.query([{
          kinds: [1021], // NIP-15 bid events
          '#e': [auctionEvent.id],
          limit: 100,
        }], { signal }),
        nostr.query([{
          kinds: [1022], // NIP-15 bid confirmation events
          '#e': [auctionEvent.id],
          limit: 100,
        }], { signal })
      ]);

      // Get unique bidder pubkeys (auction participants)
      const participantPubkeys = new Set<string>();
      bids.forEach(bid => {
        if (bid.pubkey !== user.pubkey) { // Don't include self
          participantPubkeys.add(bid.pubkey);
        }
      });

      // Also include participants from bid confirmations (in case they haven't bid yet but received confirmations)
      bidConfirmations.forEach(confirmation => {
        const bidderPubkey = confirmation.tags.find(([name]) => name === 'p')?.[1];
        if (bidderPubkey && bidderPubkey !== user.pubkey) {
          participantPubkeys.add(bidderPubkey);
        }
      });

      // If user is the auction owner, include all bidders as participants
      // If user is a bidder, only include the auction owner as participant
      const relevantParticipants = new Set<string>();
      if (user.pubkey === auctionEvent.pubkey) {
        // User is auction owner - include all bidders
        participantPubkeys.forEach(pubkey => relevantParticipants.add(pubkey));
      } else {
        // User is a bidder - include auction owner
        relevantParticipants.add(auctionEvent.pubkey);
      }

      if (relevantParticipants.size === 0) return [];

      // Get all NIP-04 encrypted messages between user and participants
      const [sentMessages, receivedMessages] = await Promise.all([
        // Messages sent by the user to participants
        nostr.query([{
          kinds: [4], // NIP-04 Encrypted Direct Messages
          authors: [user.pubkey],
          limit: 200,
        }], { signal }),
        // Messages received by the user from participants
        nostr.query([{
          kinds: [4], // NIP-04 Encrypted Direct Messages
          authors: Array.from(relevantParticipants),
          '#p': [user.pubkey],
          limit: 200,
        }], { signal })
      ]);

      const allMessages = [...sentMessages, ...receivedMessages];

      // Decrypt and filter auction-related messages
      const decryptedMessages = await Promise.all(
        allMessages.map(async (event) => {
          try {
            let decrypted: string | null = null;
            const otherPubkey = event.pubkey === user.pubkey 
              ? event.tags.find(tag => tag[0] === 'p')?.[1] 
              : event.pubkey;

            if (!otherPubkey || !relevantParticipants.has(otherPubkey)) return null;

            // Use NIP-04 decryption for kind 4 events
            if (user.signer?.nip04?.decrypt) {
              decrypted = await user.signer.nip04.decrypt(otherPubkey, event.content);
            }

            if (decrypted) {
              const parsed = JSON.parse(decrypted) as AuctionMessage;
              
              // Filter for auction-related messages
              if (parsed.auction_id && parsed.auction_id !== auctionId) {
                return null;
              }

              return {
                event,
                decrypted: parsed,
                isFromMe: event.pubkey === user.pubkey,
                otherPubkey,
              };
            }
          } catch (error) {
            console.error('Failed to decrypt auction message:', error);
          }
          return null;
        })
      );

      // Group messages by participant
      const messageThreads = new Map<string, MessageThread>();
      
      // Initialize threads for all participants (even if no messages yet)
      relevantParticipants.forEach(pubkey => {
        messageThreads.set(pubkey, {
          participant: pubkey,
          messages: [],
          unreadCount: 0,
        });
      });

      // Add decrypted messages to threads
      decryptedMessages
        .filter(msg => msg !== null)
        .forEach(msg => {
          if (!msg) return;
          
          const participantKey = msg.otherPubkey;
          const thread = messageThreads.get(participantKey);
          
          if (thread) {
            thread.messages.push({
              event: msg.event,
              decrypted: msg.decrypted,
              isFromMe: msg.isFromMe,
            });

            // Update last message and unread count
            if (!msg.isFromMe && (!thread.lastMessage || msg.event.created_at > thread.lastMessage.created_at)) {
              thread.lastMessage = msg.decrypted;
              thread.unreadCount++;
            }
          }
        });

      // Add context from bid confirmations as system messages
      bidConfirmations.forEach(confirmation => {
        const bidderPubkey = confirmation.tags.find(([name]) => name === 'p')?.[1];
        if (!bidderPubkey || bidderPubkey === user.pubkey) return;

        const thread = messageThreads.get(bidderPubkey);
        if (thread) {
          try {
            const confirmationData = JSON.parse(confirmation.content);
            const systemMessage: AuctionMessage = {
              id: `system_${confirmation.id}`,
              type: AUCTION_MESSAGE_TYPES.GENERAL,
              message: `Bid ${confirmationData.status}${confirmationData.message ? ': ' + confirmationData.message : ''}`,
              auction_id: auctionId,
              auction_title: 'System Message',
              created_at: confirmation.created_at,
            };

            thread.messages.push({
              event: confirmation,
              decrypted: systemMessage,
              isFromMe: confirmation.pubkey === user.pubkey,
            });
          } catch (error) {
            console.error('Failed to parse bid confirmation:', error);
          }
        }
      });

      // Sort messages within each thread by timestamp
      Array.from(messageThreads.values()).forEach(thread => {
        thread.messages.sort((a, b) => a.event.created_at - b.event.created_at);
      });

      return Array.from(messageThreads.values())
        .sort((a, b) => {
          const aLastTime = a.lastMessage?.created_at || 0;
          const bLastTime = b.lastMessage?.created_at || 0;
          return bLastTime - aLastTime;
        });
    },
    enabled: !!user?.pubkey && !!auctionId,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useAuctionMessageThread(participantPubkey: string, auctionId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['auction-message-thread', user?.pubkey, participantPubkey, auctionId],
    queryFn: async (c) => {
      if (!user || !participantPubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get NIP-04 messages between the user and specific participant
      const [sentMessages, receivedMessages] = await Promise.all([
        // Messages sent by the user to the participant (NIP-04)
        nostr.query([{
          kinds: [4], // NIP-04 Encrypted Direct Messages
          authors: [user.pubkey],
          '#p': [participantPubkey],
          limit: 50,
        }], { signal }),
        // Messages received from the participant (NIP-04)
        nostr.query([{
          kinds: [4], // NIP-04 Encrypted Direct Messages
          authors: [participantPubkey],
          '#p': [user.pubkey],
          limit: 50,
        }], { signal })
      ]);

      const allMessages = [...sentMessages, ...receivedMessages];

      // Decrypt messages
      const decryptedMessages = await Promise.all(
        allMessages.map(async (event) => {
          try {
            let decrypted: string | null = null;

            // Use NIP-04 decryption for kind 4 events
            if (user.signer?.nip04?.decrypt) {
              decrypted = await user.signer.nip04.decrypt(participantPubkey, event.content);
            }

            if (decrypted) {
              const parsed = JSON.parse(decrypted) as AuctionMessage;
              
              // Filter for auction-related messages if auctionId is provided
              if (auctionId && parsed.auction_id && parsed.auction_id !== auctionId) {
                return null;
              }

              return {
                event,
                decrypted: parsed,
                isFromMe: event.pubkey === user.pubkey,
              };
            }
          } catch (error) {
            console.error('Failed to decrypt message:', error);
          }
          return null;
        })
      );

      return decryptedMessages
        .filter(msg => msg !== null)
        .sort((a, b) => a!.event.created_at - b!.event.created_at);
    },
    enabled: !!user?.pubkey && !!participantPubkey,
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

export function useSendAuctionMessage() {
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const sendAuctionMessage = async (
    recipientPubkey: string,
    messageData: Omit<AuctionMessage, 'created_at'> & { created_at?: number }
  ) => {
    if (!user?.signer?.nip04?.encrypt) {
      toast({
        title: 'Encryption not available',
        description: 'Please use a signer that supports NIP-04 encryption',
        variant: 'destructive',
      });
      throw new Error('NIP-04 encryption not available');
    }

    const fullMessage: AuctionMessage = {
      ...messageData,
      created_at: messageData.created_at || Math.floor(Date.now() / 1000),
    };

    try {
      // Use NIP-04 encryption for kind 4 events
      const encrypted = await user.signer.nip04.encrypt(
        recipientPubkey,
        JSON.stringify(fullMessage)
      );

      // Create NIP-04 encrypted direct message event
      return new Promise<void>((resolve, reject) => {
        createEvent({
          kind: 4, // NIP-04 Encrypted Direct Message
          content: encrypted,
          tags: [['p', recipientPubkey]],
        }, {
          onSuccess: () => {
            toast({
              title: 'Message sent',
              description: 'Encrypted message sent successfully',
            });
            resolve();
          },
          onError: (error) => {
            toast({
              title: 'Failed to send message',
              description: error.message,
              variant: 'destructive',
            });
            reject(error);
          },
        });
      });
    } catch (error) {
      console.error('NIP-04 encryption failed:', error);
      toast({
        title: 'Encryption failed',
        description: error instanceof Error ? error.message : 'Failed to encrypt message',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    sendAuctionMessage,
    isPending,
  };
}

// Helper function to send common auction message types
export function useAuctionMessageHelpers() {
  const { sendAuctionMessage, isPending } = useSendAuctionMessage();

  const sendBidInquiry = async (
    auctionOwnerPubkey: string,
    auctionId: string,
    auctionTitle: string,
    bidAmount: number,
    message: string
  ) => {
    return sendAuctionMessage(auctionOwnerPubkey, {
      id: `bid_inquiry_${auctionId}_${Date.now()}`,
      type: AUCTION_MESSAGE_TYPES.BID_INQUIRY,
      message,
      auction_id: auctionId,
      auction_title: auctionTitle,
      bid_amount: bidAmount,
    });
  };

  const sendPaymentRequest = async (
    winnerPubkey: string,
    auctionId: string,
    auctionTitle: string,
    amount: number,
    paymentOptions: Array<{ type: string; link: string }>,
    message: string
  ) => {
    return sendAuctionMessage(winnerPubkey, {
      id: `payment_${auctionId}_${Date.now()}`,
      type: AUCTION_MESSAGE_TYPES.PAYMENT_REQUEST,
      message,
      auction_id: auctionId,
      auction_title: auctionTitle,
      payment_options: paymentOptions,
      paid: false,
      shipped: false,
    });
  };

  const sendShippingUpdate = async (
    buyerPubkey: string,
    auctionId: string,
    auctionTitle: string,
    message: string,
    trackingNumber?: string
  ) => {
    return sendAuctionMessage(buyerPubkey, {
      id: `shipping_${auctionId}_${Date.now()}`,
      type: AUCTION_MESSAGE_TYPES.SHIPPING_UPDATE,
      message,
      auction_id: auctionId,
      auction_title: auctionTitle,
      tracking_number: trackingNumber,
      shipped: true,
    });
  };

  const sendGeneralMessage = async (
    recipientPubkey: string,
    auctionId: string,
    auctionTitle: string,
    message: string
  ) => {
    return sendAuctionMessage(recipientPubkey, {
      id: `general_${auctionId}_${Date.now()}`,
      type: AUCTION_MESSAGE_TYPES.GENERAL,
      message,
      auction_id: auctionId,
      auction_title: auctionTitle,
    });
  };

  return {
    sendBidInquiry,
    sendPaymentRequest,
    sendShippingUpdate,
    sendGeneralMessage,
    isPending,
  };
}