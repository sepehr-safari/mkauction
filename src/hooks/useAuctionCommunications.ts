import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSendEncryptedMessage } from '@/hooks/useEncryptedMessages';
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
      if (!user) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Get all NIP-04 encrypted messages to and from the user
      const [sentMessages, receivedMessages] = await Promise.all([
        // Messages sent by the user (NIP-04)
        nostr.query([{
          kinds: [4], // NIP-04 Encrypted Direct Messages
          authors: [user.pubkey],
          limit: 100,
        }], { signal }),
        // Messages received by the user (NIP-04)
        nostr.query([{
          kinds: [4], // NIP-04 Encrypted Direct Messages
          '#p': [user.pubkey],
          limit: 100,
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

            if (!otherPubkey) return null;

            // Use NIP-04 decryption for kind 4 events
            if (user.signer?.nip04?.decrypt) {
              decrypted = await user.signer.nip04.decrypt(otherPubkey, event.content);
            }

            if (decrypted) {
              const parsed = JSON.parse(decrypted) as AuctionMessage;
              
              // Filter for auction-related messages
              if (auctionId && parsed.auction_id !== auctionId) {
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
      
      decryptedMessages
        .filter(msg => msg !== null)
        .forEach(msg => {
          if (!msg) return;
          
          const participantKey = msg.otherPubkey;
          
          if (!messageThreads.has(participantKey)) {
            messageThreads.set(participantKey, {
              participant: participantKey,
              messages: [],
              unreadCount: 0,
            });
          }

          const thread = messageThreads.get(participantKey)!;
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
    enabled: !!user?.pubkey,
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
      if (!user) return [];
      
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
  const { sendEncryptedMessage, isPending } = useSendEncryptedMessage();
  const { toast } = useToast();

  const sendAuctionMessage = async (
    recipientPubkey: string,
    messageData: Omit<AuctionMessage, 'created_at'> & { created_at?: number }
  ) => {
    const fullMessage: AuctionMessage = {
      ...messageData,
      created_at: messageData.created_at || Math.floor(Date.now() / 1000),
    };

    try {
      await sendEncryptedMessage(recipientPubkey, fullMessage);
    } catch (error) {
      console.error('Failed to send auction message:', error);
      toast({
        title: 'Failed to send message',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
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