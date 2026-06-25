# Celeris scaffold — what's here and what's next

This is the starting skeleton (Option B: clean replicate, React + Tailwind + pnpm, NO TanStack Start).

## Wired patterns already included
- pnpm workspace: apps/web, apps/api, packages/shared, agent
- apps/api: Express + Prisma singleton + auth (JWT) + module guard + rbac guard + sample events route
- apps/web: Vite + React 19 + Tailwind v4, supabase (auth only), API client, tenant-config theming, module-gated nav
- packages/shared: permissions map + module catalog + shared types (the contract)
- agent: FastAPI + OpenAI with the /quote/suggest contract
- docker-compose + Dockerfiles

## First commands
- `pnpm install`
- API: set DATABASE_URL, then `pnpm --filter @celeris/api prisma:pull` && `pnpm dev:api`
- Web: `pnpm dev:web`
- Agent: `cd agent && pip install -r requirements.txt && uvicorn app.main:app --reload`

## Next with Claude Code (in order)
1. `prisma db pull` and fix model/field names referenced in auth.ts / events.service.ts.
2. Copy shadcn components + page UIs from the old repo into apps/web.
3. Add routers: inventory, suppliers, personnel, quotes, super-admin (copy the events pattern).
4. Add migrations: RBAC event-scope + event_items margin fields.
5. Wire the Quote Builder + /quotes/:id/ai-suggest -> agent.
6. Translate to English, Dockerize check, deploy (Vercel web, Render api + agent).
