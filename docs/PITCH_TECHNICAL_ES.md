# Celeris — Pitch Técnico

**Formato:** Presentación técnica con código y diagramas  
**Audiencia:** Desarrolladores senior, tech leads, CTOs técnicos, jurado de hackathon / Riwi  
**Duración:** ≤ 6 minutos  
**Idioma:** Español

---

## [0:00 – 0:45] ¿Qué es Celeris?

Celeris es un SaaS multi-tenant de marca blanca para operaciones de eventos ATL/BTL.

Un solo workspace que reemplaza: cotizaciones por WhatsApp, Excel de presupuesto, listas de crew en papel y PDFs sin control de versiones.

Desde la perspectiva técnica: es un monorepo con tres servicios desplegados independientemente, autenticación delegada a Supabase y un agente de IA en Python para generación de cotizaciones.

---

## [0:45 – 2:00] Stack y arquitectura

```
Browser (React SPA)
    │ REST + Bearer JWT
    ▼
apps/api  ─────────────────────────────  Node 20 + Express + Prisma
    │ jose.jwtVerify                      $queryRaw (no ORM, SQL explícito)
    ▼
Supabase Auth  (solo verificación JWT)
    │
    ▼
PostgreSQL en Supabase  (RLS habilitado en todas las tablas)
    │
    ▼ POST /quote/suggest
agent/  ─────────────────────────────────  Python 3.12 + FastAPI + OpenAI
```

**Decisión de stack:**
- **Vite + React** (no Next.js): SSR no agrega valor para un dashboard de operaciones B2B — todo el contenido es privado y autenticado.
- **Express + Prisma $queryRaw**: todos los queries usan tagged template literals. Sin ORM mágico, sin N+1 ocultos, SQL visible en code review.
- **Supabase para Auth y Storage únicamente**: el frontend NUNCA toca la base de datos directamente. Solo llama a `signInWithPassword`, `getSession` y `signOut`. Todos los datos van por la API.
- **FastAPI + OpenAI**: el agente de IA es un servicio independiente porque el modelo puede cambiar, mejorarse o reemplazarse sin tocar el core.

---

## [2:00 – 3:30] Decisiones técnicas clave

### 1. Aislamiento multi-tenant

Cada request lleva un `orgId` en el `AuthContext`. Cada `$queryRaw` filtra por `organization_id = ${orgId}`. Supabase RLS actúa como segunda capa de defensa.

Verificado con tests automatizados: capturamos los parámetros de todos los calls a Prisma y asertamos que el orgId del tenant A nunca aparece en queries del tenant B.

### 2. RBAC compartido (API + frontend)

`packages/shared/src/permissions.ts` define el mapa de permisos para los 6 roles:
- `admin` → wildcard `*`
- `comercial`, `contable`, `logistica`, `personal`, `viewer` → listas explícitas

La función `can(roles, permission)` es pura — sin estado, sin DB. Se usa idéntica en el middleware de la API y en el frontend para mostrar/ocultar secciones de la UI. Una sola fuente de verdad.

### 3. Cost engine y protección de márgenes

```
unit_cost  = precio de venta (lo que paga el cliente)
base_cost  = costo real (lo que paga la empresa)
total_cost = GENERATED ALWAYS AS (quantity × unit_cost)
```

`total_cost` es una columna generada en PostgreSQL — nunca se puede insertar ni actualizar. Elimina una clase completa de bugs de desincronización.

El margen está protegido por el permiso `quotes.view_margin`. Roles sin ese permiso no ven las KPIs de margen ni las columnas de markup en la tabla de ítems.

### 4. Module gating

`enabled_modules text[]` en la tabla `organizations`. El middleware `requireModule(key)` hace un query de una línea antes de cualquier handler. Si el módulo no está en el array, devuelve `403` sin ejecutar nada más. `super_admin` bypassa sin DB call.

### 5. Approval flow como FSM

```
draft → review → approved → sent
                ↓
             rejected → review (re-submit)
```

Transiciones controladas por un mapa `ALLOWED_TRANSITIONS` en el route handler. Cada transición inserta en `approval_log` (append-only). Nunca se borra un registro de auditoría.

---

## [3:30 – 4:30] Seguridad

| Capa | Mecanismo |
|------|-----------|
| Autenticación | Supabase JWT, verificado con `jose` en cada request |
| Autorización | RBAC en middleware antes de llegar al handler |
| Aislamiento de datos | `orgId` en cada `$queryRaw` + RLS en Supabase |
| Gating de módulos | `requireModule()` antes de `requirePermission()` |
| PDF | Columnas de margen ausentes en el PDF de cliente |
| Secretos | `.env` nunca committed; `.gitignore` incluye `.env`, `*.pem` |

**Regla de oro:** El frontend nunca habla a la base de datos. Supabase Auth emite el JWT; la API lo verifica; la API ejecuta los queries. Si la API cae, el frontend no puede leer ni escribir nada.

---

## [4:30 – 5:15] Testing y CI

**58 tests automatizados con Vitest:**

```
permissions.test.ts    (17)  can() — cobertura de los 6 roles + multi-rol + wildcards
cost-engine.test.ts    (11)  calcMargins(), IVA 19%, encoding markup→unit_cost
middleware.test.ts     (16)  requireModule() × 6 casos, requirePermission() × 10 casos
tenant-isolation.test.ts(14) cada service incluye orgId; otro tenant nunca aparece
```

**ESM + Vitest:** el monorepo usa `"module": "NodeNext"`. Se requiere `pool: "forks"` en vitest.config para que los imports dinámicos ESM funcionen en el test runner.

**CI con GitHub Actions:**
```
PR → Lint (tsc --noEmit en shared + api + web)
   → Build (shared → api → web) [paralelo con Tests]
   → Tests (58 tests + upload coverage artifact)
```

---

## [5:15 – 6:00] Deploy y conclusión

**Deploy en 3 plataformas con cero infraestructura propia:**

| Servicio | Plataforma | Costo inicial |
|---------|-----------|---------------|
| Web | Vercel (free) | $0 |
| API | Render (free) | $0 |
| Agent | Render (free) | $0 |
| DB + Auth + Storage | Supabase (free) | $0 |
| **Total** | | **$0/mes** |

El blueprint `render.yaml` define ambos servicios de Render en un archivo. `apps/web/vercel.json` configura el buildCommand y el rewrite SPA. El build de `packages/shared` corre primero en ambas plataformas para que el dist esté disponible en producción.

**Lo que construimos:**
- Multi-tenant con aislamiento verificado por tests
- RBAC compartido frontend/backend desde una sola fuente
- Cost engine con columna generada y protección de márgenes
- Approval flow con log de auditoría append-only
- AI como servicio desacoplado (intercambiable)
- CI completo: lint → build → 58 tests en GitHub Actions
- Deploy en Vercel + Render + Supabase sin infra propia

Celeris está listo para onboarding de los primeros clientes.
