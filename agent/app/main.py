import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException

from .openai_client import complete_json
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
def plan_event(req: EventPlanRequest) -> EventPlanResponse:
    """Free-text brief + template hint + budget cap -> a full new-event plan."""
    content = complete_json(
        build_event_plan_prompt(req),
        base_system="Return ONLY valid JSON matching the schema.",
        config=req,
    )
    return EventPlanResponse.model_validate_json(content)
