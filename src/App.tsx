import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { useSovereignSync } from "@/hooks/useSovereignSync";

import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import MetaphorAuthCallback from "./pages/MetaphorAuthCallback";
import Onboarding from "./pages/Onboarding";
import HqShell from "./components/atlas/HqShell";
import HqRevenueEngine from "./pages/hq/HqRevenueEngine";
import HqLeadDetail from "./pages/hq/HqLeadDetail";
import HqProposal from "./pages/hq/HqProposal";
import HqReport from "./pages/hq/HqReport";
import HqSettings from "./pages/hq/HqSettings";
import HqPartnerships from "./pages/hq/HqPartnerships";
import HqMediaJobs from "./pages/hq/HqMediaJobs";
import PublicProfile from "./pages/PublicProfile";
import Landing from "./pages/Landing";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";

const SovereignSyncWrapper = ({ children }: { children: React.ReactNode }) => {
  useSovereignSync();
  return <>{children}</>;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SovereignSyncWrapper>
          <AuthProvider>
          <Routes>
            {/* ── Home: Inbound Capture Surface ─────────────────────────── */}
            <Route path="/" element={<Landing />} />

            {/* ── Auth ─────────────────────────────────────────────────── */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/metaphor/callback" element={<MetaphorAuthCallback />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* ── Sovereign Acquisition Flow (Single Shell) ────────────── */}
            <Route path="/hq" element={<HqShell />}>
              <Route index element={<Navigate to="/hq/engine" replace />} />
              {/* Unified Revenue Engine */}
              <Route path="engine" element={<HqRevenueEngine />} />
              
              {/* Vault-accessible pages */}
              <Route path="leads/:id" element={<HqLeadDetail />} />
              <Route path="leads/:id/proposal" element={<HqProposal />} />
              <Route path="report" element={<HqReport />} />
              <Route path="partnerships" element={<HqPartnerships />} />
              <Route path="media-jobs" element={<HqMediaJobs />} />
              <Route path="settings" element={<HqSettings />} />
            </Route>

            {/* ── Legacy redirects (don't break bookmarks) ─────────────── */}
            <Route path="/flow" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/flow" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/dashboard" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/recon" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/discover" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/team" element={<Navigate to="/hq/settings" replace />} />
            <Route path="/hq/prospects" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/leads" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/pipeline" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/outreach" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/icp" element={<Navigate to="/hq/engine" replace />} />
            <Route path="/hq/proposal" element={<Navigate to="/hq/leads" replace />} />
            <Route path="/landing" element={<Navigate to="/hq/icp" replace />} />
            <Route path="/start" element={<Navigate to="/hq/icp" replace />} />
            <Route path="/map/starter" element={<Navigate to="/hq/icp" replace />} />
            <Route path="/app" element={<Navigate to="/hq/icp" replace />} />
            <Route path="/app/*" element={<Navigate to="/hq/icp" replace />} />

            {/* ── Public ───────────────────────────────────────────────── */}
            <Route path="/:handle" element={<PublicProfile />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AuthProvider>
        </SovereignSyncWrapper>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
