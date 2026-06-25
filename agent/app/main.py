import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException

from .openai_client import client, MODEL
from .prompt import build_event_plan_prompt, build_prompt
from .schemas import EventPlanRequest, EventPlanResponse, QuoteRequest, QuoteResponse

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
