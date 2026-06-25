import { Router } from "express";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import * as svc from "../services/suppliers.service.js";

export const suppliersRouter = Router();

suppliersRouter.use(requireModule("suppliers"));

// GET /api/suppliers
suppliersRouter.get("/", requirePermission("suppliers.view"), async (req, res) => {
  res.json(await svc.list(req.ctx!));
});

// POST /api/suppliers — { name, category, type, contact_name, email, phone, website, rating, notes }
// include id in body to update instead of create
suppliersRouter.post("/", requirePermission("suppliers.edit"), async (req, res) => {
  const result = await svc.upsert(req.ctx!, req.body);
  if (!result) return res.status(404).json({ error: "Not found" });
  res.status(req.body.id ? 200 : 201).json(result);
});

// DELETE /api/suppliers/:id
suppliersRouter.delete("/:id", requirePermission("suppliers.edit"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});
