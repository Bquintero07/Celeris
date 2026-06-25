import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export async function marginsByEvent(ctx: AuthContext, since?: string, until?: string) {
  if (!ctx.orgId) return [];
  const from = since ?? new Date(Date.now() - 90 * 86400_000).toISOString();
  const to   = until ?? new Date().toISOString();

  return prisma.$queryRaw<any[]>`
    SELECT
      e.id,
      e.title,
      e.event_type,
      e.status,
      e.start_date,
      e.revenue,
      COALESCE(SUM(ei.total_cost), 0)                          AS total_cost,
      e.revenue - COALESCE(SUM(ei.total_cost), 0)              AS margin,
      CASE WHEN e.revenue > 0
        THEN ROUND(((e.revenue - COALESCE(SUM(ei.total_cost),0)) / e.revenue * 100)::numeric, 2)
        ELSE 0
      END                                                       AS margin_pct
    FROM public.events e
    LEFT JOIN public.event_items ei ON ei.event_id = e.id
    WHERE e.organization_id = ${ctx.orgId}::uuid
      AND (e.start_date IS NULL OR e.start_date BETWEEN ${from}::timestamptz AND ${to}::timestamptz)
    GROUP BY e.id, e.title, e.event_type, e.status, e.start_date, e.revenue
    ORDER BY e.start_date DESC NULLS LAST
  `;
}

export async function marginsByClient(ctx: AuthContext, since?: string, until?: string) {
  if (!ctx.orgId) return [];
  const from = since ?? new Date(Date.now() - 90 * 86400_000).toISOString();
  const to   = until ?? new Date().toISOString();

  return prisma.$queryRaw<any[]>`
    SELECT
      COALESCE(c.id::text, 'unknown')                           AS client_id,
      COALESCE(c.name, 'No client')                             AS client_name,
      COUNT(e.id)::int                                          AS event_count,
      COALESCE(SUM(e.revenue), 0)                               AS total_revenue,
      COALESCE(SUM(ei_sum.cost), 0)                             AS total_cost,
      COALESCE(SUM(e.revenue), 0) - COALESCE(SUM(ei_sum.cost), 0) AS margin
    FROM public.events e
    LEFT JOIN public.clients c ON c.id = e.client_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(total_cost), 0) AS cost
      FROM public.event_items
      WHERE event_id = e.id
    ) ei_sum ON true
    WHERE e.organization_id = ${ctx.orgId}::uuid
      AND (e.start_date IS NULL OR e.start_date BETWEEN ${from}::timestamptz AND ${to}::timestamptz)
    GROUP BY c.id, c.name
    ORDER BY total_revenue DESC
  `;
}

export async function revenueByPeriod(ctx: AuthContext, since?: string, until?: string) {
  if (!ctx.orgId) return [];
  const from = since ?? new Date(Date.now() - 365 * 86400_000).toISOString();
  const to   = until ?? new Date().toISOString();

  return prisma.$queryRaw<any[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', e.start_date), 'YYYY-MM')    AS month,
      COALESCE(SUM(e.revenue), 0)                              AS revenue,
      COALESCE(SUM(ei_sum.cost), 0)                            AS cost,
      COALESCE(SUM(e.revenue), 0) - COALESCE(SUM(ei_sum.cost),0) AS margin
    FROM public.events e
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(total_cost), 0) AS cost
      FROM public.event_items WHERE event_id = e.id
    ) ei_sum ON true
    WHERE e.organization_id = ${ctx.orgId}::uuid
      AND e.start_date IS NOT NULL
      AND e.start_date BETWEEN ${from}::timestamptz AND ${to}::timestamptz
    GROUP BY DATE_TRUNC('month', e.start_date)
    ORDER BY 1
  `;
}
