import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useAuthor } from '@/hooks/useAuthor';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { MessageCircle, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { NostrEvent } from '@nostrify/nostrify';

interface AuctionCommentsProps {
  auction: NostrEvent;
}

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(500, 'Comment too long'),
});

type CommentFormData = z.infer<typeof commentSchema>;

export function AuctionComments({ auction }: AuctionCommentsProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const [showCommentForm, setShowCommentForm] = useState(false);

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      content: '',
    },
  });

  // Fetch comments for this auction
  const { data: comments, isLoading } = useQuery({
    queryKey: ['auction-comments', auction.id],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [1111], // NIP-22 comment kind
        '#E': [auction.id], // Root event reference
        limit: 100,
      }], { signal });

      // Filter and validate comments
      return events
        .filter(event => {
          // Check if it has the required tags for NIP-22
          const hasRootE = event.tags.some(([name, value]) => name === 'E' && value === auction.id);
          const hasRootK = event.tags.some(([name, value]) => name === 'K' && value === '30020');
          return hasRootE && hasRootK;
        })
        .sort((a, b) => a.created_at - b.created_at); // Oldest first
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const onSubmit = (data: CommentFormData) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to comment',
        variant: 'destructive',
      });
      return;
    }

    // Create NIP-22 comment
    const tags = [
      // Root scope tags (uppercase)
      ['E', auction.id], // Root event ID
      ['K', '30020'], // Root event kind (auction)
      ['P', auction.pubkey], // Root event author

      // Parent scope tags (lowercase) - same as root for top-level comments
      ['e', auction.id], // Parent event ID
      ['k', '30020'], // Parent event kind
      ['p', auction.pubkey], // Parent event author
    ];

    createEvent({
      kind: 1111,
      content: data.content,
      tags,
    }, {
      onSuccess: () => {
        toast({
          title: 'Comment posted',
          description: 'Your comment has been added to the auction',
        });
        form.reset();
        setShowCommentForm(false);
      },
      onError: (error) => {
        toast({
          title: 'Failed to post comment',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5" />
          <span>Comments</span>
          {comments && (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Button */}
        {user && !showCommentForm && (
          <Button
            variant="outline"
            onClick={() => setShowCommentForm(true)}
            className="w-full"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Add Comment
          </Button>
        )}

        {/* Comment Form */}
        {showCommentForm && (
          <Card className="border-dashed">
            <CardContent className="p-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Share your thoughts about this auction..."
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex space-x-2">
                    <Button
                      type="submit"
                      disabled={isPending}
                      size="sm"
                    >
                      {isPending ? (
                        'Posting...'
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Post Comment
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCommentForm(false);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Comments List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comments && comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No comments yet. Be the first to share your thoughts!</p>
          </div>
        )}

        {/* Login prompt for non-authenticated users */}
        {!user && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Please log in to comment on this auction</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentItem({ comment }: { comment: NostrEvent }) {
  const author = useAuthor(comment.pubkey);
  const displayName = author.data?.metadata?.name ?? genUserName(comment.pubkey);
  const profileImage = author.data?.metadata?.picture;

  return (
    <div className="flex space-x-3 p-4 border rounded-lg">
      <Avatar className="h-8 w-8">
        <AvatarImage src={profileImage} />
        <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className="font-medium text-sm">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at * 1000), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
      </div>
    </div>
  );
}