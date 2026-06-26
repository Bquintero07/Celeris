import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Download, FileSpreadsheet, Plus, Trash2, ArrowLeft, Save,
  UserPlus, Wand2, Sparkles, Loader2, CheckCircle, Send,
  RotateCcw, XCircle, LayoutTemplate,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMyRoles } from "@/lib/use-my-roles";
import { APPROVAL_STATUS_LABELS, CATEGORY_LABELS, EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, label } from "@/lib/labels";

const CATS = [
  "personal", "catering", "equipo", "mobiliario", "audio_video",
  "iluminacion", "transporte", "seguridad", "permisos", "marketing", "extras",
] as const;
const STATUSES = ["borrador", "planificacion", "confirmado", "en_curso", "finalizado", "cancelado"];
const TYPES    = ["concierto", "charla", "exposicion", "privado", "publico", "corporativo", "boda", "otro"];

const APPROVAL_COLORS: Record<string, string> = {
  draft:    "bg-muted text-muted-foreground border-border",
  review:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  sent:     "bg-blue-500/20 text-blue-400 border-blue-500/30",
  rejected: "bg-destructive/20 text-destructive border-destructive/30",
};

function downloadBase64(base64: string, filename: string, mime: string) {
  const bin   = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob  = new Blob([bytes], { type: mime });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const nav     = useNavigate();
  const qc      = useQueryClient();
  const { currency, format: fmt, symbol } = useCurrency();
  const { can, isAdmin, isSuperAdmin } = useMyRoles();

  const canViewMargin = isSuperAdmin || can("quotes.view_margin");
  const canApprove    = isAdmin;
  const canEdit       = can("events.edit");

  const { data, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api.events.get(id!),
  });
  const { data: personnelList } = useQuery({
    queryKey: ["personnel"],
    queryFn: () => api.personnel.list(),
  });
  const { data: clientList = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.clients.list(),
  });
  const { data: templateList = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.templates.list(),
  });

  const [form, setForm] = useState<any>(null);
  const [newItem, setNewItem] = useState({ category: "personal", name: "", quantity: 1, unit_cost: 0 });
  const [personnelOpen, setPersonnelOpen]   = useState(false);
  const [templateOpen, setTemplateOpen]     = useState(false);
  const [aiOpen, setAiOpen]                 = useState(false);
  const [aiLoading, setAiLoading]           = useState(false);
  const [aiLines, setAiLines]               = useState<any[]>([]);
  const [aiNotes, setAiNotes]               = useState<string[]>([]);
  const [approvalNote, setApprovalNote]     = useState("");

  useEffect(() => {
    if (data && !form) setForm({ ...data });
  }, [data, form]);

  // Approval mutations
  const approvalMut = useMutation({
    mutationFn: ({ action, note }: { action: "submit" | "approve" | "send" | "reject"; note?: string }) =>
      api.approval[action](id!, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["events"] });
      setApprovalNote("");
      toast.success("Approval status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Template apply mutation
  const templateMut = useMutation({
    mutationFn: (templateId: string) => api.templates.apply(templateId, id!),
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      setTemplateOpen(false);
      toast.success(`${rows.length} items added from template`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data || !form) return <div className="p-6">Loading…</div>;

  const items      = data.items as any[];
  const totalCost  = items.reduce((s: number, i: any) => s + Number(i.total_cost), 0);
  const revenue    = Number(form.revenue || 0);
  const margin     = revenue - totalCost;
  const marginPct  = revenue > 0 ? (margin / revenue) * 100 : 0;
  const approvalStatus = data.approval_status ?? "draft";

  const saveHeader = async () => {
    await api.events.update(id!, {
      title: form.title, event_type: form.event_type, status: form.status,
      description: form.description, location: form.location,
      start_date: form.start_date || null, end_date: form.end_date || null,
      attendees: Number(form.attendees) || 0,
      budget: Number(form.budget) || 0,
      revenue: Number(form.revenue) || 0,
      client_id: form.client_id || null,
    });
    qc.invalidateQueries({ queryKey: ["event", id] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Saved");
  };

  const addItem = async () => {
    if (!newItem.name) return toast.error("Name required");
    await api.events.items.add(id!, {
      category: newItem.category,
      name: newItem.name,
      quantity: Number(newItem.quantity),
      unit_cost: Number(newItem.unit_cost),
    });
    setNewItem({ category: newItem.category, name: "", quantity: 1, unit_cost: 0 });
    qc.invalidateQueries({ queryKey: ["event", id] });
    toast.success("Item added");
  };

  const removeItem = async (itemId: string) => {
    await api.events.items.delete(itemId);
    qc.invalidateQueries({ queryKey: ["event", id] });
  };

  const editItem = async (itemId: string, patch: any) => {
    await api.events.items.update(itemId, patch);
    qc.invalidateQueries({ queryKey: ["event", id] });
  };

  const removeEvent = async () => {
    if (!confirm("Delete this event?")) return;
    await api.events.delete(id!);
    toast.success("Event deleted");
    nav("/events");
  };

  const assignPerson = async (person: any, hours: number, rate: number, notes: string) => {
    if (!hours || hours <= 0) return toast.error("Enter hours");
    await api.events.items.add(id!, {
      category: "personal",
      name: `${person.full_name} — ${person.role}`,
      quantity: Number(hours),
      unit_cost: Number(rate),
      personnel_id: person.id,
      notes: notes || null,
    });
    qc.invalidateQueries({ queryKey: ["event", id] });
    toast.success(`${person.full_name} assigned`);
  };

  const matchBudgetToItems = async () => {
    setForm({ ...form, budget: totalCost.toFixed(2) });
    await api.events.update(id!, { budget: Number(totalCost.toFixed(2)) });
    qc.invalidateQueries({ queryKey: ["event", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.success("Budget adjusted to items total");
  };

  const generateWithAI = async () => {
    setAiLines([]); setAiNotes([]); setAiLoading(true); setAiOpen(true);
    try {
      const result = await api.quotes.aiSuggest(id!, {
        prompt: form.description || form.ai_prompt || form.title,
        budget: Number(form.budget) || undefined,
      });
      setAiLines(result.lines ?? []); setAiNotes(result.notes ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "AI service unavailable");
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAILines = async () => {
    try {
      await api.quotes.apply(id!, aiLines);
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setAiOpen(false); setAiLines([]);
      toast.success("AI quote applied");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to apply lines");
    }
  };

  const downloadPdf = async () => {
    try {
      const r = await api.events.exportPdf(id!, currency);
      if (r.base64) downloadBase64(r.base64, r.filename, "application/pdf");
      else toast.error("PDF generation failed");
    } catch (e: any) {
      toast.error(e.message ?? "PDF generation failed");
    }
  };
  const downloadXls = async () => {
    try {
      const r = await api.events.exportExcel(id!, currency);
      if (r.base64) downloadBase64(r.base64, r.filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      else toast.error("Export failed");
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/events" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Events
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadPdf}><Download className="h-4 w-4 mr-1" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={downloadXls}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          {canEdit && <Button variant="destructive" size="sm" onClick={removeEvent}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>

      {/* Approval bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Quote status:</span>
        <Badge className={APPROVAL_COLORS[approvalStatus] ?? ""} variant="outline">
          {label(APPROVAL_STATUS_LABELS, approvalStatus)}
        </Badge>
        {canEdit && approvalStatus === "draft" && (
          <Button size="sm" variant="outline" onClick={() => approvalMut.mutate({ action: "submit" })} disabled={approvalMut.isPending}>
            <Send className="h-3.5 w-3.5 mr-1" /> Submit for review
          </Button>
        )}
        {canApprove && approvalStatus === "review" && (
          <>
            <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/40"
              onClick={() => approvalMut.mutate({ action: "approve" })} disabled={approvalMut.isPending}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="text-destructive border-destructive/40"
              onClick={() => approvalMut.mutate({ action: "reject" })} disabled={approvalMut.isPending}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
          </>
        )}
        {canApprove && approvalStatus === "approved" && (
          <Button size="sm" variant="outline" className="text-blue-400 border-blue-500/40"
            onClick={() => approvalMut.mutate({ action: "send" })} disabled={approvalMut.isPending}>
            <Send className="h-3.5 w-3.5 mr-1" /> Mark as sent
          </Button>
        )}
        {canApprove && approvalStatus === "rejected" && (
          <Button size="sm" variant="outline"
            onClick={() => approvalMut.mutate({ action: "submit" })} disabled={approvalMut.isPending}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Re-submit
          </Button>
        )}
      </div>

      {/* KPIs — margin only shown if user has permission */}
      <div className={`grid gap-3 ${canViewMargin ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
        <Kpi label="Total cost"  value={fmt(totalCost)} />
        <Kpi label="Revenue"     value={fmt(revenue)} />
        {canViewMargin && (
          <>
            <Kpi label="Margin"       value={fmt(margin)}               tone={margin    >= 0 ? "success" : "destructive"} />
            <Kpi label="Profitability" value={`${marginPct.toFixed(1)}%`} tone={marginPct >= 0 ? "success" : "destructive"} />
          </>
        )}
      </div>

      {Math.abs(Number(form.budget || 0) - totalCost) > 0.01 && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-3 flex items-center justify-between gap-3 text-sm flex-wrap">
          <div>
            <span className="text-muted-foreground">Saved budget: </span>
            <span className="font-semibold">{fmt(Number(form.budget || 0))}</span>
            <span className="text-muted-foreground"> · Items total: </span>
            <span className="font-semibold">{fmt(totalCost)}</span>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={matchBudgetToItems}>
              <Wand2 className="h-4 w-4 mr-1" /> Adjust to total
            </Button>
          )}
        </div>
      )}

      {/* Header form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Event details</span>
            {canEdit && <Button size="sm" onClick={saveHeader}><Save className="h-4 w-4 mr-1" /> Save</Button>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Title</Label>
            <Input value={form.title} disabled={!canEdit} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.event_type} disabled={!canEdit} onValueChange={(v) => setForm({ ...form, event_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{label(EVENT_TYPE_LABELS, t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} disabled={!canEdit} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t}>{label(EVENT_STATUS_LABELS, t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Client</Label>
            <Select value={form.client_id ?? "__none__"} disabled={!canEdit} onValueChange={(v) => setForm({ ...form, client_id: v === "__none__" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="No client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No client</SelectItem>
                {clientList.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label>Attendees</Label>
            <Input type="number" value={form.attendees ?? 0} disabled={!canEdit} onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
          </div>
          <div>
            <Label>Start</Label>
            <Input type="datetime-local" disabled={!canEdit}
              value={form.start_date ? form.start_date.slice(0, 16) : ""}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <Label>End</Label>
            <Input type="datetime-local" disabled={!canEdit}
              value={form.end_date ? form.end_date.slice(0, 16) : ""}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div>
            <Label>Budget ({symbol})</Label>
            <Input type="number" step="0.01" disabled={!canEdit} value={form.budget ?? 0} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div>
            <Label>Projected revenue ({symbol})</Label>
            <Input type="number" step="0.01" disabled={!canEdit} value={form.revenue ?? 0} onChange={(e) => setForm({ ...form, revenue: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea rows={3} disabled={!canEdit} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Event items ({items.length})</span>
            {canEdit && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={generateWithAI} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Generate with AI
                </Button>

                {/* Template picker */}
                <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><LayoutTemplate className="h-4 w-4 mr-1" /> Use template</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Apply a template</DialogTitle></DialogHeader>
                    {templateList.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No templates yet. Create them in the Templates section.</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-auto">
                        {templateList.map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{t.name}</p>
                              <p className="text-xs text-muted-foreground">{label(EVENT_TYPE_LABELS, t.event_type)}</p>
                            </div>
                            <Button size="sm" onClick={() => templateMut.mutate(t.id)} disabled={templateMut.isPending}>
                              Apply
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTemplateOpen(false)}>Close</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={personnelOpen} onOpenChange={setPersonnelOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><UserPlus className="h-4 w-4 mr-1" /> Assign personnel</Button>
                  </DialogTrigger>
                  <AssignPersonnelDialog
                    personnel={personnelList ?? []}
                    onAssign={async (p, h, r, n) => { await assignPerson(p, h, r, n); }}
                    onClose={() => setPersonnelOpen(false)}
                    fmt={fmt}
                    symbol={symbol}
                  />
                </Dialog>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4 p-3 rounded-lg border border-dashed border-border">
              <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{label(CATEGORY_LABELS, c)}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <Input type="number" placeholder="Qty" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
              <Input type="number" placeholder="Unit cost" value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: Number(e.target.value) })} />
              <Button onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
          )}

          <div className="space-y-2">
            {CATS.filter((c) => items.some((i: any) => i.category === c)).map((cat) => (
              <div key={cat}>
                <h4 className="font-semibold text-sm uppercase text-muted-foreground mt-3 mb-1">{label(CATEGORY_LABELS, cat)}</h4>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {items.filter((i: any) => i.category === cat).map((i: any) => {
                    const baseCost   = i.base_cost != null ? Number(i.base_cost) : Number(i.unit_cost);
                    const selling    = Number(i.unit_cost);
                    const markupPct  = baseCost > 0 ? ((selling - baseCost) / baseCost * 100) : 0;
                    return (
                      <div key={i.id} className="p-3 grid grid-cols-12 gap-2 items-center text-sm">
                        <Input className="col-span-4" defaultValue={i.name}
                          disabled={!canEdit}
                          onBlur={(e) => canEdit && e.target.value !== i.name && editItem(i.id, { name: e.target.value })} />
                        <Input className="col-span-2" type="number" defaultValue={i.quantity}
                          disabled={!canEdit}
                          onBlur={(e) => canEdit && Number(e.target.value) !== Number(i.quantity) && editItem(i.id, { quantity: Number(e.target.value) })} />
                        <Input className="col-span-2" type="number" step="0.01" defaultValue={i.unit_cost}
                          disabled={!canEdit}
                          onBlur={(e) => canEdit && Number(e.target.value) !== Number(i.unit_cost) && editItem(i.id, { unit_cost: Number(e.target.value) })} />
                        <div className="col-span-2 text-right font-semibold">
                          {fmt(Number(i.total_cost), { decimals: 2 })}
                          {canViewMargin && markupPct > 0 && (
                            <div className="text-xs font-normal text-emerald-400">+{markupPct.toFixed(0)}%</div>
                          )}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          {canEdit && (
                            <Button size="icon" variant="ghost" onClick={() => removeItem(i.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">No items yet. Add the first one above or use a template.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Suggest Dialog */}
      <Dialog open={aiOpen} onOpenChange={(o) => { if (!aiLoading) setAiOpen(o); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Quote Suggestion
            </DialogTitle>
          </DialogHeader>

          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Analyzing event and generating quote lines…</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto space-y-4">
              {aiLines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No lines returned by the AI.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Review and edit the suggested lines. Click <strong>Apply</strong> to replace the current event items.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                        <TableHead className="w-20">Days</TableHead>
                        <TableHead className="w-28">Unit cost</TableHead>
                        {canViewMargin && <TableHead className="w-24">Markup %</TableHead>}
                        <TableHead className="w-28 text-right">Total</TableHead>
                        <TableHead className="w-24">Source</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiLines.map((line, idx) => {
                        const total = Number(line.unitCost) * Number(line.quantity) * Number(line.days || 1) * (1 + Number(line.markup ?? 0) / 100);
                        const upd = (patch: Partial<typeof line>) =>
                          setAiLines((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{label(CATEGORY_LABELS, line.category)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-sm" value={line.name} onChange={(e) => upd({ name: e.target.value })} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-sm" type="number" min={1} value={line.quantity} onChange={(e) => upd({ quantity: Number(e.target.value) })} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-sm" type="number" min={1} value={line.days ?? 1} onChange={(e) => upd({ days: Number(e.target.value) })} />
                            </TableCell>
                            <TableCell>
                              <Input className="h-7 text-sm" type="number" min={0} step="0.01" value={line.unitCost} onChange={(e) => upd({ unitCost: Number(e.target.value) })} />
                            </TableCell>
                            {canViewMargin && (
                              <TableCell>
                                <Input className="h-7 text-sm" type="number" min={0} step="0.1" value={line.markup ?? 0} onChange={(e) => upd({ markup: Number(e.target.value) })} />
                              </TableCell>
                            )}
                            <TableCell className="text-right font-semibold text-sm">{fmt(total, { decimals: 0 })}</TableCell>
                            <TableCell>
                              <Badge variant={line.source === "owned" ? "secondary" : "outline"} className="text-xs">{line.source}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => setAiLines((prev) => prev.filter((_, i) => i !== idx))}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="text-sm text-right text-muted-foreground pr-2">
                    Total estimate:{" "}
                    <span className="font-bold text-foreground">
                      {fmt(aiLines.reduce((s, l) => s + Number(l.unitCost) * Number(l.quantity) * Number(l.days || 1) * (1 + Number(l.markup ?? 0) / 100), 0), { decimals: 0 })}
                    </span>
                  </div>
                  {aiNotes.length > 0 && (
                    <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs space-y-1">
                      <p className="font-semibold text-muted-foreground uppercase text-xs tracking-wide">AI notes</p>
                      {aiNotes.map((n, i) => <p key={i}>• {n}</p>)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={aiLoading}>Cancel</Button>
            <Button onClick={applyAILines} disabled={aiLoading || aiLines.length === 0}>
              <Wand2 className="h-4 w-4 mr-1" /> Apply to event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, tone = "default" }: {
  label: string; value: string; tone?: "default" | "success" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase">{label}</div>
        <div className={`mt-1 font-display text-2xl font-bold ${
          tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""
        }`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function AssignPersonnelDialog({
  personnel, onAssign, onClose, fmt, symbol,
}: {
  personnel: any[];
  onAssign: (person: any, hours: number, rate: number, notes: string) => Promise<void>;
  onClose: () => void;
  fmt: (n: number, o?: any) => string;
  symbol: string;
}) {
  const [rows, setRows] = useState<Record<string, { hours: string; rate: string; notes: string }>>({});
  const upd = (id: string, patch: Partial<{ hours: string; rate: string; notes: string }>) =>
    setRows((r) => ({ ...r, [id]: { hours: r[id]?.hours ?? "", rate: r[id]?.rate ?? "", notes: r[id]?.notes ?? "", ...patch } }));

  const assignAll = async () => {
    const entries = Object.entries(rows).filter(([, v]) => Number(v.hours) > 0);
    if (entries.length === 0) return toast.error("Enter hours for at least one person");
    for (const [pid, v] of entries) {
      const p = personnel.find((x) => x.id === pid);
      if (!p) continue;
      const rate = Number(v.rate) > 0 ? Number(v.rate) : Number(p.hourly_rate);
      await onAssign(p, Number(v.hours), rate, v.notes);
    }
    setRows({}); onClose();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Assign personnel to event</DialogTitle></DialogHeader>
      <div className="max-h-[60vh] overflow-auto -mx-1 px-1 space-y-2">
        {personnel.length === 0 && (
          <p className="text-sm text-muted-foreground">No personnel registered. Add people in the Personnel section.</p>
        )}
        {personnel.map((p) => {
          const r    = rows[p.id] ?? { hours: "", rate: "", notes: "" };
          const rate = Number(r.rate) > 0 ? Number(r.rate) : Number(p.hourly_rate);
          const total = Number(r.hours) * rate;
          return (
            <div key={p.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-medium text-sm">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">{p.role} · {fmt(Number(p.hourly_rate), { decimals: 2 })}/{symbol}h</div>
                </div>
                {total > 0 && <Badge variant="secondary">{fmt(total, { decimals: 2 })}</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Hours</Label>
                  <Input type="number" min="0" step="0.5" value={r.hours} onChange={(e) => upd(p.id, { hours: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Rate/h ({symbol})</Label>
                  <Input type="number" min="0" step="0.01" placeholder={String(p.hourly_rate)} value={r.rate} onChange={(e) => upd(p.id, { rate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Input value={r.notes} onChange={(e) => upd(p.id, { notes: e.target.value })} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={assignAll}><UserPlus className="h-4 w-4 mr-1" /> Assign selected</Button>
      </DialogFooter>
    </DialogContent>
  );
}
