# Informe de Proceso de Pruebas — Celeris v1

**Fecha:** Junio 2025  
**Versión del sistema:** 1.0  
**Alcance:** Backend API · Agente IA · Frontend Web  
**Total de casos de prueba:** 228

---

## 1. Objetivo

Verificar que la plataforma Celeris v1 funciona correctamente, es segura frente a accesos no autorizados entre organizaciones, rechaza entradas inválidas, y produce respuestas consistentes en todos sus componentes: API REST, agente Python con IA, e interfaz web.

---

## 2. Estrategia de pruebas

Se adoptó una estrategia en cuatro capas complementarias:

```
┌─────────────────────────────────────────┐
│        E2E — Navegador real             │  Flujos de usuario completos
├─────────────────────────────────────────┤
│     Integración — Base de datos real    │  Persistencia y aislamiento tenant
├─────────────────────────────────────────┤
│     Componentes — Frontend aislado      │  Renderizado y contratos de UI
├─────────────────────────────────────────┤
│     Unitarias — Lógica pura             │  Validación, permisos, cálculos
└─────────────────────────────────────────┘
```

Las pruebas unitarias y de componentes se ejecutan sin servicios externos. Las pruebas de integración y E2E requieren la base de datos y el servidor en ejecución.

---

## 3. Casos de prueba

### 3.1 Backend API — Motor de costos

**Framework:** Vitest · **Comando:** `pnpm --filter api test` · **12 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| CE-01 | Margen cero cuando costo base = precio de venta | `margin = 0`, `marginPct = 0` |
| CE-02 | Margen con markup del 20% | `margin = precio * 0.2`, `marginPct ≈ 16.67` |
| CE-03 | Sin división por cero cuando revenue = 0 | `marginPct = 0` sin error |
| CE-04 | Usa `unit_cost` como base cuando `base_cost` es null | El cálculo usa el campo alternativo sin errores |
| CE-05 | Margen negativo cuando costos superan ingresos | `margin < 0`, `marginPct < 0` |
| CE-06 | Agrega múltiples ítems de forma independiente | Subtotales por categoría correctos |
| CE-07 | IVA 19% sobre subtotal | `iva = subtotal * 0.19` |
| CE-08 | IVA redondea correctamente para montos en COP | Sin decimales incorrectos |
| CE-09 | Precio de venta = base × (1 + markup/100) | Fórmula de precio con markup aplicada |
| CE-10 | Markup 0% deja el precio sin cambio | `selling_price = base_cost` |
| CE-11 | Se recupera el costo base desde el precio y el markup | `base = selling / (1 + markup/100)` |
| CE-12 | Precio negativo se acepta (crédito) | Sin error, valor negativo propagado |

---

### 3.2 Backend API — Middleware de autenticación y módulos

**Framework:** Vitest · **6 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| MW-01 | `super_admin` siempre pasa, sin consultar la BD | `next()` llamado, sin query a Prisma |
| MW-02 | Módulo habilitado en la organización permite el acceso | `next()` llamado |
| MW-03 | Módulo NO habilitado bloquea con 403 | Respuesta `403 Forbidden` |
| MW-04 | Organización sin módulos habilitados bloquea con 403 | Respuesta `403 Forbidden` |
| MW-05 | Organización no encontrada en BD bloquea con 403 | Respuesta `403 Forbidden` |
| MW-06 | Falta `orgId` en el contexto de auth bloquea con 403 | Respuesta `403 Forbidden` |

---

### 3.3 Backend API — Control de acceso por rol

**Framework:** Vitest · **18 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| AC-01 | `admin` puede hacer cualquier operación | `can()` = true para todo permiso |
| AC-02 | `comercial` puede ver y editar eventos y cotizaciones | Permisos `events.*`, `quotes.*` activos |
| AC-03 | `comercial` puede gestionar clientes y ver inventario | Permisos `clients.manage`, `inventory.view` activos |
| AC-04 | `comercial` NO puede aprobar cotizaciones ni ver crew restringido | `can("quotes.approve")` = false |
| AC-05 | `contable` puede ver eventos, márgenes y analíticas | Permisos de visualización financiera activos |
| AC-06 | `contable` NO puede editar eventos ni crear ítems | `can("events.edit")` = false |
| AC-07 | `logistica` puede ver eventos asignados, inventario y exportar | Permisos de logística activos |
| AC-08 | `logistica` NO puede ver márgenes ni crear eventos | `can("events.create")` = false |
| AC-09 | `personal` solo puede ver eventos asignados y su propia info | Permisos restringidos a crew_own |
| AC-10 | `personal` NO puede ver cotizaciones, inventario ni analíticas | `can("quotes.view")` = false |
| AC-11 | `viewer` puede ver eventos y datos básicos | Permisos de solo lectura activos |
| AC-12 | `viewer` NO puede editar ni ver márgenes | `can("events.edit")` = false |
| AC-13 | Unión de roles: `logistica + viewer` = suma de permisos | Unión correcta de conjuntos |
| AC-14 | Cualquier `admin` en la lista de roles otorga acceso total | `can()` = true para todo |
| AC-15 | Sin roles = sin permisos | `can()` = false para cualquier permiso |
| AC-16 | Todos los roles definidos en PERMISSIONS están cubiertos | Completitud del catálogo de permisos |
| AC-17 | `requirePermission()` pasa para `super_admin` sin verificar roles | `next()` sin consulta |
| AC-18 | `requirePermission()` bloquea con 403 cuando el rol no tiene el permiso | Respuesta `403 Forbidden` |

