"""
Prompt builder tests — app/prompt.py.
Verifies that the prompts injected into OpenAI contain the correct context fields.
"""
from app.prompt import build_prompt, build_event_plan_prompt
from app.schemas import EventPlanRequest, InventoryItem, QuoteRequest


class TestBuildPrompt:
    def _make_req(self, **kwargs) -> QuoteRequest:
        return QuoteRequest(eventType="concierto", description="Rock event", **kwargs)

    def test_includes_event_type(self):
        prompt = build_prompt(self._make_req())
        assert "concierto" in prompt

    def test_includes_description(self):
        prompt = build_prompt(self._make_req())
        assert "Rock event" in prompt

    def test_includes_currency(self):
        prompt = build_prompt(self._make_req(currency="USD"))
        assert "USD" in prompt

    def test_empty_inventory_shows_placeholder(self):
        prompt = build_prompt(self._make_req(inventory=[]))
        assert "no owned inventory" in prompt

    def test_inventory_items_injected(self):
        item = InventoryItem(id="i1", name="Pantalla LED", unitCost=200000.0, available=3)
        prompt = build_prompt(self._make_req(inventory=[item]))
        assert "Pantalla LED" in prompt
        assert "200000" in prompt
        assert "available=3" in prompt

    def test_json_shape_description_included(self):
        prompt = build_prompt(self._make_req())
        assert "lines" in prompt
        assert "markup" in prompt


class TestBuildEventPlanPrompt:
    def _make_req(self, **kwargs) -> EventPlanRequest:
        return EventPlanRequest(prompt="Concierto de rock para 500 personas", **kwargs)

    def test_includes_prompt(self):
        prompt = build_event_plan_prompt(self._make_req())
        assert "Concierto de rock para 500 personas" in prompt

    def test_includes_currency(self):
        prompt = build_event_plan_prompt(self._make_req(currency="USD"))
        assert "USD" in prompt

    def test_budget_cap_injected_when_present(self):
        prompt = build_event_plan_prompt(self._make_req(budget_cap=5000000.0))
        assert "5000000" in prompt
        assert "Do not exceed" in prompt

    def test_no_budget_cap_message_when_absent(self):
        prompt = build_event_plan_prompt(self._make_req())
        assert "No fixed budget cap" in prompt

    def test_template_hint_injected_when_present(self):
        prompt = build_event_plan_prompt(self._make_req(template="corporativo"))
        assert "corporativo" in prompt

    def test_spanish_enum_values_listed_in_prompt(self):
        """Prompt must constrain the model to Spanish DB enum values."""
        prompt = build_event_plan_prompt(self._make_req())
        for category in ["personal", "catering", "equipo", "audio_video", "extras"]:
            assert category in prompt
        for event_type in ["concierto", "charla", "corporativo", "boda"]:
            assert event_type in prompt

    def test_json_shape_described(self):
        prompt = build_event_plan_prompt(self._make_req())
        assert "estimated_budget" in prompt
        assert "estimated_revenue" in prompt
        assert "items" in prompt
