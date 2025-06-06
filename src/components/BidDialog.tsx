import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { Zap, Truck } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';

interface AuctionData {
  id: string;
  title: string;
  starting_bid: number;
  shipping: {
    local: {
      cost: number;
      countries: string[];
    };
    international: {
      cost: number;
    };
  };
}

interface BidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auction: NostrEvent;
  currentBid: number;
  minBidIncrement?: number;
}

const bidSchema = z.object({
  amount: z.number().min(1, 'Bid amount must be at least 1 sat'),
  shippingOption: z.enum(['local', 'international'], {
    required_error: 'Please select a shipping option',
  }),
  buyerCountry: z.string().min(2, 'Please enter your country code'),
  message: z.string().optional(),
});

type BidFormData = z.infer<typeof bidSchema>;

// Common country codes for the dropdown
const COMMON_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'MX', name: 'Mexico' },
];

export function BidDialog({ open, onOpenChange, auction, currentBid, minBidIncrement = 100 }: BidDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const [auctionData, setAuctionData] = useState<AuctionData | null>(null);

  // Parse auction data
  useEffect(() => {
    try {
      const data = JSON.parse(auction.content) as AuctionData;
      setAuctionData(data);
    } catch (error) {
      console.error('Failed to parse auction data:', error);
    }
  }, [auction.content]);

  const form = useForm<BidFormData>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      amount: currentBid + minBidIncrement,
      message: '',
    },
  });

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (open) {
      form.reset({
        amount: currentBid + minBidIncrement,
        message: '',
        shippingOption: 'local', // Default to local
        buyerCountry: '',
      });
    }
  }, [open, currentBid, minBidIncrement, form]);

  const watchedAmount = form.watch('amount');
  const watchedCountry = form.watch('buyerCountry');

  // Determine shipping cost and option
  const getShippingInfo = () => {
    if (!auctionData || !watchedCountry) return { cost: 0, option: 'local' };
    
    const isLocal = auctionData.shipping.local.countries.includes(watchedCountry);
    return {
      cost: isLocal ? auctionData.shipping.local.cost : auctionData.shipping.international.cost,
      option: isLocal ? 'local' : 'international',
    };
  };

  const shippingInfo = getShippingInfo();
  const totalCost = (watchedAmount || 0) + shippingInfo.cost;

  // Auto-set shipping option based on country
  useEffect(() => {
    if (watchedCountry && auctionData) {
      const isLocal = auctionData.shipping.local.countries.includes(watchedCountry);
      form.setValue('shippingOption', isLocal ? 'local' : 'international');
    }
  }, [watchedCountry, auctionData, form]);

  const onSubmit = (data: BidFormData) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to place a bid',
        variant: 'destructive',
      });
      return;
    }

    if (data.amount <= currentBid) {
      toast({
        title: 'Invalid bid amount',
        description: `Bid must be higher than current bid of ${currentBid} sats`,
        variant: 'destructive',
      });
      return;
    }

    const bidContent = {
      amount: data.amount,
      shipping_option: data.shippingOption,
      buyer_country: data.buyerCountry,
      message: data.message || '',
    };

    const tags = [
      ['e', auction.id],
      ['p', auction.pubkey],
      ['amount', data.amount.toString()],
      ['shipping', data.shippingOption],
    ];

    createEvent({
      kind: 1021,
      content: JSON.stringify(bidContent),
      tags,
    }, {
      onSuccess: () => {
        toast({
          title: 'Bid placed successfully',
          description: `Your bid of ${data.amount} sats has been submitted`,
        });
        onOpenChange(false);
        form.reset();
      },
      onError: (error) => {
        toast({
          title: 'Failed to place bid',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  if (!auctionData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Place Bid</DialogTitle>
          <DialogDescription>
            Place your bid on "{auctionData.title}"
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Current bid</span>
                <div className="flex items-center space-x-1">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold">{currentBid.toLocaleString()} sats</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Minimum bid: {(currentBid + minBidIncrement).toLocaleString()} sats
              </div>
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Bid (sats)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder={`${currentBid + minBidIncrement}`}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="buyerCountry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Country</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMON_COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name} ({country.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedCountry && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Shipping Information</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Shipping type:</span>
                    <span className="capitalize">{shippingInfo.option}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping cost:</span>
                    <span>{shippingInfo.cost.toLocaleString()} sats</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total cost:</span>
                    <span>{totalCost.toLocaleString()} sats</span>
                  </div>
                </div>
              </div>
            )}

            {/* Hidden shipping option field */}
            <FormField
              control={form.control}
              name="shippingOption"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input type="hidden" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message to Seller (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any questions or comments for the seller..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isPending || !user}
              >
                {isPending ? 'Placing Bid...' : 'Place Bid'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}