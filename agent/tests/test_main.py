"""
API endpoint tests — app/main.py.
Uses FastAPI's TestClient (no real HTTP server needed).
OpenAI calls are mocked — no API key required.
"""
import json
import os
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

os.environ.setdefault("AGENT_SHARED_SECRET", "test-secret")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")

from app.main import app  # noqa: E402 — env vars must be set before import

SECRET = "test-secret"
AUTH   = {"Authorization": f"Bearer {SECRET}"}

client = TestClient(app)


# ── /health ────────────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


# ── Auth guard ─────────────────────────────────────────────────────────────────

class TestAuthGuard:
    def test_quote_suggest_without_auth_returns_401(self):
        r = client.post("/quote/suggest", json={"eventType": "concierto", "description": "X"})
        assert r.status_code == 401

    def test_quote_suggest_with_wrong_secret_returns_401(self):
        r = client.post(
            "/quote/suggest",
            json={"eventType": "concierto", "description": "X"},
            headers={"Authorization": "Bearer wrong-secret"},
        )
        assert r.status_code == 401

    def test_event_plan_without_auth_returns_401(self):
        r = client.post("/event/plan", json={"prompt": "Un evento"})
        assert r.status_code == 401


# ── /quote/suggest ─────────────────────────────────────────────────────────────

MOCK_QUOTE_RESPONSE = {
    "lines": [
        {
            "category": "equipment",
            "name": "Sonido profesional",
            "source": "external",
            "quantity": 1,
            "days": 1,
            "unitCost": 300000.0,
            "markup": 20.0,
            "availability": "disponible",
        }
    ],
    "notes": ["Confirmar disponibilidad con proveedor"],
}


def _mock_openai(response_json: dict):
    """Returns a mock that mimics openai.chat.completions.create()."""
    mock_msg = MagicMock()
    mock_msg.content = json.dumps(response_json)
    mock_choice = MagicMock()
    mock_choice.message = mock_msg
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    return mock_completion


class TestQuoteSuggest:
    def test_missing_required_fields_returns_422(self):
        r = client.post("/quote/suggest", json={}, headers=AUTH)
        assert r.status_code == 422

    def test_missing_description_returns_422(self):
        r = client.post("/quote/suggest", json={"eventType": "concierto"}, headers=AUTH)
        assert r.status_code == 422

    def test_valid_request_returns_quote_lines(self):
        with patch("app.main.client.chat.completions.create") as mock_create:
            mock_create.return_value = _mock_openai(MOCK_QUOTE_RESPONSE)
            r = client.post(
                "/quote/suggest",
                json={"eventType": "concierto", "description": "Rock para 300 personas"},
                headers=AUTH,
            )
        assert r.status_code == 200
        data = r.json()
        assert "lines" in data
        assert len(data["lines"]) == 1
        assert data["lines"][0]["category"] == "equipment"

    def test_openai_called_once_per_request(self):
        with patch("app.main.client.chat.completions.create") as mock_create:
            mock_create.return_value = _mock_openai(MOCK_QUOTE_RESPONSE)
            client.post(
                "/quote/suggest",
                json={"eventType": "concierto", "description": "X"},
                headers=AUTH,
            )
        mock_create.assert_called_once()


# ── /event/plan ────────────────────────────────────────────────────────────────

MOCK_PLAN_RESPONSE = {
    "title": "Rock en Bogotá",
    "event_type": "concierto",
    "description": "Gran concierto de rock",
    "estimated_attendees": 500,
    "estimated_budget": 50000000.0,
    "estimated_revenue": 70000000.0,
    "summary": "Un evento épico",
    "items": [
        {
            "category": "equipo",
            "name": "Sistema de sonido",
            "description": None,
            "quantity": 1,
            "unit_cost": 5000000.0,
            "notes": None,
        }
    ],
}


class TestEventPlan:
    def test_missing_prompt_returns_422(self):
        r = client.post("/event/plan", json={}, headers=AUTH)
        assert r.status_code == 422

    def test_valid_request_returns_full_plan(self):
        with patch("app.main.client.chat.completions.create") as mock_create:
            mock_create.return_value = _mock_openai(MOCK_PLAN_RESPONSE)
            r = client.post(
                "/event/plan",
                json={"prompt": "Concierto de rock para 500 personas en Bogotá"},
                headers=AUTH,
            )
        assert r.status_code == 200
        data = r.json()
        assert data["title"] == "Rock en Bogotá"
        assert data["event_type"] == "concierto"
        assert len(data["items"]) == 1
        assert data["items"][0]["category"] == "equipo"

    def test_plan_with_budget_cap_and_currency(self):
        with patch("app.main.client.chat.completions.create") as mock_create:
            mock_create.return_value = _mock_openai(MOCK_PLAN_RESPONSE)
            r = client.post(
                "/event/plan",
                json={"prompt": "Boda íntima", "currency": "USD", "budget_cap": 10000.0},
                headers=AUTH,
            )
        assert r.status_code == 200

    def test_invalid_event_type_from_openai_raises_validation_error(self):
        """If the LLM ignores the instructions and returns an English event type,
        Pydantic raises a ValidationError inside the handler — Pydantic enforces the
        DB enum values (Spanish only) at the response layer."""
        bad_plan = {**MOCK_PLAN_RESPONSE, "event_type": "concert"}
        # raise_server_exceptions=False so we get the HTTP response instead of a Python exception
        no_raise_client = TestClient(app, raise_server_exceptions=False)
        with patch("app.main.client.chat.completions.create") as mock_create:
            mock_create.return_value = _mock_openai(bad_plan)
            r = no_raise_client.post("/event/plan", json={"prompt": "Test"}, headers=AUTH)
        assert r.status_code == 500

    def test_invalid_item_category_from_openai_raises_validation_error(self):
        """If the LLM returns an English category instead of Spanish, Pydantic rejects it.
        The Spanish-only constraint on EventPlanItem.category catches this at runtime."""
        bad_plan = {
            **MOCK_PLAN_RESPONSE,
            "items": [{**MOCK_PLAN_RESPONSE["items"][0], "category": "equipment"}],
        }
        no_raise_client = TestClient(app, raise_server_exceptions=False)
        with patch("app.main.client.chat.completions.create") as mock_create:
            mock_create.return_value = _mock_openai(bad_plan)
            r = no_raise_client.post("/event/plan", json={"prompt": "Test"}, headers=AUTH)
        assert r.status_code == 500
