import { Router } from "express";
import multer from "multer";
import { requirePermission } from "../middleware/rbac.js";
import { prisma } from "../lib/prisma.js";

export const documentsRouter = Router();

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf":                                                               "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":      "docx",
  "application/msword":                                                            "doc",
  "text/plain":                                                                    "txt",
  "text/csv":                                                                      "csv",
  "text/markdown":                                                                 "md",
  "application/json":                                                              "json",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

const webhookUrl = () =>
  process.env.NODE_ENV === "test"
    ? (process.env.N8N_WEBHOOK_URL_TEST ?? process.env.N8N_WEBHOOK_URL ?? "")
    : (process.env.N8N_WEBHOOK_URL ?? "");

// POST /api/documents/upload
documentsRouter.post(
  "/upload",
  requirePermission("documents.upload"),
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    const { orgId, userId } = req.ctx!;
    if (!orgId) return res.status(403).json({ error: "No organization" });

    const fileType = ALLOWED_TYPES[file.mimetype] ?? "unknown";

    // Forward to n8n webhook
    const form = new FormData();
    form.append("data", new Blob([file.buffer as unknown as ArrayBuffer], { type: file.mimetype }), file.originalname);
    form.append("org_id", orgId);

    const webhookRes = await fetch(webhookUrl(), {
      method: "POST",
      headers: { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET ?? "" },
      body: form,
    });

    if (!webhookRes.ok) {
      const text = await webhookRes.text();
      return res.status(502).json({ error: `n8n error: ${text}` });
    }

    // Save metadata record
    await prisma.$executeRaw`
      INSERT INTO public.org_documents (organization_id, name, file_type, uploaded_by)
      VALUES (${orgId}::uuid, ${file.originalname}, ${fileType}, ${userId ?? null}::uuid)
    `;

    res.json({ ok: true, name: file.originalname, file_type: fileType });
  },
);

// GET /api/documents
documentsRouter.get("/", requirePermission("documents.upload"), async (req, res) => {
  const { orgId } = req.ctx!;
  if (!orgId) return res.status(403).json({ error: "No organization" });

  const docs = await prisma.$queryRaw<any[]>`
    SELECT id, name, file_type, created_at
    FROM public.org_documents
    WHERE organization_id = ${orgId}::uuid
    ORDER BY created_at DESC
  `;
  res.json(docs);
});

// DELETE /api/documents/:id
documentsRouter.delete("/:id", requirePermission("documents.upload"), async (req, res) => {
  const { orgId } = req.ctx!;
  if (!orgId) return res.status(403).json({ error: "No organization" });

  await prisma.$executeRaw`
    DELETE FROM public.org_documents
    WHERE id = ${req.params.id}::uuid AND organization_id = ${orgId}::uuid
  `;
  res.status(204).end();
});
