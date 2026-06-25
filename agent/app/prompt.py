from .schemas import QuoteRequest


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
