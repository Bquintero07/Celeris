# Documentación de Pruebas — Celeris v1

## Resumen

Celeris v1 tiene una suite de pruebas automáticas distribuida en dos paquetes:

| Paquete | Comando | Tests | Framework |
|---|---|---|---|
| `apps/api` | `pnpm --filter api test` | 116 | Vitest |
| `apps/web` | `pnpm --filter web test` | 8 | Vitest + jsdom + Testing Library |
| **Total** | | **124** | |

Para correr todas las pruebas desde la raíz:

```bash
pnpm --filter api test && pnpm --filter web test
```

---

## Backend (`apps/api`)

Los archivos de prueba están en `apps/api/src/__tests__/`.

### 1. `validate.test.ts` — 58 pruebas

Documenta el middleware de validación de entradas (`src/lib/validate.ts`) y los enums de la base de datos.

#### Middleware `validate(schema)`

| Escenario | Resultado esperado |
|---|---|
| Body válido | `next()` llamado, `req.body` reemplazado con datos parseados |
| Campo requerido ausente | `400` — `{ error: "Validation failed", issues: [{ field: "title", message: "Required" }] }` |
| Campo requerido presente pero vacío (`""`) | `400` — mensaje personalizado (p.ej. `"title is required"`) |
| Valor de enum inválido | `400` — mensaje lista todos los valores aceptados |
| Número negativo en campo `nonnegative` | `400` |
| String en campo numérico | `400` |
| Campos desconocidos en el body | Eliminados silenciosamente — no llegan al handler |
| Array anidado con ítem inválido | `400` — path con punto: `"items.0.name"` |
| Array vacío cuando se requiere `min(1)` | `400` |

#### Middleware `validateUuidParams(...params)`

| Escenario | Resultado esperado |
|---|---|
| Param es un UUID válido | `next()` llamado |
| Param no es un UUID | `400` — `{ error: "Invalid id: must be a valid UUID" }` |
| Múltiples params, todos válidos | `next()` llamado |
| Múltiples params, uno inválido | `400` — el mensaje nombra el param específico que falló |
| String numérico (`"12345"`) | `400` |

#### Enums de DB (schemas Zod que reflejan los tipos de PostgreSQL exactamente)

| Enum | Tipo PostgreSQL | Valores aceptados |
|---|---|---|
| `EventType` | `public.event_type` | `concierto`, `charla`, `exposicion`, `privado`, `publico`, `corporativo`, `boda`, `otro` |
| `EventStatus` | `public.event_status` | `borrador`, `planificacion`, `confirmado`, `en_curso`, `finalizado`, `cancelado` |
| `ItemCategory` | `public.item_category` | `personal`, `catering`, `equipo`, `mobiliario`, `audio_video`, `iluminacion`, `transporte`, `seguridad`, `permisos`, `marketing`, `extras` |
| `SupplierType` | `public.supplier_type` | `interno`, `externo` |
| `AppRole` | `public.app_role` | `admin`, `comercial`, `personal`, `logistica`, `viewer`, `contable`, `super_admin` |
| `OrgStatus` | columna `text` | `active`, `inactive`, `suspended` |

> **Nota importante:** `ItemCategory` solo acepta los valores en español que coinciden con la DB. Las categorías en inglés que devuelve el agente Python (`equipment`, `crew`, `supplier`) son mapeadas a español antes de llegar a la DB en `quotes.service.ts`.

---

### 2. `middleware.test.ts` — 14 pruebas

Pruebas unitarias de `requireModule()` y `requirePermission()`.

#### `requireModule(key)`

| Escenario | Resultado |
|---|---|
| Usuario `super_admin` | Pasa sin consultar la DB |
| Módulo en `enabled_modules` del org | Pasa |
| Módulo **no** en `enabled_modules` | `403` |
| `enabled_modules` vacío | `403` |
| Org no encontrada | `403` |
| `orgId` ausente en contexto | `403` |

#### `requirePermission(permission)`

