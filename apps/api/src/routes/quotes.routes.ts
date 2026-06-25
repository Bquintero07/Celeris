import { Router } from "express";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import * as svc from "../services/quotes.service.js";

export const quotesRouter = Router();

quotesRouter.use(requireModule("events_quotes"));

// GET /api/quotes/:eventId — event + quote lines with calculated cost/margin/profit
quotesRouter.get("/:eventId", requirePermission("quotes.view"), async (req, res) => {
  const quote = await svc.getQuote(req.ctx!, req.params.eventId as string);
  if (!quote) return res.status(404).json({ error: "Event not found" });
  res.json(quote);
});

// POST /api/quotes/:eventId/ai-suggest — ask the AI agent for suggested quote lines
// Body: { prompt?: string; budget?: number }
quotesRouter.post(
  "/:eventId/ai-suggest",
  requirePermission("quotes.edit"),
  async (req, res) => {
    try {
      const result = await svc.aiSuggest(req.ctx!, req.params.eventId as string, req.body ?? {});
      res.json(result);
    } catch (err: any) {
      res.status(err?.status ?? 502).json({ error: err?.message ?? "AI service error" });
    }
  },
);

// POST /api/quotes/:eventId/apply — replace event items with AI-suggested lines
// Body: { lines: QuoteSuggestLine[] }
quotesRouter.post(
  "/:eventId/apply",
  requirePermission("quotes.edit"),
  async (req, res) => {
    try {
      const quote = await svc.applyLines(req.ctx!, req.params.eventId as string, req.body.lines ?? []);
      res.json(quote);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ error: err?.message ?? "Apply failed" });
    }
  },
);
