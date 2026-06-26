import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL = "gpt-4o-mini"


def complete_json(user_content: str, base_system: str, config=None) -> str:
    """Run a JSON-mode chat completion, applying optional operator overrides
    (model / temperature / max_tokens / extra system prompt) from the API."""
    cfg = config
    messages = [{"role": "system", "content": base_system}]
    extra = getattr(cfg, "system_prompt", None) if cfg else None
    if extra:
        messages.append({"role": "system", "content": extra})
    messages.append({"role": "user", "content": user_content})

    kwargs = {
        "model": (getattr(cfg, "model", None) or MODEL) if cfg else MODEL,
        "response_format": {"type": "json_object"},
        "messages": messages,
    }
    temp = getattr(cfg, "temperature", None) if cfg else None
    if temp is not None:
        kwargs["temperature"] = temp
    max_tokens = getattr(cfg, "max_tokens", None) if cfg else None
    if max_tokens:
        kwargs["max_tokens"] = max_tokens

    completion = client.chat.completions.create(**kwargs)
    return completion.choices[0].message.content or "{}"
