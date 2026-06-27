import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate, validateUuidParams, ItemCategory } from "../lib/validate.js";
import * as svc from "../services/templates.service.js";

export const templatesRouter = Router();
templatesRouter.use(requireModule("events_quotes"));

const templateItemSchema = z.object({
  name:       z.string().min(1, "item name is required"),
  category:   ItemCategory,
  quantity:   z.number().positive().optional(),
  unit_cost:  z.number().nonnegative().optional(),
  markup_pct: z.number().nonnegative().optional(),
  notes:      z.string().optional().nullable(),
});

const createTemplateSchema = z.object({
  name:       z.string().min(1, "name is required"),
  event_type: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  items:      z.array(templateItemSchema).optional(),
});

templatesRouter.get("/", requirePermission("events.edit"), async (req, res) => {
  const { event_type } = req.query as Record<string, string>;
  res.json(await svc.list(req.ctx!, event_type));
});

templatesRouter.get("/:id", requirePermission("events.edit"), validateUuidParams("id"), async (req, res) => {
  const tpl = await svc.get(req.ctx!, req.params.id as string);
  if (!tpl) return res.status(404).json({ error: "No encontrado" });
  res.json(tpl);
});

templatesRouter.post("/", requirePermission("events.edit"), validate(createTemplateSchema), async (req, res) => {
  try {
    const tpl = await svc.create(req.ctx!, req.body);
    res.status(201).json(tpl);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

templatesRouter.delete("/:id", requirePermission("events.edit"), validateUuidParams("id"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});

// Apply a template's items to an existing event
templatesRouter.post("/:id/apply/:eventId", requirePermission("events.edit"), validateUuidParams("id", "eventId"), async (req, res) => {
  try {
    const rows = await svc.applyToEvent(
      req.ctx!,
      req.params.id as string,
      req.params.eventId as string,
    );
    res.status(201).json(rows);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
