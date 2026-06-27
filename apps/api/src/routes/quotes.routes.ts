import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate, validateUuidParams } from "../lib/validate.js";
import * as svc from "../services/quotes.service.js";

export const quotesRouter = Router();
quotesRouter.use(requireModule("events_quotes"));

const aiSuggestSchema = z.object({
  prompt: z.string().optional(),
  budget: z.number().nonnegative().optional(),
});

// GET /api/quotes/:eventId
quotesRouter.get("/:eventId", requirePermission("quotes.view"), validateUuidParams("eventId"), async (req, res) => {
  const quote = await svc.getQuote(req.ctx!, req.params.eventId as string);
  if (!quote) return res.status(404).json({ error: "Evento no encontrado" });
  res.json(quote);
});

// POST /api/quotes/:eventId/ai-suggest
quotesRouter.post(
  "/:eventId/ai-suggest",
  requirePermission("quotes.edit"),
  validateUuidParams("eventId"),
  validate(aiSuggestSchema),
  async (req, res) => {
    try {
      const result = await svc.aiSuggest(req.ctx!, req.params.eventId as string, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err?.status ?? 502).json({ error: err?.message ?? "AI service error" });
    }
  },
);

// POST /api/quotes/:eventId/apply
quotesRouter.post(
  "/:eventId/apply",
  requirePermission("quotes.edit"),
  validateUuidParams("eventId"),
  async (req, res) => {
    try {
      const quote = await svc.applyLines(req.ctx!, req.params.eventId as string, req.body.lines ?? []);
      res.json(quote);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ error: err?.message ?? "Apply failed" });
    }
  },
);
