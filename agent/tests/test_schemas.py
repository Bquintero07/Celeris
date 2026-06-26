"""
Schema validation tests — Pydantic models in app/schemas.py.
Verifies required fields, defaults, and enum literals that must match the DB exactly.
"""
import pytest
from pydantic import ValidationError
from app.schemas import (
    EventPlanRequest,
    EventPlanResponse,
    EventPlanItem,
    QuoteRequest,
    QuoteResponse,
    QuoteLine,
    InventoryItem,
)


# ── EventPlanRequest ───────────────────────────────────────────────────────────

class TestEventPlanRequest:
    def test_prompt_is_required(self):
        with pytest.raises(ValidationError):
            EventPlanRequest()

    def test_minimal_valid_request(self):
        r = EventPlanRequest(prompt="Concierto de rock")
        assert r.prompt == "Concierto de rock"
        assert r.currency == "COP"
        assert r.template is None
        assert r.budget_cap is None

    def test_all_fields(self):
        r = EventPlanRequest(
            prompt="Evento corporativo",
            template="corporativo",
            currency="USD",
            budget_cap=10000.0,
        )
        assert r.currency == "USD"
        assert r.budget_cap == 10000.0


# ── EventPlanResponse ──────────────────────────────────────────────────────────

VALID_PLAN = {
    "title": "Rock en Bogotá",
    "event_type": "concierto",
    "description": "Un gran concierto",
    "estimated_attendees": 500,
    "estimated_budget": 50000000.0,
    "estimated_revenue": 70000000.0,
    "summary": "Resumen del evento",
    "items": [],
}

class TestEventPlanResponse:
    def test_valid_plan_parses(self):
        r = EventPlanResponse(**VALID_PLAN)
        assert r.title == "Rock en Bogotá"
        assert r.event_type == "concierto"

    @pytest.mark.parametrize("event_type", [
        "concierto", "charla", "exposicion", "privado",
        "publico", "corporativo", "boda", "otro",
    ])
    def test_all_valid_event_types_accepted(self, event_type):
        r = EventPlanResponse(**{**VALID_PLAN, "event_type": event_type})
        assert r.event_type == event_type

    def test_english_event_type_rejected(self):
        with pytest.raises(ValidationError):
            EventPlanResponse(**{**VALID_PLAN, "event_type": "concert"})

    def test_items_defaults_to_empty_list(self):
        plan = {k: v for k, v in VALID_PLAN.items() if k != "items"}
        r = EventPlanResponse(**plan)
        assert r.items == []


class TestEventPlanItem:
    VALID_ITEM = {
        "category": "equipo",
        "name": "Sonido",
        "quantity": 1,
        "unit_cost": 500000.0,
    }

    @pytest.mark.parametrize("category", [
        "personal", "catering", "equipo", "mobiliario", "audio_video",
        "iluminacion", "transporte", "seguridad", "permisos", "marketing", "extras",
    ])
    def test_all_valid_categories_accepted(self, category):
        item = EventPlanItem(**{**self.VALID_ITEM, "category": category})
        assert item.category == category

    def test_english_category_rejected(self):
        """The agent must output Spanish categories — English ones are not valid DB values."""
        with pytest.raises(ValidationError):
            EventPlanItem(**{**self.VALID_ITEM, "category": "equipment"})

    def test_crew_category_rejected(self):
        with pytest.raises(ValidationError):
            EventPlanItem(**{**self.VALID_ITEM, "category": "crew"})

    def test_description_and_notes_are_optional(self):
        item = EventPlanItem(**self.VALID_ITEM)
        assert item.description is None
        assert item.notes is None


# ── QuoteRequest ───────────────────────────────────────────────────────────────

class TestQuoteRequest:
    def test_requires_event_type_and_description(self):
        with pytest.raises(ValidationError):
            QuoteRequest()

    def test_minimal_valid(self):
        r = QuoteRequest(eventType="concierto", description="Rock event")
        assert r.currency == "COP"
        assert r.inventory == []
        assert r.crew == []

    def test_inventory_item(self):
        item = InventoryItem(id="item-1", name="Pantalla LED", unitCost=200000.0, available=2)
        r = QuoteRequest(eventType="corporativo", description="Lanzamiento", inventory=[item])
        assert len(r.inventory) == 1
        assert r.inventory[0].name == "Pantalla LED"


# ── QuoteResponse ──────────────────────────────────────────────────────────────

class TestQuoteResponse:
    VALID_LINE = {
        "category": "equipment",
        "name": "Sonido",
        "source": "external",
        "quantity": 1,
        "days": 2,
        "unitCost": 300000.0,
        "markup": 20.0,
        "availability": "disponible",
    }

    @pytest.mark.parametrize("category", ["equipment", "crew", "supplier"])
    def test_valid_english_categories_for_quote_lines(self, category):
        """quote/suggest uses English categories — mapped to Spanish before DB insert."""
        line = QuoteLine(**{**self.VALID_LINE, "category": category})
        assert line.category == category

    def test_spanish_category_rejected_in_quote_line(self):
        with pytest.raises(ValidationError):
            QuoteLine(**{**self.VALID_LINE, "category": "equipo"})

    def test_notes_defaults_to_empty(self):
        r = QuoteResponse(lines=[])
        assert r.notes == []
