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

        # Hard-enforce the budget cap regardless of what the model returned.
        if req.budget_cap and req.budget_cap > 0 and plan.items:
            total = sum(item.quantity * item.unit_cost for item in plan.items)
            if total > req.budget_cap:
                scale = req.budget_cap / total
                for item in plan.items:
                    item.unit_cost = round(item.unit_cost * scale, 2)
                plan.estimated_budget = req.budget_cap
            else:
                plan.estimated_budget = round(total, 2)

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