| Rol | Ejemplo de prueba |
|---|---|
| `super_admin` | Pasa cualquier permiso |
| `admin` | Pasa cualquier permiso (wildcard) |
| `comercial` | Puede ver margen (`quotes.view_margin`) |
| `logistica` | No puede ver margen |
| `personal` | No puede acceder a quotes ni aprobar eventos |
| `viewer` | No puede crear ni editar |
| `contable` | Puede exportar y ver margen |
| Multi-rol | `logistica + contable` puede exportar |

---

### 3. `permissions.test.ts` — 22 pruebas

Pruebas de la función `can(roles, permission)` y la tabla `PERMISSIONS` del paquete compartido.

Cubre todos los roles (`admin`, `comercial`, `contable`, `logistica`, `personal`, `viewer`) con casos positivos y negativos, agregación multi-rol, y que todos los roles estén definidos en la tabla.

---

### 4. `tenant-isolation.test.ts` — 12 pruebas

Verifica que las queries siempre filtran por `organization_id`. Previene fugas de datos entre tenants.

---

### 5. `cost-engine.test.ts` — 10 pruebas

Pruebas del cálculo de costos, markup y margen en items de cotización.

---

## Frontend (`apps/web`)

Los archivos de prueba están en `apps/web/src/`.

### 6. `src/lib/__tests__/api.test.ts` — 3 pruebas

Pruebas de regresión del cliente HTTP (`src/lib/api.ts`).

| Escenario | Resultado esperado |
|---|---|
| Respuesta `204 No Content` (ej. después de un `DELETE`) | Devuelve `undefined` en lugar de crashear al intentar parsear body vacío |
| Respuesta `200` con JSON | Devuelve el objeto parseado |
| Respuesta `4xx/5xx` | Lanza un error con el texto del body |

> **Regresión documentada:** antes del fix, todos los deletes rompían el refresh de UI silenciosamente porque `res.json()` fallaba en body vacío.

---

### 7. `src/lib/__tests__/labels.test.ts` — 4 pruebas

Pruebas del módulo de etiquetas (`src/lib/labels.ts`).

| Escenario | Resultado esperado |
|---|---|
| Clave conocida en `EVENT_TYPE_LABELS` | Devuelve la etiqueta mapeada |
| Clave desconocida | Devuelve la clave original como fallback |
| Todos los valores de `item_category` en español | Tienen etiqueta definida en `CATEGORY_LABELS` |
| Categorías en inglés del agente (`equipment`, `crew`, `supplier`) | También tienen etiqueta (aliases) |

---

### 8. `src/pages/events/__tests__/EventDetail.test.tsx` — 1 prueba

Prueba de regresión para `EventDetail.tsx`.

| Escenario | Resultado esperado |
|---|---|
| Página de detalle de evento carga con datos reales | Deja de mostrar "Loading..." y muestra el título del evento |

> **Regresión documentada:** el bug original leía `data.event` cuando la API devuelve la forma plana `data` directamente. La página quedaba en loading infinito.

---

## Cobertura y gaps conocidos

### Qué está cubierto
- Middleware de autenticación y permisos (unitario)
- Validación de todas las entradas de la API
- Enums de la DB: cualquier cambio de migración que agregue/elimine valores romperá los tests
- Lógica de costos/margen
- Aislamiento multi-tenant
- Comportamiento del cliente HTTP en el frontend
- Regresiones críticas del frontend (delete, EventDetail)

### Qué no está cubierto (gaps)
- **Integración con DB real**: los tests de la API usan mocks de Prisma. Las migrations o cambios de schema no se detectan automáticamente.
- **Rutas completas end-to-end**: no hay tests E2E (Playwright/Cypress). El flujo completo login → UI → API → DB se verifica manualmente con el script `docs/SMOKE_TEST.md`.
- **Agente Python**: el agente (`agent/`) no tiene tests automatizados — Pydantic valida los schemas en runtime, pero no hay suite de pruebas.
- **Páginas adicionales del frontend**: solo `EventDetail` tiene test de componente. Las otras 10 páginas se verificaron manualmente durante la auditoría de contratos (ver `docs/BACKEND_ARCHITECTURE.md`).
