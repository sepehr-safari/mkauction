import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { Upload, X } from 'lucide-react';

const auctionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  startingBid: z.number().min(1, 'Starting bid must be at least 1 sat'),
  reservePrice: z.number().optional(),
  duration: z.enum(['86400', '172800', '604800'], {
    required_error: 'Please select auction duration',
  }),
  autoExtend: z.boolean().default(true),
  localShippingCost: z.number().min(0, 'Local shipping cost cannot be negative'),
  internationalShippingCost: z.number().min(0, 'International shipping cost cannot be negative'),
  localCountries: z.string().min(1, 'Please specify local countries'),
  artistName: z.string().min(1, 'Artist name is required'),
  artistBio: z.string().optional(),
  artistWebsite: z.string().url().optional().or(z.literal('')),
});

type AuctionFormData = z.infer<typeof auctionSchema>;

const DURATION_OPTIONS = [
  { value: '86400', label: '24 Hours' },
  { value: '172800', label: '48 Hours' },
  { value: '604800', label: '1 Week' },
];

export function CreateAuctionForm() {
  const { user } = useCurrentUser();
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { toast } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);

  const form = useForm<AuctionFormData>({
    resolver: zodResolver(auctionSchema),
    defaultValues: {
      autoExtend: true,
      localShippingCost: 0,
      internationalShippingCost: 0,
    },
  });

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const tags = await uploadFile(file);
        return tags[0][1]; // Get the URL from the first tag
      });

      const urls = await Promise.all(uploadPromises);
      setImages(prev => [...prev, ...urls]);
      toast({
        title: 'Images uploaded successfully',
        description: `${urls.length} image(s) added to auction`,
      });
    } catch {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload one or more images',
        variant: 'destructive',
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: AuctionFormData) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to create an auction',
        variant: 'destructive',
      });
      return;
    }

    if (images.length === 0) {
      toast({
        title: 'Images required',
        description: 'Please upload at least one image of the artwork',
        variant: 'destructive',
      });
      return;
    }

    const auctionId = crypto.randomUUID();
    const startDate = Math.floor(Date.now() / 1000);
    const duration = parseInt(data.duration);

    const auctionContent = {
      id: auctionId,
      stall_id: crypto.randomUUID(), // For now, create a new stall for each auction
      title: data.title,
      description: data.description,
      images,
      starting_bid: data.startingBid,
      reserve_price: data.reservePrice,
      start_date: startDate,
      duration,
      auto_extend: data.autoExtend,
      extension_time: 300, // 5 minutes
      shipping: {
        local: {
          cost: data.localShippingCost,
          countries: data.localCountries.split(',').map(c => c.trim()),
        },
        international: {
          cost: data.internationalShippingCost,
        },
      },
      artist_info: {
        name: data.artistName,
        bio: data.artistBio || '',
        website: data.artistWebsite || '',
      },
    };

    const tags = [
      ['d', auctionId],
      ['t', 'art'],
      ['t', 'auction'],
      ['title', data.title],
      ['starting_bid', data.startingBid.toString()],
      ['currency', 'sats'],
      ['start_date', startDate.toString()],
      ['duration', duration.toString()],
      ['image', images[0]], // Primary image
    ];

    createEvent({
      kind: 30020,
      content: JSON.stringify(auctionContent),
      tags,
    }, {
      onSuccess: () => {
        toast({
          title: 'Auction created successfully',
          description: 'Your artwork auction is now live!',
        });
        form.reset();
        setImages([]);
      },
      onError: (error) => {
        toast({
          title: 'Failed to create auction',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Please log in to create an auction</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Art Auction</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Image Upload */}
            <div className="space-y-4">
              <FormLabel>Artwork Images</FormLabel>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="mt-4">
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-foreground">
                        Upload artwork images
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        PNG, JPG, GIF up to 10MB each
                      </span>
                    </label>
                    <input
                      id="image-upload"
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files)}
                      disabled={uploadingImages}
                    />
                  </div>
                </div>
              </div>
              
              {/* Image Preview */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Artwork ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Basic Info */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Artwork Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter artwork title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the artwork, materials, dimensions, etc."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auction Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startingBid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting Bid (sats)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1000"
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
                name="reservePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reserve Price (sats) - Optional</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auction Duration</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoExtend"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Auto-extend auction</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Extend auction by 5 minutes when bids are placed in the last 5 minutes
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Shipping */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Shipping Information</h3>
              
              <FormField
                control={form.control}
                name="localCountries"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local Countries (comma-separated)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="US, CA, MX"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="localShippingCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local Shipping Cost (sats)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1000"
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
                  name="internationalShippingCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>International Shipping Cost (sats)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="5000"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Artist Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Artist Information</h3>
              
              <FormField
                control={form.control}
                name="artistName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artist Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Artist name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="artistBio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artist Bio (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief artist biography"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="artistWebsite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artist Website (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://artist-website.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || uploadingImages}
            >
              {isPending ? 'Creating Auction...' : 'Create Auction'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </div>
  );
}