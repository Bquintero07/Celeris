import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Landing } from "./pages/Landing";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Suppliers } from "./pages/Suppliers";
import { Personnel } from "./pages/Personnel";
import { Team } from "./pages/Team";
import { BrandSettings } from "./pages/BrandSettings";
import { Onboarding } from "./pages/Onboarding";
import { Admin } from "./pages/Admin";
import { EventsList } from "./pages/events/EventsList";
import { NewEvent } from "./pages/events/NewEvent";
import { EventDetail } from "./pages/events/EventDetail";
import { Clients } from "./pages/Clients";
import { Analytics } from "./pages/Analytics";
import { Billing } from "./pages/Billing";
import { Chat } from "./pages/Chat";
import { Documents } from "./pages/Documents";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/auth", element: <Auth /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/onboarding", element: <Onboarding /> },
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/events", element: <EventsList /> },
          { path: "/events/new", element: <NewEvent /> },
          { path: "/events/:id", element: <EventDetail /> },
          { path: "/inventory", element: <Inventory /> },
          { path: "/suppliers", element: <Suppliers /> },
          { path: "/personnel", element: <Personnel /> },
          { path: "/clients",   element: <Clients /> },
          { path: "/analytics", element: <Analytics /> },
          { path: "/billing",   element: <Billing /> },
          { path: "/team", element: <Team /> },
          { path: "/brand-settings", element: <BrandSettings /> },
          { path: "/admin", element: <Admin /> },
          { path: "/chat", element: <Chat /> },
          { path: "/documents", element: <Documents /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
