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


def build_event_plan_prompt(req: EventPlanRequest) -> str:
    """Structured prompt for generating a brand new event from a free-text brief."""
    budget_line = (
        f"Maximum budget: {req.budget_cap} {req.currency}. Do not exceed it."
        if req.budget_cap
        else "No fixed budget cap — propose a sensible budget for this kind of event."
    )
    template_line = f"Event type hint: {req.template}." if req.template else ""

    return f"""You are an events production planner for an ATL/BTL agency.
{template_line}
Currency: {req.currency}
Brief: {req.prompt}
{budget_line}

Task: propose a full event plan — a title, the event type, a description, estimated
attendees, an estimated budget (your cost to produce it), an estimated revenue (what
you'd charge the client), a short summary, and the line items (equipment, crew,
suppliers, etc.) needed to produce it.

event_type must be exactly one of: concierto, charla, exposicion, privado, publico, corporativo, boda, otro.
Each item's category must be exactly one of: personal, catering, equipo, mobiliario, audio_video,
iluminacion, transporte, seguridad, permisos, marketing, extras.

Return ONLY a JSON object with this exact shape:
{{"title":str,"event_type":str,"description":str,"estimated_attendees":int,
"estimated_budget":number,"estimated_revenue":number,"summary":str,
"items":[{{"category":str,"name":str,"description":str|null,"quantity":int,"unit_cost":number,"notes":str|null}}]}}"""
