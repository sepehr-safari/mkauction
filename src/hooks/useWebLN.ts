import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';

interface WebLNProvider {
  enable(): Promise<void>;
  getInfo(): Promise<{ node: { alias: string; pubkey: string } }>;
  sendPayment(paymentRequest: string): Promise<{ preimage: string }>;
  makeInvoice(args: { amount: number; defaultMemo?: string }): Promise<{ paymentRequest: string }>;
  signMessage(message: string): Promise<{ message: string; signature: string }>;
  verifyMessage(signature: string, message: string): Promise<boolean>;
}

declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}

export function useWebLN() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<WebLNProvider | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if WebLN is available
    if (typeof window !== 'undefined' && window.webln) {
      setIsAvailable(true);
      setProvider(window.webln);
    }
  }, []);

  const enable = async () => {
    if (!provider) {
      toast({
        title: 'WebLN not available',
        description: 'Please install a WebLN-compatible wallet like Alby or Joule',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      await provider.enable();
      setIsEnabled(true);
      toast({
        title: 'WebLN enabled',
        description: 'Lightning wallet connected successfully',
      });
      return true;
    } catch (error) {
      console.error('Failed to enable WebLN:', error);
      toast({
        title: 'Failed to enable WebLN',
        description: 'Please check your wallet connection',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const sendPayment = async (paymentRequest: string) => {
    if (!isEnabled || !provider) {
      const enabled = await enable();
      if (!enabled) return null;
    }

    setIsLoading(true);
    try {
      const result = await provider!.sendPayment(paymentRequest);
      toast({
        title: 'Payment sent',
        description: 'Lightning payment completed successfully',
      });
      return result;
    } catch (error) {
      console.error('Payment failed:', error);
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const makeInvoice = async (amount: number, memo?: string) => {
    if (!isEnabled || !provider) {
      const enabled = await enable();
      if (!enabled) return null;
    }

    setIsLoading(true);
    try {
      const result = await provider!.makeInvoice({
        amount,
        defaultMemo: memo,
      });
      return result;
    } catch (error) {
      console.error('Failed to create invoice:', error);
      toast({
        title: 'Failed to create invoice',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getInfo = async () => {
    if (!isEnabled || !provider) {
      const enabled = await enable();
      if (!enabled) return null;
    }

    try {
      const info = await provider!.getInfo();
      return info;
    } catch (error) {
      console.error('Failed to get wallet info:', error);
      return null;
    }
  };

  return {
    isAvailable,
    isEnabled,
    isLoading,
    enable,
    sendPayment,
    makeInvoice,
    getInfo,
  };
}