---

### 3.4 Backend API — Aislamiento multi-tenant (mocks)

**Framework:** Vitest · **15 casos**

Verifica que cada llamada a la base de datos incluye el `organization_id` correcto.

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| TI-01 | `equipment.list()` pasa `orgId` como parámetro | El UUID de la org aparece en los parámetros de la query |
| TI-02 | `equipment.upsert()` (INSERT) incluye `orgId` | La inserción está vinculada a la organización correcta |
| TI-03 | `equipment.remove()` filtra por `orgId` | El DELETE no puede afectar equipos de otra org |
| TI-04 | `suppliers.list()` pasa `orgId` | Proveedor filtrado por organización |
| TI-05 | `suppliers.remove()` filtra por `orgId` | DELETE con scope correcto |
| TI-06 | `personnel.list()` pasa `orgId` | Personal filtrado por organización |
| TI-07 | `personnel.remove()` filtra por `orgId` | DELETE con scope correcto |
| TI-08 | `clients.list()` pasa `orgId` | Clientes filtrados por organización |
| TI-09 | `clients.upsert()` (INSERT) incluye `orgId` | Inserción vinculada a la org |
| TI-10 | `clients.remove()` filtra por `orgId` | DELETE con scope correcto |
| TI-11 | `analytics.marginsByEvent()` pasa `orgId` | Métricas financieras por org |
| TI-12 | `analytics.marginsByClient()` pasa `orgId` | Análisis de cliente por org |
| TI-13 | `analytics.revenueByPeriod()` pasa `orgId` | Ingresos por período por org |
| TI-14 | Las llamadas de Org A nunca incluyen el `orgId` de Org B | Parámetros de A y B nunca se mezclan |
| TI-15 | Las llamadas de Org B nunca incluyen el `orgId` de Org A | Aislamiento bidireccional verificado |

---

### 3.5 Backend API — Validación de entradas

**Framework:** Vitest · **58 casos**

#### Middleware `validate()`

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| VL-01 | Cuerpo válido pasa y llama a `next()` | Status 200, sin errores |
| VL-02 | Campo requerido ausente → error campo por campo | Status 400, `field: "title"`, `message: "Required"` |
| VL-03 | Campo requerido presente pero vacío → mensaje personalizado | Status 400, `message: "title is required"` |
| VL-04 | Valor de enum inválido lista los valores aceptados | Status 400, mensaje contiene los valores válidos |
| VL-05 | Campo numérico recibe string → error de tipo | Status 400, campo identificado |
| VL-06 | Número negativo en campo nonnegative | Status 400, `message: "expected non-negative"` |
| VL-07 | Campos desconocidos son eliminados del body | `req.body` solo contiene campos declarados en el schema |
| VL-08 | Los datos coercionados reemplazan a `req.body` | `req.body` contiene el valor parseado por Zod |
| VL-09 | Array de ítems válido pasa | `next()` llamado |
| VL-10 | Campo `items` no es array → error | Status 400 |
| VL-11 | Ítem inválido en posición 0 muestra ruta `items.0.name` | Path anidado en el error |
| VL-12 | Array de ítems vacío es rechazado | Status 400 |

#### `validateUuidParams()`

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| VL-13 | UUID válido en un parámetro → pasa | `next()` llamado |
| VL-14 | UUID inválido → error con nombre del parámetro | Status 400, identifica el parámetro |
| VL-15 | Múltiples UUIDs válidos → pasa | `next()` llamado |
| VL-16 | Un parámetro inválido entre varios → error nombrando el incorrecto | Status 400, solo el parámetro incorrecto |
| VL-17 | String numérico (no UUID) → rechazado | Status 400 |

