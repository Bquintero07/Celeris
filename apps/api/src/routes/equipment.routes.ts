import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate, validateUuidParams, ItemCategory } from "../lib/validate.js";
import * as svc from "../services/equipment.service.js";

export const equipmentRouter = Router();
equipmentRouter.use(requireModule("inventory"));

const createEquipmentSchema = z.object({
  name:      z.string().min(1, "name is required"),
  category:  ItemCategory.optional(),
  quantity:  z.number().int().nonnegative().optional(),
  unit_cost: z.number().nonnegative().optional(),
  condition: z.string().optional().nullable(),
  location:  z.string().optional().nullable(),
  notes:     z.string().optional().nullable(),
});

const updateEquipmentSchema = createEquipmentSchema.extend({
  id:   z.string().uuid(),
  name: z.string().min(1).optional(),
});

// GET /api/equipment
equipmentRouter.get("/", requirePermission("inventory.view"), async (req, res) => {
  res.json(await svc.list(req.ctx!));
});

// POST /api/equipment — no id = create, with id = update
equipmentRouter.post("/", requirePermission("inventory.edit"), async (req, res) => {
  const schema = req.body?.id ? updateEquipmentSchema : createEquipmentSchema;
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

// DELETE /api/equipment/:id
equipmentRouter.delete("/:id", validateUuidParams("id"), requirePermission("inventory.edit"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});
