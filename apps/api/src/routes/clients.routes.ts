import { Router } from "express";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import * as svc from "../services/clients.service.js";

export const clientsRouter = Router();
clientsRouter.use(requireModule("events_quotes"));

clientsRouter.get("/", requirePermission("clients.view"), async (req, res) => {
  res.json(await svc.list(req.ctx!));
});

clientsRouter.post("/", requirePermission("clients.manage"), async (req, res) => {
  try {
    const row = await svc.upsert(req.ctx!, req.body);
    res.status(201).json(row);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

clientsRouter.patch("/:id", requirePermission("clients.manage"), async (req, res) => {
  try {
    const row = await svc.upsert(req.ctx!, { ...req.body, id: req.params.id as string });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

clientsRouter.delete("/:id", requirePermission("clients.manage"), async (req, res) => {
  await svc.remove(req.ctx!, req.params.id as string);
  res.status(204).end();
});
