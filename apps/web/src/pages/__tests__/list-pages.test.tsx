import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CurrencyProvider } from "@/lib/currency";

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

// api mock — individual tests override specific methods via vi.mocked()
vi.mock("@/lib/api", () => ({
  api: {
    dashboard: { stats: vi.fn() },
    events:    { list: vi.fn() },
    clients:   { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    suppliers: { list: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    personnel: { list: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    equipment: { list: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    roles:     { mine: vi.fn(() => Promise.resolve(["admin"])) },
  },
}));

import { api } from "@/lib/api";
import { Dashboard }   from "../Dashboard";
import { EventsList }  from "../events/EventsList";
import { Clients }     from "../Clients";
import { Suppliers }   from "../Suppliers";
import { Personnel }   from "../Personnel";
import { Inventory }   from "../Inventory";

// ── Render helper ─────────────────────────────────────────────────────────────

function renderPage(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CurrencyProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </CurrencyProvider>
    </QueryClientProvider>,
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const DASHBOARD_DATA = {
  counts:    { events: 3, personnel: 5, suppliers: 2, equipment: 8 },
  financial: { totalBudget: 10000000, totalRevenue: 15000000, margin: 5000000, marginPct: 33.3 },
  upcoming:  [{ id: "e1", title: "Rock Fest", event_type: "concierto", status: "confirmado", start_date: "2026-08-01T00:00:00Z", location: "Bogotá" }],
  recent:    [],
};

describe("Dashboard", () => {
  it("shows heading", async () => {
    vi.mocked(api.dashboard.stats).mockResolvedValue(DASHBOARD_DATA);
    renderPage(<Dashboard />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows KPI values after load", async () => {
    vi.mocked(api.dashboard.stats).mockResolvedValue(DASHBOARD_DATA);
    renderPage(<Dashboard />);
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows upcoming event title after load", async () => {
    vi.mocked(api.dashboard.stats).mockResolvedValue(DASHBOARD_DATA);
    renderPage(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Rock Fest")).toBeInTheDocument());
  });

  it("shows empty state when no upcoming events", async () => {
    vi.mocked(api.dashboard.stats).mockResolvedValue({ ...DASHBOARD_DATA, upcoming: [] });
    renderPage(<Dashboard />);
    await waitFor(() => expect(screen.getByText(/No scheduled events/i)).toBeInTheDocument());
  });
});

// ── EventsList ────────────────────────────────────────────────────────────────

describe("EventsList", () => {
  it("shows heading", () => {
    vi.mocked(api.events.list).mockResolvedValue([]);
    renderPage(<EventsList />);
    expect(screen.getByText("Events")).toBeInTheDocument();
  });

  it("shows empty state when no events", async () => {
    vi.mocked(api.events.list).mockResolvedValue([]);
    renderPage(<EventsList />);
    await waitFor(() => expect(screen.getByText(/No events yet/i)).toBeInTheDocument());
  });

  it("shows event titles after load", async () => {
    vi.mocked(api.events.list).mockResolvedValue([
      { id: "e1", title: "Rock Fest", event_type: "concierto", status: "confirmado", start_date: null, location: "Bogotá", budget: 5000000, revenue: 7000000 },
    ]);
    renderPage(<EventsList />);
    await waitFor(() => expect(screen.getByText("Rock Fest")).toBeInTheDocument());
  });
});

// ── Clients ───────────────────────────────────────────────────────────────────

describe("Clients", () => {
  it("shows heading", () => {
    vi.mocked(api.clients.list).mockResolvedValue([]);
    renderPage(<Clients />);
    expect(screen.getByText("Clients")).toBeInTheDocument();
  });

  it("shows client name after load", async () => {
    vi.mocked(api.clients.list).mockResolvedValue([
      { id: "c1", name: "Acme Corp", contact_name: "Juan", email: "juan@acme.com", phone: null, address: null, tax_id: null, notes: null },
    ]);
    renderPage(<Clients />);
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
  });

  it("shows empty table when no clients", async () => {
    vi.mocked(api.clients.list).mockResolvedValue([]);
    renderPage(<Clients />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByRole("row", { name: /acme/i })).not.toBeInTheDocument();
  });
});

// ── Suppliers ─────────────────────────────────────────────────────────────────

describe("Suppliers", () => {
  it("shows heading", () => {
    vi.mocked(api.suppliers.list).mockResolvedValue([]);
    renderPage(<Suppliers />);
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
  });

  it("shows supplier name after load", async () => {
    vi.mocked(api.suppliers.list).mockResolvedValue([
      { id: "s1", name: "Luces Pro", category: "Iluminación", type: "externo", contact_name: null, email: null, phone: null, website: null, rating: null, notes: null },
    ]);
    renderPage(<Suppliers />);
    await waitFor(() => expect(screen.getByText("Luces Pro")).toBeInTheDocument());
  });
});

// ── Personnel ─────────────────────────────────────────────────────────────────

describe("Personnel", () => {
  it("shows heading", () => {
    vi.mocked(api.personnel.list).mockResolvedValue([]);
    renderPage(<Personnel />);
    expect(screen.getByText("Personnel")).toBeInTheDocument();
  });

  it("shows person name after load", async () => {
    vi.mocked(api.personnel.list).mockResolvedValue([
      { id: "p1", full_name: "María López", role: "Stage Manager", skills: [], available: true, hourly_rate: 80000, email: null, phone: null, notes: null },
    ]);
    renderPage(<Personnel />);
    await waitFor(() => expect(screen.getByText("María López")).toBeInTheDocument());
  });
});

// ── Inventory ─────────────────────────────────────────────────────────────────

describe("Inventory", () => {
  it("shows heading", () => {
    vi.mocked(api.equipment.list).mockResolvedValue([]);
    renderPage(<Inventory />);
    expect(screen.getByText("Inventory")).toBeInTheDocument();
  });

  it("shows equipment name after load", async () => {
    vi.mocked(api.equipment.list).mockResolvedValue([
      { id: "eq1", name: "Mesa de sonido", category: "audio_video", quantity: 1, unit_cost: 500000, condition: "bueno", location: "Bodega A", notes: null },
    ]);
    renderPage(<Inventory />);
    await waitFor(() => expect(screen.getByText("Mesa de sonido")).toBeInTheDocument());
  });

  it("shows category label (not raw DB value)", async () => {
    vi.mocked(api.equipment.list).mockResolvedValue([
      { id: "eq1", name: "Pantalla LED", category: "audio_video", quantity: 2, unit_cost: 300000, condition: null, location: null, notes: null },
    ]);
    renderPage(<Inventory />);
    await waitFor(() => expect(screen.getByText("Audio / Video")).toBeInTheDocument());
  });
});
