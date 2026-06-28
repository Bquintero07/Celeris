from typing import Literal
from pydantic import BaseModel, field_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    org_id: str
    currency: str = "COP"


class ChatResponse(BaseModel):
    message: str


class InventoryItem(BaseModel):
    id: str
    name: str
    unitCost: float
    available: int


class AgentOverrides(BaseModel):
    # Optional operator-tuned settings forwarded by the Node API.
    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    system_prompt: str | None = None


class QuoteRequest(AgentOverrides):
    eventType: str
    description: str
    inventory: list[InventoryItem] = []
    crew: list[dict] = []
    currency: str = "COP"


class QuoteLine(BaseModel):
    category: Literal["equipment", "crew", "supplier"]
    name: str
    source: Literal["owned", "external"]
    quantity: int
    days: int
    unitCost: float
    markup: float
    availability: str


class QuoteResponse(BaseModel):
    lines: list[QuoteLine]
    notes: list[str] = []


class EventPlanRequest(AgentOverrides):
    prompt: str
    template: str | None = None
    currency: str = "COP"
    budget_cap: float | None = None
    org_id: str | None = None


_VALID_CATEGORIES = {
    "personal", "catering", "equipo", "mobiliario", "audio_video",
    "iluminacion", "transporte", "seguridad", "permisos", "marketing", "extras",
}
_VALID_EVENT_TYPES = {
    "concierto", "charla", "exposicion", "privado", "publico",
    "corporativo", "boda", "otro",
}


class EventPlanItem(BaseModel):
    category: str
    name: str
    description: str | None = None
    quantity: int
    unit_cost: float
    notes: str | None = None

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v) -> str:
        return str(v) if v in _VALID_CATEGORIES else "extras"

    @field_validator("name", mode="before")
    @classmethod
    def require_name(cls, v) -> str:
        return str(v) if v else "Ítem"

    @field_validator("quantity", mode="before")
    @classmethod
    def coerce_quantity(cls, v) -> int:
        try:
            return max(1, round(float(v)))
        except (TypeError, ValueError):
            return 1

    @field_validator("unit_cost", mode="before")
    @classmethod
    def coerce_unit_cost(cls, v) -> float:
        try:
            return max(0.0, float(v))
        except (TypeError, ValueError):
            return 0.0


class EventPlanResponse(BaseModel):
    title: str
    event_type: str
    description: str
    estimated_attendees: int
    estimated_budget: float
    estimated_revenue: float
    summary: str
    items: list[EventPlanItem] = []

    @field_validator("event_type", mode="before")
    @classmethod
    def normalize_event_type(cls, v) -> str:
        return str(v) if v in _VALID_EVENT_TYPES else "otro"

    @field_validator("title", "description", "summary", mode="before")
    @classmethod
    def require_str(cls, v) -> str:
        return str(v) if v else ""

    @field_validator("estimated_attendees", mode="before")
    @classmethod
    def coerce_attendees(cls, v) -> int:
        try:
            return max(1, round(float(v)))
        except (TypeError, ValueError):
            return 1

    @field_validator("estimated_budget", "estimated_revenue", mode="before")
    @classmethod
    def coerce_money(cls, v) -> float:
        try:
            return max(0.0, float(v))
        except (TypeError, ValueError):
            return 0.0
