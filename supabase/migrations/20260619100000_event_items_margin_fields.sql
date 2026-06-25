-- Margin tracking fields for quote lines in event_items.
-- base_cost = original cost from inventory/agent.
-- unit_cost = selling price per unit (base_cost × (1 + markup_pct/100)).
-- total_cost stays GENERATED AS (quantity × unit_cost) — the revenue line.
-- Idempotent via ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.event_items
  ADD COLUMN IF NOT EXISTS base_cost  numeric(18,2),
  ADD COLUMN IF NOT EXISTS markup_pct numeric(5,2) DEFAULT 0;
