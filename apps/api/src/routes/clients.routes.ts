import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate, validateUuidParams } from "../lib/validate.js";
import * as svc from "../services/clients.service.js";

export const clientsRouter = Router();
clientsRouter.use(requireModule("events_quotes"));

const createClientSchema = z.object({
  name:         z.string().min(1, "name is required"),
  contact_name: z.string().optional().nullable(),
  email:        z.string().email().optional().nullable(),
  phone:        z.string().optional().nullable(),
  address:      z.string().optional().nullable(),
  tax_id:       z.string().optional().nullable(),
  notes:        z.string().optional().nullable(),
});

const updateClientSchema = createClientSchema.partial().extend({
  name: z.string().min(1).optional(),
});

clientsRouter.get("/", requirePermission("clients.view"), async (req, res) => {
  res.json(await svc.list(req.ctx!));
});

clientsRouter.post("/", requirePermission("clients.manage"), validate(createClientSchema), async (req, res) => {
  try {
    const row = await svc.upsert(req.ctx!, req.body);
    res.status(201).json(row);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

clientsRouter.patch("/:id", validateUuidParams("id"), requirePermission("clients.manage"), validate(updateClientSchema), async (req, res) => {
  try {
    const row = await svc.upsert(req.ctx!, { ...req.body, id: req.params.id as string });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

clientsRouter.delete("/:id", validateUuidParams("id"), requirePermission("clients.manage"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});
