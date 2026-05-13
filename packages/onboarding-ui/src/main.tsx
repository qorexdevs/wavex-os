import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MissionControl from "./pages/MissionControl";
import Pricing from "./pages/Pricing";
import { CompanyProvider } from "./op-omega/lib/CompanyContext";
import { OmegaOnboarding } from "./op-omega/OmegaOnboarding";
import { OnboardingShell } from "./op-omega/pages/OnboardingShell";
import { AvatarDashboard } from "./pages/AvatarDashboard";
import { AvatarSettings } from "./pages/AvatarSettings";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CompanyProvider>
          <Routes>
            <Route path="/" element={<MissionControl />} />
            <Route path="/onboarding" element={<OmegaOnboarding />} />
            <Route path="/onboarding-chat" element={<OnboardingShell />} />
            <Route path="/avatar/:id" element={<AvatarDashboard />} />
            <Route path="/avatar/:id/settings" element={<AvatarSettings />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CompanyProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
