from typing import Literal
from pydantic import BaseModel


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


class QuoteRequest(BaseModel):
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


class EventPlanRequest(BaseModel):
    prompt: str
    template: str | None = None
    currency: str = "COP"
    budget_cap: float | None = None


class EventPlanItem(BaseModel):
    category: Literal[
        "personal", "catering", "equipo", "mobiliario", "audio_video",
        "iluminacion", "transporte", "seguridad", "permisos", "marketing", "extras",
    ]
    name: str
    description: str | None = None
    quantity: int
    unit_cost: float
    notes: str | None = None


class EventPlanResponse(BaseModel):
    title: str
    event_type: Literal[
        "concierto", "charla", "exposicion", "privado", "publico",
        "corporativo", "boda", "otro",
    ]
    description: str
    estimated_attendees: int
    estimated_budget: float
    estimated_revenue: float
    summary: str
    items: list[EventPlanItem] = []
