import { Router } from "express";
import { z } from "zod";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate, validateUuidParams } from "../lib/validate.js";
import * as svc from "../services/billing.service.js";

export const billingRouter = Router();
billingRouter.use(requireModule("billing"));

const invoiceSchema = z.object({
  currency: z.string().length(3).optional(),
});

billingRouter.get("/", requirePermission("quotes.export"), async (req, res) => {
  res.json(await svc.listInvoices(req.ctx!));
});

billingRouter.post("/:eventId/invoice", requirePermission("quotes.export"), validateUuidParams("eventId"), validate(invoiceSchema), async (req, res) => {
  try {
    const { currency } = req.body;
    const canSeeMargin =
      req.ctx!.isSuperAdmin ||
      (req.ctx!.roles ?? []).some((r) => ["admin", "contable"].includes(r));
    const result = await svc.generateInvoice(req.ctx!, req.params.eventId as string, {
      currency,
      showMargin: canSeeMargin,
    });
    res.json(result);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
