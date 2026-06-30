import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const dashboardRouter = Router();

type CountsRow = { events: bigint; personnel: bigint; suppliers: bigint; equipment: bigint };
type FinancialRow = { total_budget: string | null; total_revenue: string | null };
type EventRow = { id: string; title: string; start_date: Date | null; event_type: string; status: string };

// GET /api/dashboard/stats
dashboardRouter.get("/stats", async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "Sin organización" });

  const [counts, financial, upcoming, recent] = await Promise.all([
    prisma.$queryRaw<CountsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM public.events    WHERE organization_id = ${orgId}::uuid) AS events,
        (SELECT COUNT(*) FROM public.personnel WHERE organization_id = ${orgId}::uuid) AS personnel,
        (SELECT COUNT(*) FROM public.suppliers WHERE organization_id = ${orgId}::uuid) AS suppliers,
        (SELECT COUNT(*) FROM public.equipment WHERE organization_id = ${orgId}::uuid) AS equipment
    `,
    prisma.$queryRaw<FinancialRow[]>`
      SELECT SUM(budget)::text AS total_budget, SUM(revenue)::text AS total_revenue
      FROM public.events WHERE organization_id = ${orgId}::uuid
    `,
    prisma.$queryRaw<EventRow[]>`
      SELECT id, title, start_date, event_type, status FROM public.events
      WHERE organization_id = ${orgId}::uuid
        AND start_date >= date_trunc('day', now()) AND status <> 'cancelado'
      ORDER BY start_date ASC LIMIT 5
    `,
    prisma.$queryRaw<EventRow[]>`
      SELECT id, title, start_date, event_type, status FROM public.events
      WHERE organization_id = ${orgId}::uuid
      ORDER BY created_at DESC LIMIT 5
    `,
  ]);

  const c = counts[0];
  const totalBudget = Number(financial[0]?.total_budget ?? 0);
  const totalRevenue = Number(financial[0]?.total_revenue ?? 0);
  const margin = totalRevenue - totalBudget;
  const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

  res.json({
    counts: {
      events:     Number(c?.events ?? 0),
      personnel:  Number(c?.personnel ?? 0),
      suppliers:  Number(c?.suppliers ?? 0),
      equipment:  Number(c?.equipment ?? 0),
    },
    financial: { totalBudget, totalRevenue, margin, marginPct },
    upcoming,
    recent,
  });
});
