from .schemas import EventPlanRequest, QuoteRequest


def build_prompt(req: QuoteRequest) -> str:
    """Structured prompt: inject the available inventory and force JSON output."""
    inventory_lines = "\n".join(
        f"- {i.name} (id={i.id}, unitCost={i.unitCost}, available={i.available})"
        for i in req.inventory
    ) or "- (no owned inventory provided)"

    return f"""You are an events production planner for an ATL/BTL agency.
Event type: {req.eventType}
Currency: {req.currency}
Brief: {req.description}

Owned inventory available:
{inventory_lines}

Task: propose the quote line items (equipment, crew, suppliers) needed for this event.
- Prefer owned inventory when available; set source="owned".
- If something is not in the owned inventory, set source="external" and note it.
- Suggest a sensible markup (%) per line.
Return ONLY a JSON object with this exact shape:
{{"lines":[{{"category":"equipment|crew|supplier","name":str,"source":"owned|external",
"quantity":int,"days":int,"unitCost":number,"markup":number,"availability":str}}],
"notes":[str]}}"""


def build_event_plan_prompt(req: EventPlanRequest, context: dict | None = None) -> str:
    """Structured prompt for generating a brand new event from a free-text brief,
    grounded in the org's real owned inventory, crew and knowledge base."""
    budget_line = (
        f"HARD BUDGET CAP: {req.budget_cap} {req.currency}.\n"
        f"- The sum of all (quantity × unit_cost) across every item MUST be ≤ {req.budget_cap} {req.currency}.\n"
        f"- estimated_budget must equal that sum and must be ≤ {req.budget_cap} {req.currency}.\n"
        f"- If your first draft exceeds the cap, cut quantities or remove items until it fits.\n"
        f"- NEVER return a plan whose total cost exceeds {req.budget_cap} {req.currency}."
        if req.budget_cap
        else "No fixed budget cap — propose a sensible budget for this kind of event."
    )
    template_line = f"Event type hint: {req.template}." if req.template else ""

    ctx = context or {}
    inventory_lines = "\n".join(
        f"- {i['name']} ({i['category']}, owned qty={i['quantity']}, unit cost={i['unit_cost']} {req.currency})"
        for i in ctx.get("inventory") or []
    ) or "- (this organization has no owned inventory registered)"
    crew_lines = "\n".join(
        f"- {c['full_name']} ({c['role']}, hourly rate={c['hourly_rate']} {req.currency})"
        for c in ctx.get("crew") or []
    ) or "- (no available in-house crew registered)"
    knowledge = "\n\n".join(
        f"[{d['source'] or 'doc'}] {d['content']}" for d in ctx.get("docs") or []
    ) or "(no relevant documents)"
    price_refs = "\n\n".join(
        f"[{d['source'] or 'doc'}] {d['content']}" for d in ctx.get("price_docs") or []
    ) or "(no price lists uploaded to the knowledge base)"

    return f"""You are an experienced events production planner for an ATL/BTL agency.
{template_line}
Currency: {req.currency}
Brief: {req.prompt}
{budget_line}

── OWNED INVENTORY (already paid for — do not re-buy) ──
{inventory_lines}

── AVAILABLE IN-HOUSE CREW ──
{crew_lines}

── PRICE REFERENCES FROM KNOWLEDGE BASE ──
{price_refs}

── OTHER RELEVANT KNOWLEDGE BASE NOTES ──
{knowledge}

Task: propose a full event plan — title, event type, description, estimated attendees,
estimated budget (your production cost), estimated revenue (what you charge the client),
a short summary, and all line items needed.

Apply the planning, tier and pricing rules given in the system instructions, together
with the price references and inventory above. Scale every quantity to the estimated
attendees. Choose only tier-appropriate items — do not add large owned assets (stages,
tents, roofs, trussing) to a small event just because they exist in inventory.
For owned items set source="owned", write "propio" in notes, and use the registered
cost from the owned inventory list (the system applies a wear discount automatically).
For anything not owned set source="external" and use a knowledge-base price when
available, otherwise a conservative Colombian market rate (write "estimado" in notes).

CONSISTENCY: estimated_budget must equal the sum of (quantity × unit_cost) across all
items. estimated_revenue should reflect a sensible margin over estimated_budget.

event_type must be exactly one of: concierto, charla, exposicion, privado, publico, corporativo, boda, otro.
Each item's category must be exactly one of: personal, catering, equipo, mobiliario, audio_video,
iluminacion, transporte, seguridad, permisos, marketing, extras.

Return ONLY a JSON object with this exact shape:
{{"title":str,"event_type":str,"description":str,"estimated_attendees":int,
"estimated_budget":number,"estimated_revenue":number,"summary":str,
"items":[{{"category":str,"name":str,"description":str|null,"quantity":int,"unit_cost":number,"source":"owned"|"external","notes":str|null}}]}}"""
