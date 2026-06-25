import { Router } from "express";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import * as svc from "../services/equipment.service.js";

export const equipmentRouter = Router();

equipmentRouter.use(requireModule("inventory"));

// GET /api/equipment
equipmentRouter.get("/", requirePermission("inventory.view"), async (req, res) => {
  res.json(await svc.list(req.ctx!));
});

// POST /api/equipment — { name, category, quantity, unit_cost, condition, location, notes }
// include id in body to update instead of create
equipmentRouter.post("/", requirePermission("inventory.edit"), async (req, res) => {
  const result = await svc.upsert(req.ctx!, req.body);
  if (!result) return res.status(404).json({ error: "Not found" });
  res.status(req.body.id ? 200 : 201).json(result);
});

// DELETE /api/equipment/:id
equipmentRouter.delete("/:id", requirePermission("inventory.edit"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});