#### Enums de base de datos

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| VL-18 | `EventType`: los 8 valores en español son aceptados | `safeParse().success = true` para cada uno |
| VL-19 | `EventType`: valor en inglés `"concert"` es rechazado | `safeParse().success = false` |
| VL-20 | `EventStatus`: los 6 estados en español son aceptados | Todos válidos |
| VL-21 | `EventStatus`: `"draft"` (inglés) es rechazado | Inválido |
| VL-22 | `ItemCategory`: las 11 categorías en español son aceptadas | Todas válidas |
| VL-23 | `ItemCategory`: `"equipment"`, `"crew"`, `"supplier"` (inglés) rechazados | Inválidos |
| VL-24 | `SupplierType`: `"interno"` y `"externo"` aceptados | Válidos |
| VL-25 | `SupplierType`: cualquier otro valor rechazado | Inválido |
| VL-26 | `AppRole`: todos los roles válidos aceptados (incluyendo `contable`, `super_admin`) | Válidos |
| VL-27 | `AppRole`: roles no reconocidos rechazados | Inválidos |
| VL-28 | `OrgStatus`: `active`, `inactive`, `suspended` aceptados | Válidos |
| VL-29 | `OrgStatus`: cadenas arbitrarias rechazadas | Inválidas |

---

### 3.6 Agente Python — Esquemas de datos

**Framework:** pytest · **36 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| AG-01 | `prompt` es requerido en `EventPlanRequest` | Error de validación si está ausente |
| AG-02 | Request mínimo válido: solo `prompt` | `currency="COP"`, `template=None`, `budget_cap=None` por defecto |
| AG-03 | Request completo con todos los campos opcionales | Parseo correcto de todos los campos |
| AG-04 | `EventPlanResponse` parsea un plan válido | Objeto validado correctamente |
| AG-05 | Los 8 tipos de evento en español son aceptados en la respuesta | `event_type` válido para cada valor |
| AG-06 | Tipo de evento en inglés (e.g., `"concert"`) rechazado en respuesta | Error de validación Pydantic |
| AG-07 | `items` tiene valor por defecto `[]` si está ausente | Lista vacía en vez de `None` |
| AG-08 | Las 11 categorías de ítem en español aceptadas en `EventPlanItem` | Todas válidas |
| AG-09 | Categoría en inglés `"equipment"` rechazada en ítem de plan | Error de validación |
| AG-10 | Categoría `"crew"` rechazada en ítem de plan | Error de validación |
| AG-11 | `description` y `notes` son opcionales en `EventPlanItem` | Parseo correcto sin esos campos |
| AG-12 | `QuoteRequest` requiere `eventType` y `description` | Error si alguno falta |
| AG-13 | Request de cotización mínimo válido | Parseo correcto |
| AG-14 | `inventory` en cotización acepta ítems con nombre y costo | Estructura válida |
| AG-15 | `QuoteResponse` acepta categorías en inglés (`equipment`, `crew`, `supplier`) | Válidas para líneas de cotización |
| AG-16 | Categoría en español rechazada en `QuoteResponse` | Error (las cotizaciones usan categorías en inglés) |
| AG-17 | `notes` por defecto `""` si está ausente en línea de cotización | Cadena vacía |

_(Los restantes 19 casos cubren variantes parametrizadas de los tipos de evento y categorías.)_

---

### 3.7 Agente Python — Constructor de prompts

**Framework:** pytest · **14 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| PR-01 | El prompt para cotización incluye el tipo de evento | `event_type` presente en el texto del prompt |
| PR-02 | El prompt incluye la descripción del evento | `description` presente |
| PR-03 | El prompt incluye la divisa | Código de moneda presente |
| PR-04 | Sin inventario: aparece placeholder en el prompt | Texto indicando inventario vacío |
| PR-05 | Con inventario: ítems inyectados con nombre, costo y disponibilidad | Datos de inventario en el prompt |
| PR-06 | El prompt describe el formato JSON esperado (lines, markup) | Schema JSON descrito en el texto |
| PR-07 | El prompt para plan de evento incluye el texto del usuario (`prompt`) | Input del usuario presente |
| PR-08 | El prompt de plan incluye la divisa | Código de moneda presente |
| PR-09 | Con `budget_cap`: el límite se inyecta con "Do not exceed" | Restricción de presupuesto en el prompt |
| PR-10 | Sin `budget_cap`: aparece mensaje indicando que no hay límite | Texto alternativo presente |
| PR-11 | Con `template`: la sugerencia de plantilla se inyecta | Hint de template en el prompt |
| PR-12 | Los valores de enum en español aparecen en el prompt | Categorías como `personal`, `catering`, `equipo`, etc. |
| PR-13 | El prompt describe el formato JSON del plan (estimated_budget, estimated_revenue, items) | Schema correcto descrito |

