import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../lib/validate.js";
import { getAgentConfig, agentOverrides } from "../lib/agentConfig.js";

export const aiRouter = Router();
aiRouter.use(requireModule("ai_assistant"));

const generateSchema = z.object({
  prompt:     z.string().min(1, "prompt is required"),
  template:   z.string().optional().nullable(),
  currency:   z.string().length(3).optional(),
  budget_cap: z.number().nonnegative().optional().nullable(),
});

const chatMessageSchema = z.object({
  role:    z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const chatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  currency: z.string().length(3).optional(),
});

// strip trailing slashes so AI_SERVICE_URL="https://host/" doesn't produce "host//chat" (404)
const agentUrl = () => (process.env.AI_SERVICE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const agentHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.AGENT_SHARED_SECRET ?? ""}`,
});

// POST /api/ai/generate — proxy to the agent's full new-event plan generator.
aiRouter.post("/generate", validate(generateSchema), async (req, res) => {
  const overrides = agentOverrides(await getAgentConfig(), "plan");
  const org_id = req.ctx?.orgId; // lets the agent ground the plan in the org's real inventory/crew/RAG
  try {
    const upstream = await fetch(`${agentUrl()}/event/plan`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({ ...req.body, org_id, ...overrides }),
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: await upstream.text() });
    res.json(await upstream.json());
  } catch {
    res.status(503).json({ error: "Servicio de IA no disponible" });
  }
});

// POST /api/ai/chat — conversational assistant over org data. Admin only.
aiRouter.post("/chat", requirePermission("ai.chat"), validate(chatSchema), async (req, res) => {
  const { orgId } = req.ctx!;
  if (!orgId) return res.status(403).json({ error: "Sin organización" });
  try {
    const upstream = await fetch(`${agentUrl()}/chat`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({ ...req.body, org_id: orgId }),
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: await upstream.text() });
    res.json(await upstream.json());
  } catch {
    res.status(503).json({ error: "Servicio de IA no disponible" });
  }
});
