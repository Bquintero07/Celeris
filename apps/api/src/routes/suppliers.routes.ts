import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate, validateUuidParams, SupplierType } from "../lib/validate.js";
import * as svc from "../services/suppliers.service.js";

export const suppliersRouter = Router();
suppliersRouter.use(requireModule("suppliers"));

const createSupplierSchema = z.object({
  name:         z.string().min(1, "name is required"),
  category:     z.string().optional().nullable(),
  type:         SupplierType.optional(),
  contact_name: z.string().optional().nullable(),
  email:        z.string().email().optional().nullable(),
  phone:        z.string().optional().nullable(),
  website:      z.string().url().optional().nullable(),
  rating:       z.number().min(0).max(5).optional().nullable(),
  notes:        z.string().optional().nullable(),
});

const updateSupplierSchema = createSupplierSchema.extend({
  id:   z.string().uuid(),
  name: z.string().min(1).optional(),
});

// GET /api/suppliers
suppliersRouter.get("/", requirePermission("suppliers.view"), async (req, res) => {
  res.json(await svc.list(req.ctx!));
});

// POST /api/suppliers — no id = create, with id = update
suppliersRouter.post("/", requirePermission("suppliers.edit"), async (req, res) => {
  const schema = req.body?.id ? updateSupplierSchema : createSupplierSchema;
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

// DELETE /api/suppliers/:id
suppliersRouter.delete("/:id", validateUuidParams("id"), requirePermission("suppliers.edit"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});
