import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate, validateUuidParams } from "../lib/validate.js";
import * as svc from "../services/personnel.service.js";

export const personnelRouter = Router();
personnelRouter.use(requireModule("crew"));

const createPersonnelSchema = z.object({
  full_name:   z.string().min(1, "full_name is required"),
  role:        z.string().optional().nullable(),
  skills:      z.array(z.string()).optional(),
  available:   z.boolean().optional(),
  hourly_rate: z.number().nonnegative().optional().nullable(),
  email:       z.string().email().optional().nullable(),
  phone:       z.string().optional().nullable(),
  notes:       z.string().optional().nullable(),
});

const updatePersonnelSchema = createPersonnelSchema.extend({
  id:        z.string().uuid(),
  full_name: z.string().min(1).optional(),
});

// GET /api/personnel
personnelRouter.get("/", requirePermission("crew.view"), async (req, res) => {
  res.json(await svc.list(req.ctx!));
});

// POST /api/personnel — no id = create, with id = update
personnelRouter.post("/", requirePermission("crew.edit"), async (req, res) => {
  const schema = req.body?.id ? updatePersonnelSchema : createPersonnelSchema;
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Datos inválidos",
      issues: result.error.issues.map((i) => ({ field: i.path.join(".") || "body", message: i.message })),
    });
  }
  const data = await svc.upsert(req.ctx!, result.data);
  if (!data) return res.status(404).json({ error: "No encontrado" });
  res.status(req.body.id ? 200 : 201).json(data);
});

// DELETE /api/personnel/:id
personnelRouter.delete("/:id", validateUuidParams("id"), requirePermission("crew.edit"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});
