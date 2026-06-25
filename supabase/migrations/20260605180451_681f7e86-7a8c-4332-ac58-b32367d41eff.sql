ALTER TABLE public.event_items DROP COLUMN total_cost;
ALTER TABLE public.event_items ALTER COLUMN quantity TYPE numeric(14,2);
ALTER TABLE public.event_items ALTER COLUMN unit_cost TYPE numeric(18,2);
ALTER TABLE public.event_items ADD COLUMN total_cost numeric(20,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED;
ALTER TABLE public.events ALTER COLUMN budget TYPE numeric(20,2);
ALTER TABLE public.events ALTER COLUMN revenue TYPE numeric(20,2);
ALTER TABLE public.suppliers ALTER COLUMN rating TYPE numeric(4,2);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='personnel' AND column_name='hourly_rate') THEN
    EXECUTE 'ALTER TABLE public.personnel ALTER COLUMN hourly_rate TYPE numeric(18,2)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment' AND column_name='daily_rate') THEN
    EXECUTE 'ALTER TABLE public.equipment ALTER COLUMN daily_rate TYPE numeric(18,2)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment' AND column_name='purchase_price') THEN
    EXECUTE 'ALTER TABLE public.equipment ALTER COLUMN purchase_price TYPE numeric(18,2)';
  END IF;
END $$;