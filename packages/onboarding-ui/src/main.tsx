import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import { OnboardingLayout } from "./components/OnboardingLayout";
import Welcome from "./pages/onboarding/01-welcome";
import Goal from "./pages/onboarding/02-goal";
import Connectors from "./pages/onboarding/03-connectors";
import OrgDesign from "./pages/onboarding/04-org-design";
import TemplatePicker from "./pages/onboarding/05-template-picker";
import KpiOwnership from "./pages/onboarding/06-kpi-ownership";
import CustomizeChat from "./pages/onboarding/07-customize-chat";
import ManifestReview from "./pages/onboarding/08-manifest-review";
import Spawn from "./pages/onboarding/09-spawn";
import Handoff from "./pages/onboarding/10-handoff";
import Subscription from "./pages/onboarding/11-subscription";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/onboarding/welcome" replace />} />
        <Route path="/onboarding" element={<OnboardingLayout />}>
          <Route index element={<Navigate to="welcome" replace />} />
          <Route path="welcome" element={<Welcome />} />
          <Route path="goal" element={<Goal />} />
          <Route path="connectors" element={<Connectors />} />
          <Route path="org-design" element={<OrgDesign />} />
          <Route path="template-picker" element={<TemplatePicker />} />
          <Route path="kpi-ownership" element={<KpiOwnership />} />
          <Route path="customize-chat" element={<CustomizeChat />} />
          <Route path="manifest-review" element={<ManifestReview />} />
          <Route path="spawn" element={<Spawn />} />
          <Route path="handoff" element={<Handoff />} />
          <Route path="subscription" element={<Subscription />} />
        </Route>
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
