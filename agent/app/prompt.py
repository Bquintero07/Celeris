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
        f"Maximum budget: {req.budget_cap} {req.currency}. Do not exceed it."
        if req.budget_cap
        else "No fixed budget cap — propose a sensible budget for this kind of event."
    )
    template_line = f"Event type hint: {req.template}." if req.template else ""

    ctx = context or {}
    inventory_lines = "\n".join(
        f"- {i['name']} ({i['category']}, owned qty={i['quantity']}, unit cost={i['unit_cost']})"
        for i in ctx.get("inventory") or []
    ) or "- (this organization has no owned inventory registered)"
    crew_lines = "\n".join(
        f"- {c['full_name']} ({c['role']}, hourly rate={c['hourly_rate']})"
        for c in ctx.get("crew") or []
    ) or "- (no available in-house crew registered)"
    knowledge = "\n\n".join(
        f"[{d['source'] or 'doc'}] {d['content']}" for d in ctx.get("docs") or []
    ) or "(no relevant documents in the knowledge base)"

    return f"""You are an experienced events production planner for an ATL/BTL agency.
{template_line}
Currency: {req.currency}
Brief: {req.prompt}
{budget_line}

This organization's REAL owned inventory (already paid for — prefer it, do not re-buy it):
{inventory_lines}

This organization's available in-house crew:
{crew_lines}

Relevant notes from the organization's knowledge base:
{knowledge}

Task: propose a full event plan — a title, the event type, a description, estimated
attendees, an estimated budget (your cost to produce it), an estimated revenue (what
you'd charge the client), a short summary, and the line items (equipment, crew,
suppliers, etc.) needed to produce it.

Grounding rules — be realistic and internally consistent:
- Scale every quantity to the estimated attendees. Seating ~1 chair per attendee;
  tables per the event format; catering per person; staff and security by sensible
  ratios. Never propose a token quantity (e.g. 10 chairs for 60 people).
- When a need is covered by the owned inventory above, use it: price it at its owned
  unit cost and write "propio" in that item's notes. If a needed item is NOT in the
  owned inventory, treat it as a third-party rental/purchase and write "externo" in
  its notes.
- Respect the knowledge base above when it has pricing, suppliers or constraints.
- Keep estimated_budget consistent with the sum of the item costs (quantity * unit_cost).

event_type must be exactly one of: concierto, charla, exposicion, privado, publico, corporativo, boda, otro.
Each item's category must be exactly one of: personal, catering, equipo, mobiliario, audio_video,
iluminacion, transporte, seguridad, permisos, marketing, extras.

Return ONLY a JSON object with this exact shape:
{{"title":str,"event_type":str,"description":str,"estimated_attendees":int,
"estimated_budget":number,"estimated_revenue":number,"summary":str,
"items":[{{"category":str,"name":str,"description":str|null,"quantity":int,"unit_cost":number,"notes":str|null}}]}}"""
