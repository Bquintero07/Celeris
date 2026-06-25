/**
 * Celeris demo seed — Phase 7
 *
 * Creates 2 demo tenants (Agencia Grande + Micro Productora), each with:
 *   admin user, inventory, suppliers, personnel, a client, an event, a quote,
 *   and one event template. Different enabled_modules to demonstrate gating.
 *
 * Prerequisites:
 *   1. Apply all supabase/migrations in order in the Supabase SQL editor.
 *   2. Create a `.env.seed` file at the repo root (never committed):
 *        SUPABASE_URL=https://<project>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
 *   3. Run:  pnpm tsx scripts/seed.ts
 *
 * The script is idempotent on orgs (checks slug before inserting).
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.seed if present (overrides .env for SUPABASE_* vars)
const seedEnvPath = resolve(process.cwd(), ".env.seed");
if (existsSync(seedEnvPath)) {
  const lines = readFileSync(seedEnvPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const SUPABASE_URL         = process.env.SUPABASE_URL         ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.seed");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function rpc(query: string) {
  const { data, error } = await sb.rpc("exec_sql", { sql: query });
  if (error) throw new Error(`SQL error: ${error.message}\n${query.slice(0, 200)}`);
  return data;
}

async function query<T = any>(sql: string): Promise<T[]> {
  // Use the service_role REST endpoint to run raw SQL
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "apikey":        SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SQL ${res.status}: ${txt}`);
  }
  return res.json() as Promise<T[]>;
}

async function createUser(email: string, password: string, fullName: string) {
  // Check if user already exists
  const { data: list } = await sb.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    console.log(`  ℹ  User ${email} already exists (${existing.id})`);
    return existing;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  console.log(`  ✔  Created user ${email} (${data.user.id})`);
  return data.user;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getOrgByUserId(userId: string): Promise<string | null> {
  const { data, error } = await sb
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error || !data) return null;
  return data.organization_id as string;
}

// ── Tenant definitions ────────────────────────────────────────────────────────

const TENANTS = [
  {
    email:    "admin@agencia-grande.demo",
    password: "Demo1234!",
    name:     "Agencia Grande Demo",
    slug:     "agencia-grande",
    modules:  ["events_quotes","inventory","suppliers","crew","ai_assistant","analytics","branding","approval","billing"],
    org: {
      primaryColor: "#7C5CFF",
      accentColor:  "#22D3EE",
      inventory: [
        { name: "LED Panel 1x1m", category: "audio_video",  quantity: 20,  unit_cost: 150000, available: true },
        { name: "Moving Head 200W", category: "iluminacion", quantity: 12,  unit_cost: 280000, available: true },
        { name: "Line Array 2500W", category: "audio_video", quantity: 8,   unit_cost: 950000, available: true },
        { name: "Truss 3m",        category: "equipo",       quantity: 50,  unit_cost:  45000, available: true },
        { name: "Tarima 2x1m",     category: "equipo",       quantity: 40,  unit_cost:  35000, available: true },
        { name: "Mesa DJ Pioneer",  category: "audio_video", quantity: 2,   unit_cost: 380000, available: true },
      ],
      suppliers: [
        { name: "Sonido Pro SAS",    type: "proveedor",    contact: "Carlos Ríos",    email: "carlos@sonidopro.co" },
        { name: "Catering Delicias", type: "catering",     contact: "Ana Flores",     email: "ana@delicias.co" },
        { name: "TransLogistic",     type: "transporte",   contact: "Pedro Salinas",  email: "pedro@translogistic.co" },
      ],
      personnel: [
        { full_name: "Juan Torres",    role: "Director de producción", hourly_rate: 120000, skills: ["produccion","logistica"] },
        { full_name: "Sofía Mejía",    role: "Coordinadora de eventos", hourly_rate: 80000, skills: ["coordinacion","clientes"] },
        { full_name: "Diego Vargas",   role: "Técnico de audio",        hourly_rate: 65000, skills: ["audio","iluminacion"] },
        { full_name: "Valentina Cruz", role: "Diseñadora",             hourly_rate: 75000, skills: ["diseno","branding"] },
      ],
      client: {
        name: "Banco Nacional de Colombia", contact_name: "Ricardo Pérez",
        email: "ricardo.perez@banconacional.co", phone: "3012345678",
        tax_id: "800.123.456-1",
      },
      event: {
        title:       "Lanzamiento Tarjeta Élite 2026",
        event_type:  "corporativo",
        status:      "confirmado",
        description: "Evento corporativo de lanzamiento de nueva tarjeta de crédito para 500 invitados VIP.",
        location:    "Centro de Convenciones Ágora, Bogotá",
        budget:      45000000,
        revenue:     58000000,
        attendees:   500,
      },
      items: [
        { category: "audio_video",  name: "LED Panel 1x1m (×12)",     quantity: 12,  unit_cost: 165000 },
        { category: "iluminacion",  name: "Moving Head 200W (×8)",    quantity: 8,   unit_cost: 308000 },
        { category: "audio_video",  name: "Sistema Line Array",        quantity: 4,   unit_cost: 1045000 },
        { category: "personal",     name: "Director de producción",    quantity: 16,  unit_cost: 132000 },
        { category: "personal",     name: "Coordinadora de eventos",   quantity: 24,  unit_cost: 88000 },
        { category: "catering",     name: "Cóctel VIP 500 pax",        quantity: 500, unit_cost: 45000 },
        { category: "transporte",   name: "Logística materiales",      quantity: 3,   unit_cost: 380000 },
        { category: "permisos",     name: "Permiso Secretaría Distrital", quantity: 1, unit_cost: 250000 },
      ],
      template: {
        name: "Lanzamiento Corporativo",
        event_type: "corporativo",
        items: [
          { category: "audio_video", name: "Sonido profesional", quantity: 1, unit_cost: 1500000, markup_pct: 15 },
          { category: "iluminacion", name: "Iluminación básica", quantity: 1, unit_cost: 800000,  markup_pct: 15 },
          { category: "personal",    name: "Coordinador",        quantity: 8, unit_cost: 80000,   markup_pct: 10 },
          { category: "catering",    name: "Coffee break",       quantity: 1, unit_cost: 200000,  markup_pct: 20 },
        ],
      },
    },
  },
  {
    email:    "admin@micro-productora.demo",
    password: "Demo1234!",
    name:     "Micro Productora Demo",
    slug:     "micro-productora",
    modules:  ["events_quotes","crew","ai_assistant"],   // limited — no inventory, no analytics, no billing
    org: {
      primaryColor: "#059669",
      accentColor:  "#F59E0B",
      inventory: [
        { name: "Cámara Sony A7",   category: "equipo",      quantity: 2, unit_cost: 850000, available: true },
        { name: "Trípode",          category: "equipo",      quantity: 4, unit_cost:  95000, available: true },
        { name: "Micrófono Rode",   category: "audio_video", quantity: 3, unit_cost: 320000, available: true },
      ],
      suppliers: [
        { name: "Impresiones XYZ", type: "proveedor", contact: "Luis Cano", email: "luis@impresiones.co" },
      ],
      personnel: [
        { full_name: "María Ríos",   role: "Directora creativa",   hourly_rate: 90000, skills: ["video","foto"] },
        { full_name: "Andrés López", role: "Camarógrafo",          hourly_rate: 60000, skills: ["video","edicion"] },
      ],
      client: {
        name: "Moda Urbana SAS", contact_name: "Camila Herrera",
        email: "camila@modaurbana.co", phone: "3107654321",
        tax_id: "900.456.789-2",
      },
      event: {
        title:       "Shooting Colección Verano 2026",
        event_type:  "activacion",
        status:      "planificacion",
        description: "Sesión de fotos y video para catálogo de temporada en locación exterior.",
        location:    "Parque Simón Bolívar, Bogotá",
        budget:      4500000,
        revenue:     6200000,
        attendees:   30,
      },
      items: [
        { category: "equipo",    name: "Cámara Sony A7 ×2",    quantity: 2, unit_cost: 935000 },
        { category: "equipo",    name: "Trípode ×3",            quantity: 3, unit_cost: 104500 },
        { category: "personal",  name: "Directora creativa",    quantity: 8, unit_cost: 99000  },
        { category: "personal",  name: "Camarógrafo",           quantity: 10, unit_cost: 66000 },
      ],
      template: {
        name: "Shooting básico",
        event_type: "activacion",
        items: [
          { category: "equipo",   name: "Cámara",         quantity: 1, unit_cost: 850000, markup_pct: 10 },
          { category: "personal", name: "Fotógrafo",      quantity: 8, unit_cost: 60000,  markup_pct: 10 },
          { category: "personal", name: "Asistente",      quantity: 8, unit_cost: 35000,  markup_pct: 10 },
        ],
      },
    },
  },
] as const;

// ── Main seed ─────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n🌱  Celeris seed starting…\n");

  for (const tenant of TENANTS) {
    console.log(`\n─── ${tenant.name} ───`);

    // 1. Create auth user
    const user = await createUser(tenant.email, tenant.password, `Admin ${tenant.name}`);
    const userId = user.id;

    // 2. Wait for handle_new_user trigger to fire
    let orgId: string | null = null;
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      orgId = await getOrgByUserId(userId);
      if (orgId) break;
    }

    if (!orgId) {
      // Trigger may not have fired (no new user created since user already existed)
      // Try to find org by querying profiles
      const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", userId).single();
      orgId = profile?.organization_id ?? null;
    }

    if (!orgId) {
      console.warn(`  ⚠  Could not find org for ${userId} — skipping data for this tenant`);
      continue;
    }
    console.log(`  ✔  Org: ${orgId}`);

    // 3. Update org name, slug, modules
    const { error: orgErr } = await sb
      .from("organizations")
      .update({
        name:            tenant.name,
        slug:            tenant.slug,
        status:          "active",
        enabled_modules: Array.from(tenant.modules),
        primary_color:   tenant.org.primaryColor,
        accent_color:    tenant.org.accentColor,
      })
      .eq("id", orgId);
    if (orgErr) throw new Error(`Update org: ${orgErr.message}`);
    console.log(`  ✔  Org updated: ${tenant.slug}`);

    const o = tenant.org as any;

    // 4. Inventory
    for (const eq of o.inventory) {
      const exists = await sb.from("equipment").select("id").eq("organization_id", orgId).eq("name", eq.name).limit(1).single();
      if (!exists.data) {
        const { error } = await sb.from("equipment").insert({ ...eq, organization_id: orgId, created_by: userId });
        if (error) console.warn(`    ⚠ equipment "${eq.name}": ${error.message}`);
        else console.log(`    + Equipment: ${eq.name}`);
      }
    }

    // 5. Suppliers
    for (const sup of o.suppliers) {
      const exists = await sb.from("suppliers").select("id").eq("organization_id", orgId).eq("name", sup.name).limit(1).single();
      if (!exists.data) {
        const { error } = await sb.from("suppliers").insert({
          name: sup.name, supplier_type: sup.type,
          contact_name: sup.contact, email: sup.email,
          organization_id: orgId, created_by: userId,
        });
        if (error) console.warn(`    ⚠ supplier "${sup.name}": ${error.message}`);
        else console.log(`    + Supplier: ${sup.name}`);
      }
    }

    // 6. Personnel
    const personnelIds: Record<string, string> = {};
    for (const p of o.personnel) {
      const exists = await sb.from("personnel").select("id").eq("organization_id", orgId).eq("full_name", p.full_name).limit(1).single();
      if (exists.data) {
        personnelIds[p.full_name] = exists.data.id;
      } else {
        const { data: newP, error } = await sb.from("personnel").insert({
          full_name: p.full_name, role: p.role,
          hourly_rate: p.hourly_rate, skills: p.skills,
          available: true, organization_id: orgId, created_by: userId,
        }).select("id").single();
        if (error) console.warn(`    ⚠ personnel "${p.full_name}": ${error.message}`);
        else { personnelIds[p.full_name] = newP!.id; console.log(`    + Personnel: ${p.full_name}`); }
      }
    }

    // 7. Client
    let clientId: string | null = null;
    const existingClient = await sb.from("clients").select("id").eq("organization_id", orgId).eq("name", o.client.name).limit(1).single();
    if (existingClient.data) {
      clientId = existingClient.data.id;
    } else {
      const { data: newC, error } = await sb.from("clients").insert({
        ...o.client, organization_id: orgId, created_by: userId,
      }).select("id").single();
      if (error) console.warn(`    ⚠ client: ${error.message}`);
      else { clientId = newC!.id; console.log(`    + Client: ${o.client.name}`); }
    }

    // 8. Event
    const existingEvent = await sb.from("events").select("id").eq("organization_id", orgId).eq("title", o.event.title).limit(1).single();
    let eventId: string | null = null;
    if (existingEvent.data) {
      eventId = existingEvent.data.id;
      console.log(`    ℹ Event already exists: ${o.event.title}`);
    } else {
      const { data: newE, error } = await sb.from("events").insert({
        ...o.event,
        client_id:       clientId,
        approval_status: "draft",
        organization_id: orgId,
        created_by:      userId,
      }).select("id").single();
      if (error) console.warn(`    ⚠ event: ${error.message}`);
      else { eventId = newE!.id; console.log(`    + Event: ${o.event.title}`); }
    }

    // 9. Event items (quote lines)
    if (eventId) {
      const existingItems = await sb.from("event_items").select("id").eq("event_id", eventId).limit(1);
      if (!existingItems.data?.length) {
        for (const item of o.items) {
          const baseCost  = Number(item.unit_cost);
          const markup    = 0;
          const selling   = baseCost;
          const { error } = await sb.from("event_items").insert({
            event_id:        eventId,
            category:        item.category,
            name:            item.name,
            quantity:        item.quantity,
            unit_cost:       selling,
            base_cost:       baseCost,
            markup_pct:      markup,
            organization_id: orgId,
          });
          if (error) console.warn(`    ⚠ item "${item.name}": ${error.message}`);
          else console.log(`    + Item: ${item.name}`);
        }
      } else {
        console.log(`    ℹ Event items already exist`);
      }
    }

    // 10. Event template
    const existingTpl = await sb.from("event_templates").select("id").eq("organization_id", orgId).eq("name", o.template.name).limit(1).single();
    if (!existingTpl.data) {
      const { data: tpl, error: tplErr } = await sb.from("event_templates").insert({
        name: o.template.name, event_type: o.template.event_type,
        organization_id: orgId, created_by: userId,
      }).select("id").single();
      if (tplErr) console.warn(`    ⚠ template: ${tplErr.message}`);
      else {
        for (const ti of o.template.items) {
          await sb.from("template_items").insert({ ...ti, template_id: tpl!.id });
        }
        console.log(`    + Template: ${o.template.name}`);
      }
    }

    console.log(`\n  ✅  ${tenant.name} complete`);
  }

  console.log("\n🎉  Seed complete!\n");
  console.log("Login credentials:");
  for (const t of TENANTS) {
    console.log(`  ${t.name.padEnd(30)}  ${t.email}  /  ${t.password}`);
  }
  console.log("\nEnabled modules:");
  for (const t of TENANTS) {
    console.log(`  ${t.slug.padEnd(20)}  ${t.modules.join(", ")}`);
  }
  console.log();
}

seed().catch((e) => { console.error("❌", e.message); process.exit(1); });
