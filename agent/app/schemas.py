from typing import Literal
from pydantic import BaseModel


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
