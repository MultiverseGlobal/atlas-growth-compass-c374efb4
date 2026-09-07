import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { useSovereignSync } from "@/hooks/useSovereignSync";

import React, { Suspense } from "react";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import MetaphorAuthCallback from "./pages/MetaphorAuthCallback";
import HqShell from "./components/atlas/HqShell";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";

const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const ObjectivesStudio = React.lazy(() => import("./pages/hq/ObjectivesStudio"));
const HqRevenueEngine = React.lazy(() => import("./pages/hq/HqRevenueEngine"));
const HqLeadDetail = React.lazy(() => import("./pages/hq/HqLeadDetail"));
const HqProposal = React.lazy(() => import("./pages/hq/HqProposal"));
const DailyBriefing = React.lazy(() => import("./pages/hq/DailyBriefing"));
const CommandFeed = React.lazy(() => import("./pages/CommandFeed"));
const HqSettings = React.lazy(() => import("./pages/hq/HqSettings"));
const Objectives = React.lazy(() => import("./pages/Objectives"));
const PublicProfile = React.lazy(() => import("./pages/PublicProfile"));

const SovereignSyncWrapper = ({ children }: { children: React.ReactNode }) => {
  useSovereignSync();
  return <>{children}</>;
};

// Sleek suspense fallback for lazy loaded routes
const PageLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Loading...</span>
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SovereignSyncWrapper>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Sovereign App Shell (Atlas V1 Core Surfaces & Extended) ─ */}
                <Route element={<HqShell />}>
                  <Route path="/" element={<CommandFeed />} />
                  <Route path="/briefing" element={<DailyBriefing />} />
                  <Route path="/objectives" element={<ObjectivesStudio />} />
                  <Route path="/workspace" element={<CommandFeed />} />
                  <Route path="/command" element={<CommandFeed />} />

                  {/* ── Sovereign Pipeline Flow ────────────────────────────── */}
                  <Route path="/hq">
                    <Route index element={<Navigate to="/hq/engine" replace />} />
                    <Route path="engine" element={<HqRevenueEngine />} />
                    <Route path="leads/:id" element={<HqLeadDetail />} />
                    <Route path="leads/:id/proposal" element={<HqProposal />} />
                    <Route path="settings" element={<HqSettings />} />
                  </Route>
                </Route>

                {/* ── Standalone / Public Surfaces ─────────────────────────── */}
                <Route path="/landing" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/metaphor/callback" element={<MetaphorAuthCallback />} />
                <Route path="/onboarding" element={<Onboarding />} />

                {/* ── Legacy redirects ──────────────────────────────────────── */}
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
                <Route path="/hq/report" element={<Navigate to="/hq/engine" replace />} />
                <Route path="/hq/partnerships" element={<Navigate to="/hq/engine" replace />} />
                <Route path="/hq/media-jobs" element={<Navigate to="/hq/engine" replace />} />
                <Route path="/hq/proposal" element={<Navigate to="/hq/engine" replace />} />
                <Route path="/start" element={<Navigate to="/hq/engine" replace />} />
                <Route path="/map/starter" element={<Navigate to="/hq/engine" replace />} />
                <Route path="/app" element={<Navigate to="/hq/engine" replace />} />
                <Route path="/app/*" element={<Navigate to="/hq/engine" replace />} />

                {/* ── Public ───────────────────────────────────────────────── */}
                <Route path="/:handle" element={<PublicProfile />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </SovereignSyncWrapper>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
