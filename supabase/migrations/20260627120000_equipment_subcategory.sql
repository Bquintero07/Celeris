-- Add a free-text subcategory to inventory items (e.g. "PA", "robótica", "truss").
-- Keeps the shared item_category enum untouched; the master families map onto the
-- existing enum values and the depth lives here.

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS subcategory text;
