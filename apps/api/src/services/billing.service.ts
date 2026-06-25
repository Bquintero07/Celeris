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
  if (!ctx.orgId) throw Object.assign(new Error("No organization"), { status: 403 });

  // Fetch event
  const events = await prisma.$queryRaw<any[]>`
    SELECT e.*, c.name AS client_name, c.contact_name, c.email AS client_email,
           c.address AS client_address, c.tax_id AS client_tax_id
    FROM public.events e
    LEFT JOIN public.clients c ON c.id = e.client_id
    WHERE e.id = ${eventId}::uuid AND e.organization_id = ${ctx.orgId}::uuid LIMIT 1
  `;
  const event = events[0];
  if (!event) throw Object.assign(new Error("Event not found"), { status: 404 });
  if (event.approval_status !== "approved" && event.approval_status !== "sent") {
    throw Object.assign(new Error("Event must be approved before generating an invoice"), { status: 422 });
  }

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
    doc.font("Helvetica-Bold").fontSize(11).text("Bill To:", 50, 175);
    doc.font("Helvetica").fontSize(10)
       .text(event.client_name ?? "—", 50, 190)
       .text(event.contact_name ?? "", 50, 205)
       .text(event.client_email ?? "", 50, 220)
       .text(event.client_address ?? "", 50, 235)
       .text(event.client_tax_id ? `Tax ID: ${event.client_tax_id}` : "", 50, 250);

    // Event info
    doc.font("Helvetica-Bold").text("Event:", 330, 175)
       .font("Helvetica").text(event.title, 390, 175)
       .font("Helvetica-Bold").text("Type:", 330, 190)
       .font("Helvetica").text(event.event_type, 390, 190);
    if (event.start_date) {
      doc.font("Helvetica-Bold").text("Date:", 330, 205)
         .font("Helvetica").text(new Date(event.start_date).toLocaleDateString("en-US"), 390, 205);
    }

    // Items table
    const tableTop = 280;
    doc.rect(50, tableTop, doc.page.width - 100, 18).fill(primary);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
    doc.text("Category",   55, tableTop + 5);
    doc.text("Description", 130, tableTop + 5);
    doc.text("Qty",          360, tableTop + 5, { width: 40, align: "right" });
    doc.text("Unit price",   405, tableTop + 5, { width: 70, align: "right" });
    doc.text("Total",        480, tableTop + 5, { width: 65, align: "right" });

    let y = tableTop + 22;
    doc.fillColor("#111111").font("Helvetica").fontSize(9);
    for (const [idx, item] of items.entries()) {
      if (idx % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 16).fill("#f7f7f7");
      doc.fillColor("#111111");
      doc.text(item.category,  55, y, { width: 70 });
      doc.text(item.name,      130, y, { width: 225 });
      doc.text(String(Number(item.quantity).toFixed(0)), 360, y, { width: 40, align: "right" });
      doc.text(fmt(Number(item.unit_cost)), 405, y, { width: 70, align: "right" });
      doc.text(fmt(Number(item.total_cost)), 480, y, { width: 65, align: "right" });
      y += 16;
    }

    // Totals
    const totalsX = 380;
    y += 10;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#dddddd").stroke();
    y += 8;
    doc.font("Helvetica-Bold").text("Subtotal:",  totalsX, y).font("Helvetica").text(fmt(subtotal), 480, y, { width: 65, align: "right" }); y += 16;
    doc.font("Helvetica-Bold").text("IVA 19%:",   totalsX, y).font("Helvetica").text(fmt(iva),      480, y, { width: 65, align: "right" }); y += 16;
    doc.rect(totalsX, y, doc.page.width - 50 - totalsX, 20).fill(primary);
    doc.fillColor("#ffffff").font("Helvetica-Bold").text("TOTAL:", totalsX + 5, y + 5)
       .text(fmt(total), 480, y + 5, { width: 65, align: "right" });

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
