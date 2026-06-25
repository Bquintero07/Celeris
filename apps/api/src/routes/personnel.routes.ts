import { Router } from "express";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import * as svc from "../services/personnel.service.js";

export const personnelRouter = Router();

personnelRouter.use(requireModule("crew"));

// GET /api/personnel
personnelRouter.get("/", requirePermission("crew.view"), async (req, res) => {
  res.json(await svc.list(req.ctx!));
});

// POST /api/personnel — { full_name, role, skills, available, hourly_rate, email, phone, notes }
// include id in body to update instead of create
personnelRouter.post("/", requirePermission("crew.edit"), async (req, res) => {
  const result = await svc.upsert(req.ctx!, req.body);
  if (!result) return res.status(404).json({ error: "Not found" });
  res.status(req.body.id ? 200 : 201).json(result);
});

// DELETE /api/personnel/:id
personnelRouter.delete("/:id", requirePermission("crew.edit"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});
