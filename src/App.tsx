import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { useSovereignSync } from "@/hooks/useSovereignSync";

import Landing from "./pages/Landing";
import StartMap from "./pages/StartMap";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import MetaphorAuthCallback from "./pages/MetaphorAuthCallback";
import Onboarding from "./pages/Onboarding";
import AppShell from "./components/atlas/AppShell";
import Home from "./pages/app/Home";
import MapDetails from "./pages/app/MapDetails";
import Timeline from "./pages/app/Timeline";
import Reports from "./pages/app/Reports";
import Integrations from "./pages/app/Integrations";
import PublicPagePreview from "./pages/app/PublicPagePreview";
import Settings from "./pages/app/Settings";
import Notifications from "./pages/app/Notifications";
import Sourcing from "./pages/app/Sourcing";
import HqShell from "./components/atlas/HqShell";
import HqFlow from "./pages/hq/HqFlow";
import HqDashboard from "./pages/hq/HqDashboard";
import HqDiscover from "./pages/hq/HqDiscover";
import HqRecon from "./pages/hq/HqRecon";
import HqLeads from "./pages/hq/HqLeads";
import HqLeadDetail from "./pages/hq/HqLeadDetail";
import HqPipeline from "./pages/hq/HqPipeline";
import HqOutreach from "./pages/hq/HqOutreach";
import HqReport from "./pages/hq/HqReport";
import HqProposal from "./pages/hq/HqProposal";
import HqSettings from "./pages/hq/HqSettings";
import HqTeam from "./pages/hq/HqTeam";
import HqICP from "./pages/hq/HqICP";
import PublicProfile from "./pages/PublicProfile";
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
            <Route path="/" element={<Navigate to="/hq/icp" replace />} />
            <Route path="/flow" element={<HqFlow />} />
            <Route path="/hq/flow" element={<HqFlow />} />
            <Route path="/landing" element={<Navigate to="/flow" replace />} />
            <Route path="/start" element={<Navigate to="/flow" replace />} />
            <Route path="/map/starter" element={<Navigate to="/flow" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/metaphor/callback" element={<MetaphorAuthCallback />} />
            <Route path="/onboarding" element={<Onboarding />} />

            <Route path="/app" element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="map/:id" element={<MapDetails />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="reports" element={<Reports />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="page" element={<PublicPagePreview />} />
              <Route path="settings" element={<Settings />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="sourcing" element={<Navigate to="/hq" replace />} />
            </Route>
            <Route path="/hq" element={<HqShell />}>
              <Route index element={<Navigate to="/flow" replace />} />
              <Route path="dashboard" element={<HqDashboard />} />
              <Route path="discover" element={<HqDiscover />} />
              <Route path="recon" element={<HqRecon />} />
              <Route path="leads" element={<HqLeads />} />
              <Route path="leads/:id" element={<HqLeadDetail />} />
              <Route path="leads/:id/proposal" element={<HqProposal />} />
              <Route path="proposal" element={<HqProposal />} />
              <Route path="pipeline" element={<HqPipeline />} />
              <Route path="outreach" element={<HqOutreach />} />
              <Route path="report" element={<HqReport />} />
              <Route path="prospects" element={<Navigate to="/hq/leads" replace />} />
              <Route path="settings" element={<HqSettings />} />
              <Route path="team" element={<HqTeam />} />
              <Route path="icp" element={<HqICP />} />
              <Route index element={<Navigate to="/hq/icp" replace />} />
            </Route>
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
