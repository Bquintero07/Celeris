# Schema = single source of truth

1. Copy the existing migrations from the old repo (`event-ai-genius/supabase/migrations/*`) here.
2. Keep the provided `*_tenant_modules_and_onboarding.sql`.
3. Add the pending ones: RBAC event-scope policy, and quote margin fields on event_items.
4. Apply with: `supabase link --project-ref <YOUR_REF>` then `supabase db push`.
Never edit applied migrations; always add a new file. Prisma only does `db pull`.
