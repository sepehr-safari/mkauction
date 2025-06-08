# Nostr Art Auctions

A decentralized art auction platform built on the Nostr protocol with Lightning Network payments. Discover, bid on, and sell unique digital artworks in a censorship-resistant environment.

![Nostr Art Auctions](https://img.shields.io/badge/Nostr-Art%20Auctions-purple?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.x-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css)
![Lightning](https://img.shields.io/badge/Lightning-Network-yellow?style=for-the-badge)

## ✨ Features

- **🎨 Art Auctions**: Create and participate in time-based art auctions
- **⚡ Lightning Payments**: Instant Bitcoin payments via Lightning Network
- **🔄 Smart Extensions**: Auto-extending auctions for fair bidding
- **🌍 Global Shipping**: Support for local and international shipping
- **🔐 Decentralized**: Built on Nostr protocol - no central authority
- **📱 Responsive**: Works seamlessly on desktop and mobile
- **🌙 Dark Mode**: Complete light/dark theme support
- **🔒 Secure**: WebLN integration for secure Lightning payments

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Nostr client extension (like Alby, nos2x, or Flamingo)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nostr-art-auctions
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:8080`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests and linting
- `npm run deploy` - Deploy to Surge.sh

## 🏗️ Technology Stack

### Core Technologies
- **React 18.x** - Modern React with hooks and concurrent rendering
- **TypeScript 5.x** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **TailwindCSS 3.x** - Utility-first CSS framework

### Nostr Integration
- **Nostrify** - Nostr protocol framework for web
- **nostr-tools** - Nostr utilities and cryptography
- **@nostrify/react** - React hooks for Nostr integration

### UI Components
- **shadcn/ui** - 48+ accessible UI components built with Radix UI
- **Radix UI** - Unstyled, accessible component primitives
- **Lucide React** - Beautiful icon library
- **next-themes** - Theme management system

### State Management & Data
- **TanStack Query** - Data fetching, caching, and synchronization
- **React Hook Form** - Performant forms with easy validation
- **Zod** - TypeScript-first schema validation

### Routing & Navigation
- **React Router 6** - Client-side routing with BrowserRouter
- **ScrollToTop** - Automatic scroll restoration

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # shadcn/ui components (48+ components)
│   ├── auth/            # Authentication components
│   ├── NostrProvider.tsx # Nostr protocol integration
│   └── Layout.tsx       # Main layout component
├── hooks/               # Custom React hooks
│   ├── useNostr.ts      # Core Nostr integration
│   ├── useAuthor.ts     # Fetch user profiles
│   ├── useCurrentUser.ts # Current user state
│   └── useNostrPublish.ts # Publish events
├── pages/               # Page components
│   ├── Index.tsx        # Landing page
│   ├── AuctionsPage.tsx # Browse auctions
│   ├── AuctionDetailsPage.tsx # Individual auction
│   ├── DashboardPage.tsx # User dashboard
│   └── NotFound.tsx     # 404 page
├── contexts/            # React context providers
│   └── AppContext.tsx   # Global app configuration
├── lib/                 # Utility functions
├── test/                # Testing utilities
├── App.tsx              # Main app component
└── AppRouter.tsx        # Route configuration
```

## 🎯 Core Features

### Auction System

The platform implements a sophisticated auction system with the following features:

- **Time-based Auctions**: Set start times and durations
- **Auto-extending**: Bids in the last 5 minutes extend the auction
- **Reserve Prices**: Optional minimum selling prices
- **Shipping Integration**: Local and international shipping options
- **Real-time Updates**: Live auction status via Nostr events

### Nostr Protocol Integration

Built on custom NIP (Nostr Implementation Possibility) defining:

- **Kind 30020**: Auction Listings (replaceable events)
- **Kind 1021**: Bids
- **Kind 1022**: Bid Confirmations  
- **Kind 1023**: Auction Status Updates

### Lightning Network Payments

- **WebLN Integration**: Seamless Lightning wallet connectivity
- **Instant Payments**: Pay in satoshis with immediate settlement
- **NIP-57 Zaps**: Lightning payments integrated with Nostr
- **Payment Requests**: Encrypted payment coordination

## 🔧 Development

### Custom Hooks

The application provides several custom hooks for Nostr integration:

```typescript
// Query Nostr data
const { nostr } = useNostr();
const auctions = useQuery({
  queryKey: ['auctions'],
  queryFn: () => nostr.query([{ kinds: [30020] }])
});

// Get user profile
const author = useAuthor(pubkey);
const displayName = author.data?.metadata?.name;

// Publish events
const { mutate: publish } = useNostrPublish();
publish({ kind: 1021, content: JSON.stringify(bidData) });

// Current user state
const { user } = useCurrentUser();
```

### Component Architecture

Built with shadcn/ui components for consistency and accessibility:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoginArea } from '@/components/auth/LoginArea';
```

### Theme System

Complete light/dark mode support:

```typescript
import { useTheme } from '@/hooks/useTheme';

const { theme, setTheme } = useTheme();
setTheme('dark'); // or 'light'
```

## 🧪 Testing

The project includes comprehensive testing setup:

- **Vitest** - Fast unit testing framework
- **React Testing Library** - Component testing utilities
- **jsdom** - Browser environment simulation
- **TypeScript** - Type checking in tests

```bash
npm run test  # Run all tests
```

### Test Structure

```typescript
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { MyComponent } from './MyComponent';

test('renders correctly', () => {
  render(
    <TestApp>
      <MyComponent />
    </TestApp>
  );
  expect(screen.getByText('Expected text')).toBeInTheDocument();
});
```

## 🌐 Deployment

### Production Build

```bash
npm run build
```

Creates optimized production build in `dist/` directory.

### Deploy to Surge.sh

```bash
npm run deploy
```

Automatically builds and deploys to Surge.sh hosting.

### Environment Configuration

The app connects to Nostr relays with these defaults:

- **Primary**: `wss://relay.nostr.band`
- **Alternatives**: Ditto, Damus, Primal relays

Configure via the relay selector in the UI.

## 🔐 Security

### Nostr Security
- **Private Key Protection**: Never requests private keys directly
- **NIP-07 Signers**: Uses browser extension signers
- **Event Validation**: Validates all incoming Nostr events
- **Encrypted Messages**: NIP-04 encryption for sensitive data

### Lightning Security
- **WebLN Integration**: Secure Lightning wallet connectivity
- **Payment Verification**: Cryptographic payment proofs
- **Amount Validation**: Client and server-side amount checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use provided custom hooks for Nostr integration
- Implement proper loading states with skeletons
- Add tests for new components
- Follow shadcn/ui patterns for new UI components

## 📚 Documentation

### Nostr Protocol
- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) - Basic protocol flow
- [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) - Browser extension interface
- [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md) - Lightning Zaps

### Lightning Network
- [WebLN Guide](https://webln.guide/) - WebLN integration
- [Lightning Labs](https://lightning.engineering/) - Lightning Network resources

### UI Components
- [shadcn/ui](https://ui.shadcn.com/) - Component documentation
- [Radix UI](https://radix-ui.com/) - Primitive components
- [Tailwind CSS](https://tailwindcss.com/) - Utility classes

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Nostr Protocol** - Decentralized social networking protocol
- **Lightning Network** - Bitcoin's layer 2 payment solution
- **shadcn/ui** - Beautiful and accessible UI components
- **Nostrify** - Excellent Nostr development framework

---

**Built with ❤️ for the decentralized web**

*Connect your Nostr identity and start exploring the future of digital art auctions!*