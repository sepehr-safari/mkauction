
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginArea } from '@/components/auth/LoginArea';
import { Palette, Zap, Clock, Shield } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-purple-50 via-white to-orange-50 dark:from-purple-950 dark:via-gray-900 dark:to-orange-950">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-orange-500 rounded-full">
              <Palette className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-orange-600 bg-clip-text text-transparent">
            Nostr Art Auctions
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover, bid on, and sell unique digital artworks on the decentralized Nostr network. 
            Lightning-fast payments, global reach, censorship-resistant.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto p-2 bg-orange-100 dark:bg-orange-900 rounded-full w-fit mb-4">
                <Zap className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle>Lightning Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Instant Bitcoin payments via Lightning Network. Pay in satoshis with WebLN integration.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto p-2 bg-purple-100 dark:bg-purple-900 rounded-full w-fit mb-4">
                <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>Smart Auctions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Auto-extending auctions ensure fair bidding. Last-minute bids extend the auction by 5 minutes.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto p-2 bg-green-100 dark:bg-green-900 rounded-full w-fit mb-4">
                <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Decentralized</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Built on Nostr protocol. No central authority, no censorship, global accessibility.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Ready to Start?</h2>
            <p className="text-muted-foreground">
              Connect your Nostr identity to browse auctions or create your first listing
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              onClick={() => navigate('/auctions')}
              className="bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700"
            >
              Browse Auctions
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/create-auction')}
            >
              Create Auction
            </Button>
          </div>

          <div className="pt-8">
            <p className="text-sm text-muted-foreground mb-4">Connect your Nostr account to get started</p>
            <div className="flex justify-center">
              <LoginArea className="max-w-60" />
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default Index;
