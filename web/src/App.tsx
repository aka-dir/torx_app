import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SorterSessionProvider } from "@/context/SorterSessionContext";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import ImageSorter from "./pages/ImageSorter";
import InventorySlots from "./pages/InventorySlots";
import GoldenSets from "./pages/GoldenSets";
import FeedbackPage from "./pages/FeedbackPage";
import Settings from "./pages/Settings";
import DevDashboard from "./pages/DevDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const skipAuth =
  import.meta.env.VITE_SKIP_AUTH === "true" || import.meta.env.VITE_SKIP_AUTH === "1";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-right" />
      <BrowserRouter>
        <SorterSessionProvider>
          <Routes>
          <Route path="/" element={skipAuth ? <Navigate to="/sorter" replace /> : <Login />} />
          <Route path="/sorter" element={<ImageSorter />} />
          <Route path="/slots" element={<InventorySlots />} />
          <Route path="/golden-sets" element={<GoldenSets />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/dev-dashboard" element={<DevDashboard />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </SorterSessionProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