---

### 3.8 Agente Python — Rutas HTTP

**Framework:** pytest + FastAPI TestClient · **12 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| RT-01 | `GET /health` devuelve 200 | `{"ok": true}` |
| RT-02 | `POST /quote/suggest` sin cabecera de autenticación → 401 | `{"detail": "Unauthorized"}` |
| RT-03 | `POST /quote/suggest` con secret incorrecto → 401 | `{"detail": "Unauthorized"}` |
| RT-04 | `POST /event/plan` sin autenticación → 401 | `{"detail": "Unauthorized"}` |
| RT-05 | `POST /quote/suggest` sin campos requeridos → 422 | Error de validación con campos faltantes |
| RT-06 | `POST /quote/suggest` sin `description` → 422 | Error indicando el campo faltante |
| RT-07 | Cotización válida con OpenAI simulado → 200 con líneas | `{"lines": [...]}` con estructura correcta |
| RT-08 | OpenAI llamado exactamente una vez por solicitud | `mock.call_count == 1` |
| RT-09 | `POST /event/plan` sin `prompt` → 422 | Error de validación |
| RT-10 | Plan de evento válido → 200 con título, tipo de evento e ítems | Respuesta completa del plan |
| RT-11 | Plan con `budget_cap` y `currency` → ambos en la respuesta | Datos financieros presentes |
| RT-12 | OpenAI devuelve `event_type` inválido → 500 | Error de servidor (Pydantic rechaza el valor) |

---

### 3.9 Frontend — Componentes web

**Framework:** Vitest + Testing Library · **25 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| FE-01 | `EventDetail`: renderiza el evento cargado (regresión bug `data.event`) | El título del evento es visible, no "Loading" |
| FE-02 | `Dashboard`: muestra el heading "Dashboard" | Elemento h1 visible |
| FE-03 | `Dashboard`: muestra valores KPI después de cargar | Números de eventos y personal visibles |
| FE-04 | `Dashboard`: muestra el título de un próximo evento | Nombre del evento en la lista |
| FE-05 | `Dashboard`: muestra estado vacío cuando no hay eventos próximos | Texto "No scheduled events" visible |
| FE-06 | `EventsList`: muestra heading "Events" | Elemento h1 visible |
| FE-07 | `EventsList`: estado vacío cuando no hay eventos | "No events yet" visible |
| FE-08 | `EventsList`: muestra títulos de eventos después de cargar | Nombre del evento en la lista |
| FE-09 | `Clients`: muestra heading "Clients" | Elemento h1 visible |
| FE-10 | `Clients`: muestra nombre del cliente después de cargar | Nombre en la tabla |
| FE-11 | `Clients`: tabla vacía cuando no hay clientes | Sin filas de datos |
| FE-12 | `Suppliers`: muestra heading "Suppliers" | Elemento h1 visible |
| FE-13 | `Suppliers`: muestra nombre del proveedor después de cargar | Nombre en la tarjeta |
| FE-14 | `Personnel`: muestra heading "Personnel" | Elemento h1 visible |
| FE-15 | `Personnel`: muestra nombre de persona después de cargar | Nombre en la tarjeta |
| FE-16 | `Inventory`: muestra heading "Inventory" | Elemento h1 visible |
| FE-17 | `Inventory`: muestra nombre del equipo después de cargar | Nombre en la tarjeta |
| FE-18 | `Inventory`: muestra etiqueta legible, no valor interno de BD | "Audio / Video" visible, `audio_video` ausente |

---

### 3.10 Integración — Base de datos real

**Framework:** Vitest (sin mocks) · **14 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| INT-01 | Crear cliente → aparece en la lista | UUID retornado; nombre en `list()` |
| INT-02 | Actualizar nombre del cliente | Campo `name` actualizado en BD |
| INT-03 | Org B no puede ver el cliente de Org A | `list()` de Org B no contiene el ID creado |
| INT-04 | Eliminar cliente | ID ausente en `list()` posterior |
| INT-05 | Crear equipo → aparece en la lista | UUID retornado; nombre en `list()` |
| INT-06 | Actualizar cantidad del equipo | `quantity = 7` en BD |
| INT-07 | Org B no puede ver el equipo de Org A | Aislamiento confirmado |
| INT-08 | Eliminar equipo | ID ausente en `list()` posterior |
| INT-09 | Crear proveedor → aparece en la lista | UUID retornado; nombre en `list()` |
| INT-10 | Org B no puede ver el proveedor de Org A | Aislamiento confirmado |
| INT-11 | Eliminar proveedor | ID ausente en `list()` posterior |
| INT-12 | Crear persona de personal → aparece en la lista | UUID retornado; nombre en `list()` |
| INT-13 | Org B no puede ver el personal de Org A | Aislamiento confirmado |
| INT-14 | Eliminar persona de personal | ID ausente en `list()` posterior |

