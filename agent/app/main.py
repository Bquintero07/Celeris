import json
import logging
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .chat_tools import TOOLS, execute_tool, gather_plan_context
from .openai_client import client, MODEL, complete_json
from .prompt import build_event_plan_prompt, build_prompt
from .schemas import (
    ChatRequest, ChatResponse,
    EventPlanRequest, EventPlanResponse,
    QuoteRequest, QuoteResponse,
)

load_dotenv()
app = FastAPI(title="Celeris AI Agent")
logger = logging.getLogger("celeris.agent")

AGENT_SHARED_SECRET = os.environ.get("AGENT_SHARED_SECRET")

# Default gross margin per event type (Colombian market). Revenue is derived from
# cost as revenue = cost / (1 - margin). Enforced in code because LLMs are unreliable
# at this arithmetic. ponytail: constants here; make configurable only if operators
# need per-event-type overrides.
PLAN_DEFAULT_MARGIN = {
    "corporativo": 0.30, "charla": 0.30, "exposicion": 0.30, "privado": 0.30,
    "boda": 0.35, "concierto": 0.25, "publico": 0.25, "otro": 0.30,
}

# Owned inventory is already paid for: it costs the event only a wear/usage fraction
# of its registered value (the doc's "desgaste 10-20%"), not the full asset value.
# ponytail: constant; make configurable from the operator panel if operators ask.
OWNED_WEAR_FACTOR = 0.15


def require_shared_secret(authorization: str | None = Header(default=None)) -> None:
    """Only the Node API (holder of AGENT_SHARED_SECRET) may call paid/AI endpoints."""
    token = (authorization or "").removeprefix("Bearer ")
    if not AGENT_SHARED_SECRET or token != AGENT_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"ok": True}


@app.post(
    "/quote/suggest",
    response_model=QuoteResponse,
    dependencies=[Depends(require_shared_secret)],
)
def suggest_quote(req: QuoteRequest) -> QuoteResponse:
    """Prompt + event context + available inventory -> structured quote lines (BOM)."""
    content = complete_json(
        build_prompt(req),
        base_system="Return ONLY valid JSON matching the schema.",
        config=req,
    )
    return QuoteResponse.model_validate_json(content)


@app.post(
    "/event/plan",
    response_model=EventPlanResponse,
    dependencies=[Depends(require_shared_secret)],
)
def plan_event(req: EventPlanRequest):
    """Free-text brief + template hint + budget cap -> a full new-event plan,
    grounded in the org's real inventory, crew and knowledge base."""
    try:
        context = gather_plan_context(req.org_id, req.prompt) if req.org_id else None
        content = complete_json(
            build_event_plan_prompt(req, context),
            base_system="Return ONLY valid JSON matching the schema.",
            config=req,
        )
        plan = EventPlanResponse.model_validate_json(content)

        # Owned inventory is already paid for — charge the event only a wear fraction
        # of its registered value, not the full asset cost (which would inflate totals).
        for item in plan.items:
            if item.source == "owned":
                item.unit_cost = round(item.unit_cost * OWNED_WEAR_FACTOR, 2)

        # Deterministic financials — the model proposes the line items; the arithmetic
        # is enforced here so cost, revenue and margin always cohere (the model is
        # unreliable at the revenue = cost / (1 - margin) formula).
        total = sum(item.quantity * item.unit_cost for item in plan.items) if plan.items else 0.0

        # Hard-enforce the budget cap by scaling item costs down to fit.
        if req.budget_cap and req.budget_cap > 0 and total > req.budget_cap:
            scale = req.budget_cap / total
            for item in plan.items:
                item.unit_cost = round(item.unit_cost * scale, 2)
            total = sum(item.quantity * item.unit_cost for item in plan.items)

        if total > 0:
            margin = PLAN_DEFAULT_MARGIN.get(plan.event_type, 0.30)
            plan.estimated_budget = round(total, 2)
            plan.estimated_revenue = round(total / (1 - margin), 2)

        return plan
    except ValidationError as e:
        logger.error("plan_event validation error: %s", e)
        return JSONResponse(status_code=422, content={"error": "El plan generado no tiene el formato esperado", "detail": e.errors()})
    except Exception as e:
        logger.exception("plan_event unexpected error")
        return JSONResponse(status_code=500, content={"error": str(e)})


CHAT_SYSTEM = """You are a helpful assistant for an events production agency.

LANGUAGE: Detect the language of the user's message and reply in that exact language every time. Never switch languages mid-conversation unless the user does first.

TOOLS — use them whenever the question requires live data:
- list_events / get_event_detail / search_events: events, line items, budgets, status.
- list_clients: client directory.
- get_financial_summary: revenue, cost and margin totals.
- search_documents: the organization's knowledge base (uploaded PDFs, contracts, guides, price lists, etc.). Use this tool whenever the user asks about policies, procedures, supplier info, pricing references, or anything that might be in a document — even if not explicitly asked. Prefer searching documents before saying you don't have information.

FORMAT: Be concise. Use short bullet points when listing items or events. Format currency values clearly (include the currency symbol/code)."""

MAX_TOOL_ROUNDS = 5


@app.post(
    "/chat",
    response_model=ChatResponse,
    dependencies=[Depends(require_shared_secret)],
)
def chat(req: ChatRequest) -> ChatResponse:
    """Conversational assistant with SQL tool calling over org data."""
    messages: list[dict] = [{"role": "system", "content": CHAT_SYSTEM}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    for _ in range(MAX_TOOL_ROUNDS):
        response = client.chat.completions.create(
            model=MODEL,
            tools=TOOLS,
            messages=messages,
        )
        choice = response.choices[0]

        if choice.finish_reason != "tool_calls":
            return ChatResponse(message=choice.message.content or "")

        messages.append(choice.message)
        for call in choice.message.tool_calls:
            try:
                args = json.loads(call.function.arguments)
                result = execute_tool(call.function.name, args, req.org_id)
            except Exception as exc:
                result = {"error": str(exc)}
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result),
            })

    return ChatResponse(message="I'm sorry, I couldn't complete the request.")
