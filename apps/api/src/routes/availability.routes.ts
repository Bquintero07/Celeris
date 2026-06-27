import { Router } from "express";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import * as svc from "../services/availability.service.js";

export const availabilityRouter = Router();
availabilityRouter.use(requireModule("inventory"));

availabilityRouter.get("/equipment", requirePermission("inventory.view"), async (req, res) => {
  const { start, end, excludeEventId } = req.query as Record<string, string>;
  if (!start || !end) return res.status(400).json({ error: "Se requieren las fechas de inicio y fin" });
  res.json(await svc.equipmentInRange(req.ctx!, start, end, excludeEventId));
});

availabilityRouter.get("/personnel", requirePermission("crew.view"), async (req, res) => {
  const { start, end, excludeEventId } = req.query as Record<string, string>;
  if (!start || !end) return res.status(400).json({ error: "Se requieren las fechas de inicio y fin" });
  res.json(await svc.personnelInRange(req.ctx!, start, end, excludeEventId));
});
