import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RelaySelector } from '@/components/RelaySelector';
import { Palette, Home, Plus, Gavel, User } from 'lucide-react';

export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-orange-500 rounded-lg">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-purple-600 to-orange-600 bg-clip-text text-transparent">
              Nostr Art Auctions
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            <Button
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Link>
            </Button>
            
            <Button
              variant={isActive('/auctions') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/auctions">
                <Gavel className="h-4 w-4 mr-2" />
                Auctions
              </Link>
            </Button>
            
            <Button
              variant={isActive('/dashboard') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/dashboard">
                <User className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            
            <Button
              variant={isActive('/create-auction') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/create-auction">
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Link>
            </Button>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-2">
            <div className="hidden sm:block">
              <RelaySelector />
            </div>
            <ThemeToggle />
            <LoginArea className="max-w-48" />
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex items-center space-x-1">
            <Button
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Link>
            </Button>
            
            <Button
              variant={isActive('/auctions') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/auctions">
                <Gavel className="h-4 w-4 mr-2" />
                Auctions
              </Link>
            </Button>
            
            <Button
              variant={isActive('/create-auction') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/create-auction">
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Link>
            </Button>
          </div>
          
          <div className="mt-2 sm:hidden">
            <RelaySelector className="w-full" />
          </div>
        </div>
      </div>
    </nav>
  );
}