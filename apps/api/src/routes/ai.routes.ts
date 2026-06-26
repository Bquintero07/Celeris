import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { validate } from "../lib/validate.js";

export const aiRouter = Router();
aiRouter.use(requireModule("ai_assistant"));

const generateSchema = z.object({
  prompt:     z.string().min(1, "prompt is required"),
  template:   z.string().optional().nullable(),
  currency:   z.string().length(3).optional(),
  budget_cap: z.number().nonnegative().optional().nullable(),
});

// POST /api/ai/generate — proxy to the agent's full new-event plan generator.
// Body: { prompt, template, currency, budget_cap } -> full plan (header + items).
aiRouter.post("/generate", validate(generateSchema), async (req, res) => {
  const agentUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
  try {
    const upstream = await fetch(`${agentUrl}/event/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AGENT_SHARED_SECRET ?? ""}`,
      },
      body: JSON.stringify(req.body),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }
    const data = await upstream.json();
    res.json(data);
  } catch {
    res.status(503).json({ error: "AI service unavailable" });
  }
});
