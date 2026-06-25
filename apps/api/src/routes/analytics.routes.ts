import { Router } from "express";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import * as svc from "../services/analytics.service.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireModule("analytics"));

analyticsRouter.get("/margins", requirePermission("analytics.view"), async (req, res) => {
  const { since, until, groupBy } = req.query as Record<string, string>;
  if (groupBy === "client") {
    return res.json(await svc.marginsByClient(req.ctx!, since, until));
  }
  res.json(await svc.marginsByEvent(req.ctx!, since, until));
});

analyticsRouter.get("/revenue", requirePermission("analytics.view"), async (req, res) => {
  const { since, until } = req.query as Record<string, string>;
  res.json(await svc.revenueByPeriod(req.ctx!, since, until));
});
