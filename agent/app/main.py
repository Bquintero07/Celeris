import json
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException

from .chat_tools import TOOLS, execute_tool
from .openai_client import client, MODEL
from .prompt import build_event_plan_prompt, build_prompt
from .schemas import (
    ChatRequest, ChatResponse,
    EventPlanRequest, EventPlanResponse,
    QuoteRequest, QuoteResponse,
)

load_dotenv()
app = FastAPI(title="Celeris AI Agent")

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
    completion = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "Return ONLY valid JSON matching the schema."},
            {"role": "user", "content": build_prompt(req)},
        ],
    )
    content = completion.choices[0].message.content or "{}"
    return QuoteResponse.model_validate_json(content)


@app.post(
    "/event/plan",
    response_model=EventPlanResponse,
    dependencies=[Depends(require_shared_secret)],
)
def plan_event(req: EventPlanRequest) -> EventPlanResponse:
    """Free-text brief + template hint + budget cap -> a full new-event plan."""
    completion = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "Return ONLY valid JSON matching the schema."},
            {"role": "user", "content": build_event_plan_prompt(req)},
        ],
    )
    content = completion.choices[0].message.content or "{}"
    return EventPlanResponse.model_validate_json(content)


CHAT_SYSTEM = (
    "You are a helpful assistant for an events production agency. "
    "You have access to the organization's data through tools. "
    "Use them to answer questions about events, clients, budgets, and financials. "
    "Be concise and respond in the same language the user writes in. "
    "Format currency values clearly. When listing events or items, use short bullet points."
)

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
