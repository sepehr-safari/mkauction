import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';

interface PaymentMessage {
  id: string;
  type: number;
  message: string;
  payment_options?: Array<{
    type: string;
    link: string;
  }>;
  paid?: boolean;
  shipped?: boolean;
  amount?: number;
  memo?: string;
  created_at?: number;
}

export function useEncryptedMessages() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['encrypted-messages', user?.pubkey],
    queryFn: async (c) => {
      if (!user) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get encrypted messages sent to the user (NIP-04 kind 4 events)
      const events = await nostr.query([{
        kinds: [4], // NIP-04 Encrypted Direct Messages
        '#p': [user.pubkey],
        limit: 50,
      }], { signal });

      // Decrypt messages if possible (NIP-04 only for kind 4 events)
      const decryptedMessages = await Promise.all(
        events.map(async (event) => {
          try {
            if (user.signer?.nip04?.decrypt) {
              const decrypted = await user.signer.nip04.decrypt(event.pubkey, event.content);
              const parsed = JSON.parse(decrypted) as PaymentMessage;
              return {
                event,
                decrypted: parsed,
                isPaymentMessage: parsed.type === 1 || parsed.type === 2,
              };
            }
          } catch (error) {
            console.error('Failed to decrypt NIP-04 message:', error);
          }
          return {
            event,
            decrypted: null,
            isPaymentMessage: false,
          };
        })
      );

      return decryptedMessages
        .filter(msg => msg.decrypted && msg.isPaymentMessage)
        .sort((a, b) => b.event.created_at - a.event.created_at);
    },
    enabled: !!user?.pubkey,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useSendEncryptedMessage() {
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const sendEncryptedMessage = async (
    recipientPubkey: string,
    message: PaymentMessage
  ) => {
    if (!user?.signer?.nip04?.encrypt) {
      toast({
        title: 'Encryption not available',
        description: 'Please use a signer that supports NIP-04 encryption',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use NIP-04 encryption for kind 4 events
      const encrypted = await user.signer.nip04.encrypt(
        recipientPubkey,
        JSON.stringify(message)
      );

      // Create NIP-04 encrypted direct message event
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
        },
        onError: (error) => {
          toast({
            title: 'Failed to send message',
            description: error.message,
            variant: 'destructive',
          });
        },
      });
    } catch (error) {
      console.error('NIP-04 encryption failed:', error);
      toast({
        title: 'Encryption failed',
        description: error instanceof Error ? error.message : 'Failed to encrypt message',
        variant: 'destructive',
      });
    }
  };

  return {
    sendEncryptedMessage,
    isPending,
  };
}