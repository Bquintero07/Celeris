import { Router } from "express";
import { requireModule } from "../middleware/module.js";

export const aiRouter = Router();
aiRouter.use(requireModule("ai_assistant"));

// POST /api/ai/generate — proxy to Python FastAPI agent
aiRouter.post("/generate", async (req, res) => {
  const agentUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
  try {
    const upstream = await fetch(`${agentUrl}/quote/suggest`, {
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
