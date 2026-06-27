import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

// Inline PDF generation with pdfkit (no DIAN integration — see TODO in DEPLOY.md)
let PDFDocument: any;
async function getPDF() {
  if (!PDFDocument) {
    const mod = await import("pdfkit");
    PDFDocument = mod.default ?? mod;
  }
  return PDFDocument;
}

const IVA_RATE = 0.19;

export async function generateInvoice(
  ctx: AuthContext,
  eventId: string,
  opts: { currency?: string; showMargin?: boolean } = {},
): Promise<{ base64: string; filename: string }> {
  if (!ctx.orgId) throw Object.assign(new Error("Sin organización"), { status: 403 });

  // Fetch event
  const events = await prisma.$queryRaw<any[]>`
    SELECT e.*, c.name AS client_name, c.contact_name, c.email AS client_email,
           c.address AS client_address, c.tax_id AS client_tax_id
    FROM public.events e
    LEFT JOIN public.clients c ON c.id = e.client_id
    WHERE e.id = ${eventId}::uuid AND e.organization_id = ${ctx.orgId}::uuid LIMIT 1
  `;
  const event = events[0];
  if (!event) throw Object.assign(new Error("Evento no encontrado"), { status: 404 });
  // Fetch org branding
  const orgs = await prisma.$queryRaw<any[]>`
    SELECT name, primary_color, accent_color, logo_url FROM public.organizations
    WHERE id = ${ctx.orgId}::uuid LIMIT 1
  `;
  const org = orgs[0];

  // Fetch items
  const items = await prisma.$queryRaw<any[]>`
    SELECT category, name, quantity, unit_cost, total_cost, base_cost, markup_pct, notes
    FROM public.event_items
    WHERE event_id = ${eventId}::uuid
    ORDER BY category, name
  `;

  const currency = opts.currency ?? "COP";
  const fmt = (n: number) =>
    `${currency} ${Number(n).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const subtotal  = items.reduce((s: number, i: any) => s + Number(i.total_cost), 0);
  const iva       = subtotal * IVA_RATE;
  const total     = subtotal + iva;
  const invoiceNo = `INV-${eventId.substring(0, 8).toUpperCase()}`;

  const PDF = await getPDF();
  const doc = new PDF({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  await new Promise<void>((resolve) => {
    doc.on("end", resolve);

    const primary = org?.primary_color ?? "#7C5CFF";

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill(primary);
    doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold")
       .text(org?.name ?? "Celeris", 50, 28);
    doc.fillColor("#ffffff").fontSize(10).font("Helvetica")
       .text("INVOICE", doc.page.width - 120, 35, { align: "right" });

    doc.fillColor("#111111").moveDown(4);

    // Invoice meta
    const today = new Date().toLocaleDateString("en-US");
    doc.fontSize(10).font("Helvetica-Bold").text("Invoice number:", 50, 110)
       .font("Helvetica").text(invoiceNo, 160, 110);
    doc.font("Helvetica-Bold").text("Date:", 50, 125)
       .font("Helvetica").text(today, 160, 125);
    doc.font("Helvetica-Bold").text("Status:", 50, 140)
       .font("Helvetica").text(event.approval_status.toUpperCase(), 160, 140);

    // Client block
    doc.moveTo(50, 165).lineTo(doc.page.width - 50, 165).strokeColor("#dddddd").stroke();
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(11).text("Bill To:", 50, 175);
    doc.font("Helvetica").fontSize(10)
       .text(event.client_name ?? "—", 50, 190, { width: 250, lineBreak: false, ellipsis: true })
       .text(event.contact_name ?? "", 50, 205, { width: 250, lineBreak: false, ellipsis: true })
       .text(event.client_email ?? "", 50, 220, { width: 250, lineBreak: false, ellipsis: true })
       .text(event.client_address ?? "", 50, 235, { width: 250, lineBreak: false, ellipsis: true })
       .text(event.client_tax_id ? `Tax ID: ${event.client_tax_id}` : "", 50, 250, { width: 250, lineBreak: false, ellipsis: true });

    // Event info — fixed-width values with ellipsis so long titles never overlap rows
    const evValX = 390;
    const evValW = doc.page.width - 50 - evValX;
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text("Event:", 330, 175)
       .font("Helvetica").text(event.title ?? "", evValX, 175, { width: evValW, height: 24, ellipsis: true })
       .font("Helvetica-Bold").text("Type:", 330, 205)
       .font("Helvetica").text(event.event_type ?? "", evValX, 205, { width: evValW, lineBreak: false, ellipsis: true });
    if (event.start_date) {
      doc.font("Helvetica-Bold").text("Date:", 330, 220)
         .font("Helvetica").text(new Date(event.start_date).toLocaleDateString("en-US"), evValX, 220, { width: evValW, lineBreak: false });
    }

    // Items table — column geometry (content area 50..page.width-50)
    const right     = doc.page.width - 50;
    const COL_CAT   = 55;
    const COL_DESC  = 115;
    const DESC_W    = 165;
    const QTY_R     = 320;  // right edge of qty column
    const UNIT_R    = 435;  // right edge of unit-price column
    const TOTAL_R   = right; // right edge of total column
    const MONEY_W   = 110;  // wide enough for "COP 1.234.567,00" — no wrapping

    const tableTop = 280;
    doc.rect(50, tableTop, doc.page.width - 100, 18).fill(primary);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
    doc.text("Category",    COL_CAT,            tableTop + 5, { width: DESC_W, lineBreak: false });
    doc.text("Description", COL_DESC,           tableTop + 5, { width: DESC_W, lineBreak: false });
    doc.text("Qty",         QTY_R - 40,         tableTop + 5, { width: 40, align: "right" });
    doc.text("Unit price",  UNIT_R - MONEY_W,   tableTop + 5, { width: MONEY_W, align: "right" });
    doc.text("Total",       TOTAL_R - MONEY_W,  tableTop + 5, { width: MONEY_W, align: "right" });

    let y = tableTop + 22;
    doc.font("Helvetica").fontSize(9);
    for (const [idx, item] of items.entries()) {
      if (idx % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 16).fill("#f7f7f7");
      doc.fillColor("#111111");
      doc.text(item.category, COL_CAT,  y, { width: COL_DESC - COL_CAT - 4, height: 11, ellipsis: true });
      doc.text(item.name,     COL_DESC, y, { width: DESC_W, height: 11, ellipsis: true });
      doc.text(String(Number(item.quantity).toFixed(0)), QTY_R - 40, y, { width: 40, align: "right" });
      doc.text(fmt(Number(item.unit_cost)),  UNIT_R - MONEY_W,  y, { width: MONEY_W, align: "right", lineBreak: false });
      doc.text(fmt(Number(item.total_cost)), TOTAL_R - MONEY_W, y, { width: MONEY_W, align: "right", lineBreak: false });
      y += 16;
    }

    // Totals
    const labelX = TOTAL_R - MONEY_W - 90;
    y += 10;
    doc.moveTo(50, y).lineTo(right, y).strokeColor("#dddddd").stroke();
    y += 8;
    doc.fillColor("#111111").font("Helvetica-Bold").text("Subtotal:", labelX, y, { width: 90 }).font("Helvetica").text(fmt(subtotal), TOTAL_R - MONEY_W, y, { width: MONEY_W, align: "right", lineBreak: false }); y += 16;
    doc.fillColor("#111111").font("Helvetica-Bold").text("IVA 19%:", labelX, y, { width: 90 }).font("Helvetica").text(fmt(iva), TOTAL_R - MONEY_W, y, { width: MONEY_W, align: "right", lineBreak: false }); y += 16;
    doc.rect(labelX, y, right - labelX, 20).fill(primary);
    doc.fillColor("#ffffff").font("Helvetica-Bold").text("TOTAL:", labelX + 5, y + 6, { width: 90 })
       .text(fmt(total), TOTAL_R - MONEY_W, y + 6, { width: MONEY_W - 5, align: "right", lineBreak: false });

    // Footer note
    doc.fillColor("#666666").font("Helvetica").fontSize(8)
       .text("This document is not a fiscal invoice (DIAN). See terms and conditions.", 50, doc.page.height - 60, { align: "center" });

    doc.end();
  });

  const buffer = Buffer.concat(chunks);
  return { base64: buffer.toString("base64"), filename: `invoice-${invoiceNo}.pdf` };
}

export async function listInvoices(ctx: AuthContext) {
  if (!ctx.orgId) return [];
  // Invoices are derived from approved/sent events; no separate table needed for MVP
  return prisma.$queryRaw<any[]>`
    SELECT e.id, e.title, e.approval_status, e.revenue, e.start_date,
           c.name AS client_name
    FROM public.events e
    LEFT JOIN public.clients c ON c.id = e.client_id
    WHERE e.organization_id = ${ctx.orgId}::uuid
      AND e.approval_status IN ('approved','sent')
    ORDER BY e.start_date DESC NULLS LAST
  `;
}
