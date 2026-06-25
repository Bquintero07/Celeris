import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CurrencyProvider } from "@/lib/currency";
import { EventDetail } from "../EventDetail";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

// GET /events/:id returns a flat shape ({ ...event, items }) — not { event, items }.
const mockEvent = {
  id: "evt-1",
  title: "Test Concert",
  event_type: "concierto",
  status: "borrador",
  approval_status: "draft",
  budget: 1000,
  revenue: 2000,
  attendees: 50,
  description: "desc",
  ai_prompt: null,
  ai_summary: null,
  client_id: null,
  start_date: null,
  end_date: null,
  location: null,
  items: [],
};

vi.mock("@/lib/api", () => ({
  api: {
    events: {
      get: vi.fn(() => Promise.resolve(mockEvent)),
      update: vi.fn(),
      items: { add: vi.fn(), update: vi.fn(), delete: vi.fn() },
    },
    personnel: { list: vi.fn(() => Promise.resolve([])) },
    clients: { list: vi.fn(() => Promise.resolve([])) },
    templates: { list: vi.fn(() => Promise.resolve([])) },
    roles: { mine: vi.fn(() => Promise.resolve(["admin"])) },
    approval: {},
  },
}));

function renderEventDetail() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CurrencyProvider>
        <MemoryRouter initialEntries={["/events/evt-1"]}>
          <Routes>
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </MemoryRouter>
      </CurrencyProvider>
    </QueryClientProvider>,
  );
}

describe("EventDetail", () => {
  it("renders the loaded event instead of getting stuck on Loading (regression for the data.event bug)", async () => {
    renderEventDetail();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

    expect(screen.getByDisplayValue("Test Concert")).toBeInTheDocument();
  });
});