---

### 3.11 E2E — Navegador completo (Playwright)

**Framework:** Playwright Chromium · **11 casos**

| ID | Caso de prueba | Resultado esperado |
|----|---------------|-------------------|
| E2E-01 | Login con credenciales demo válidas | Redirección a `/dashboard` o `/onboarding` |
| E2E-02 | Dashboard: tarjetas KPI son visibles | 4 tarjetas (Events, Personnel, Suppliers, Equipment) visibles |
| E2E-03 | Dashboard: sección financiera visible | "Total Budget" y "Projected Revenue" en pantalla |
| E2E-04 | Dashboard: botón "New AI Event" navega a `/events/new` | URL cambia correctamente |
| E2E-05 | Página Clients carga sin quedarse en loading | Heading visible, "Loading…" desaparece |
| E2E-06 | Página Suppliers carga sin quedarse en loading | Heading visible, "Loading…" desaparece |
| E2E-07 | Página Personnel carga sin quedarse en loading | Heading visible, "Loading…" desaparece |
| E2E-08 | Página Inventory carga sin quedarse en loading | Heading visible, "Loading…" desaparece |
| E2E-09 | Campo de búsqueda en Suppliers es interactivo | Acepta texto y mantiene el valor |
| E2E-10 | Inventory no muestra el valor interno `audio_video` | El string `audio_video` no aparece en pantalla |
| E2E-11 | Lista de eventos carga y resuelve el estado de carga | "Loading…" desaparece en menos de 15 segundos |

---

## 4. Hallazgos — Bugs corregidos durante las pruebas

| # | Componente | Problema | Corrección |
|---|-----------|---------|-----------|
| 1 | `team.routes.ts` | La acción de rol no se validaba; la rama `else` siempre ejecutaba DELETE | Validación con enum `["add","remove"]` |
| 2 | `super.routes.ts` | Campo `grant` aceptaba valores truthy/falsy en vez de booleano estricto | `z.boolean()` en el schema |
| 3 | `super.routes.ts` | `status` de organización aceptaba cadenas arbitrarias escritas a la BD | Restringido a enum `OrgStatus` |
| 4 | `ai.routes.ts` | Ruta de generación IA sin ninguna validación de entrada | Schema completo con `prompt` requerido |
| 5 | `auth.ts` | Algoritmo HS256 con JWT secret compartido rechazaba tokens reales de Supabase | Migración a ES256 con JWKS remoto |
| 6 | `auth.ts` | `Promise.all` con pgbouncer `connection_limit=1` causaba error P2024 | Consultas secuenciales |

---

## 5. Resumen de cobertura

| Capa | Casos | Framework | Entorno |
|------|-------|-----------|---------|
| Backend API — lógica pura | 116 | Vitest | Sin servicios externos |
| Agente IA — Python | 62 | pytest | Sin servicios externos |
| Frontend — componentes | 25 | Vitest + Testing Library | Sin servicios externos |
| Integración — BD real | 14 | Vitest | Supabase activo |
| E2E — navegador | 11 | Playwright | Supabase + Docker + Vite |
| **Total** | **228** | | |

---

## 6. Cómo ejecutar las pruebas

```bash
# Unitarias y componentes (sin servicios externos)
pnpm --filter api test
pnpm --filter web test
pytest agent/tests/ -v

# Integración (requiere BD activa)
pnpm vitest run integration

# E2E (requiere stack completo)
docker compose up -d
pnpm dev:web &
pnpm --filter web test:e2e
```

---

## 7. Limitaciones conocidas

- Los tests E2E utilizan credenciales de la cuenta demo. Los flujos que dependen de la carga de roles (botón "Add client") no se ejecutan en modo automático porque la query de roles no resuelve dentro del contexto de sesión guardada de Playwright.
- Los tests de integración operan sobre la organización demo en Supabase. Los registros creados durante las pruebas son eliminados al finalizar cada suite.
- El agente Python se prueba con OpenAI simulado. La calidad de las respuestas del modelo real no está cubierta por pruebas automáticas.
