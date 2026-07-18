import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

import Landing from "./pages/Landing";
import StartMap from "./pages/StartMap";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
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
import HqDashboard from "./pages/hq/HqDashboard";
import HqSettings from "./pages/hq/HqSettings";
import HqTeam from "./pages/hq/HqTeam";
import PublicProfile from "./pages/PublicProfile";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/start" element={<StartMap />} />
            <Route path="/map/starter" element={<Navigate to="/start" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
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
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<HqDashboard />} />
              <Route path="prospects" element={<Sourcing />} />
              <Route path="settings" element={<HqSettings />} />
              <Route path="team" element={<HqTeam />} />
            </Route>
            <Route path="/:handle" element={<PublicProfile />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
