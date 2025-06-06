import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { Layout } from "./components/Layout";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AuctionsPage } from "./pages/AuctionsPage";
import { AuctionDetailsPage } from "./pages/AuctionDetailsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CreateAuctionForm } from "./components/CreateAuctionForm";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auctions" element={<AuctionsPage />} />
          <Route path="/auction/:auctionId" element={<AuctionDetailsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/create-auction" element={<CreateAuctionForm />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
export default AppRouter;