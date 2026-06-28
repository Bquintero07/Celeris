import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Music, Mic, Image as ImgIcon, Lock, Globe, Briefcase, Heart, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { EVENT_TYPE_LABELS, CATEGORY_LABELS, label } from "@/lib/labels";

const templates = [
  { id: "concierto", label: "Concierto", icon: Music, prompt: "Concierto de música en vivo para " },
  { id: "charla", label: "Charla / Conferencia", icon: Mic, prompt: "Conferencia profesional para " },
  { id: "exposicion", label: "Exposición", icon: ImgIcon, prompt: "Exposición de arte para " },
  { id: "privado", label: "Evento privado", icon: Lock, prompt: "Cena de gala privada para " },
  { id: "publico", label: "Evento público", icon: Globe, prompt: "Festival público al aire libre para " },
  { id: "corporativo", label: "Corporativo", icon: Briefcase, prompt: "Lanzamiento de producto corporativo para " },
  { id: "boda", label: "Boda", icon: Heart, prompt: "Boda elegante para " },
];

const VALID_TYPES = ["concierto", "charla", "exposicion", "privado", "publico", "corporativo", "boda", "otro"];

export function NewEvent() {
  const nav = useNavigate();
  const { currency, format: fmt, symbol, copPerUsd } = useCurrency();

  // Amounts are stored in COP (the base currency); convert from the active display currency.
  const toCop = (n: number) => (currency === "USD" ? Math.round(n * copPerUsd) : n);

  // ---- AI mode state ----
  const [prompt, setPrompt] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [budgetCap, setBudgetCap] = useState<string>("");
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- Manual mode state ----
  const [m, setM] = useState({
    title: "", event_type: "corporativo", attendees: "", location: "",
    start_date: "", end_date: "", budget: "", revenue: "", description: "",
  });
  const [savingManual, setSavingManual] = useState(false);

  const generate = async () => {
    if (prompt.trim().length < 10) return toast.error("Describí el evento con más detalle");
    setLoading(true);
    try {
      const cap = budgetCap ? Number(budgetCap) : null;
      // Agent always works in COP (base currency). Convert from display currency if needed.
      const capInCop = cap && cap > 0 ? toCop(cap) : null;
      const result = await api.ai.generate({ prompt, template, currency: "COP", budget_cap: capInCop });
      setPlan(result);
      toast.success("Plan generado. Revisalo antes de guardar.");
    } catch (e: any) {
      toast.error(e.message || "Error al generar el plan");
    } finally {
      setLoading(false);
    }
  };

  const saveAi = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const event_type = VALID_TYPES.includes(plan.event_type) ? plan.event_type : "otro";
      const ev = await api.events.create({
        title: String(plan.title || "Evento sin título").slice(0, 200),
        event_type,
        description: plan.description ? String(plan.description).slice(0, 2000) : null,
        attendees: Number(plan.estimated_attendees) || 0,
        budget: Number(plan.estimated_budget) || 0,
        revenue: Number(plan.estimated_revenue) || 0,
        ai_prompt: prompt,
        ai_summary: plan.summary ? String(plan.summary).slice(0, 2000) : null,
      });
      const items = (plan.items ?? []).map((it: any) => ({
        category: String(it.category ?? "extras"),
        name: String(it.name ?? "Ítem").slice(0, 200),
        description: it.description ? String(it.description) : null,
        quantity: Number(it.quantity) || 1,
        unit_cost: Number(it.unit_cost) || 0,
        notes: it.notes ? String(it.notes) : null,
      }));
      if (items.length > 0) {
        await api.events.bulkAddItems(ev.id, items);
      }
      toast.success("Evento creado correctamente");
      nav(`/events/${ev.id}`);
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const saveManual = async () => {
    if (m.title.trim().length < 2) return toast.error("Ingresá un título para el evento");
    setSavingManual(true);
    try {
      const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
      const ev = await api.events.create({
        title: m.title.trim().slice(0, 200),
        event_type: VALID_TYPES.includes(m.event_type) ? m.event_type : "otro",
        attendees: m.attendees ? Number(m.attendees) : 0,
        location: m.location.trim() || null,
        start_date: toIso(m.start_date),
        end_date: toIso(m.end_date),
        // Budget/revenue are typed in the active currency; store them in COP.
        budget: m.budget ? toCop(Number(m.budget)) : null,
        revenue: m.revenue ? toCop(Number(m.revenue)) : null,
        description: m.description.trim().slice(0, 2000) || null,
      });
      toast.success("Evento creado. Agregá los ítems desde el detalle.");
      nav(`/events/${ev.id}`);
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSavingManual(false);
    }
  };

  const totalCost = plan?.items?.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_cost), 0) ?? 0;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Nuevo evento
        </h1>
        <p className="text-sm text-muted-foreground">Creá el evento a mano o dejá que la IA arme el plan completo.</p>
      </div>

      <Tabs defaultValue="manual">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="manual"><PencilLine className="h-4 w-4 mr-1" /> Manual</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="h-4 w-4 mr-1" /> Con IA</TabsTrigger>
        </TabsList>

        {/* -------- Manual -------- */}
        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Datos del evento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} maxLength={200} placeholder="Ej. Lanzamiento de marca X" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={m.event_type} onValueChange={(v) => setM({ ...m, event_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Asistentes</Label>
                  <Input type="number" min="0" value={m.attendees} onChange={(e) => setM({ ...m, attendees: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ubicación</Label>
                  <Input value={m.location} onChange={(e) => setM({ ...m, location: e.target.value })} placeholder="Ciudad / venue" />
                </div>
                <div className="space-y-1.5">
                  <Label>Inicio</Label>
                  <Input type="datetime-local" value={m.start_date} onChange={(e) => setM({ ...m, start_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin</Label>
                  <Input type="datetime-local" value={m.end_date} onChange={(e) => setM({ ...m, end_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Presupuesto / costo ({symbol})</Label>
                  <Input type="number" min="0" value={m.budget} onChange={(e) => setM({ ...m, budget: e.target.value })} placeholder="Opcional" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ingresos al cliente ({symbol})</Label>
                  <Input type="number" min="0" value={m.revenue} onChange={(e) => setM({ ...m, revenue: e.target.value })} placeholder="Opcional" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Textarea rows={3} value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} maxLength={2000} placeholder="Detalles, objetivos, requerimientos…" />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveManual} disabled={savingManual}>
                  {savingManual && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Crear evento
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Después de crear el evento, agregá los ítems y la cotización desde el detalle.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- IA -------- */}
        <TabsContent value="ai" className="mt-4 space-y-6">
          <Card>
            <CardHeader><CardTitle>1. Plantilla</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTemplate(t.id); if (!prompt) setPrompt(t.prompt); }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition ${
                      template === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <t.icon className="h-5 w-5" />
                    <span className="text-xs">{t.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. Describí tu evento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="p">Prompt</Label>
              <Textarea
                id="p"
                rows={5}
                placeholder="Ej. Concierto de rock al aire libre para 5000 personas, 3 bandas, escenario grande, comida y bebida..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
              />
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <Label htmlFor="cap">Tope de presupuesto opcional ({symbol})</Label>
                  <input
                    id="cap"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Dejá vacío para que decida la IA"
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">La IA usará rangos de mercado y no superará este tope.</p>
                </div>
                <Button onClick={generate} disabled={loading} className="glow-primary">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Generar plan
                </Button>
              </div>
            </CardContent>
          </Card>

          {plan && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span>3. Revisá el plan</span>
                  <Button onClick={saveAi} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Guardar evento
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-display text-xl font-bold">{plan.title}</h3>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary">{label(EVENT_TYPE_LABELS, plan.event_type)}</Badge>
                    <Badge variant="outline">{plan.estimated_attendees} asistentes</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  {plan.summary && <p className="mt-2 text-sm italic">{plan.summary}</p>}
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">Presupuesto IA</div>
                    <div className="font-display font-bold text-lg">{fmt(Number(plan.estimated_budget))}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">Ingresos proyectados</div>
                    <div className="font-display font-bold text-lg">{fmt(Number(plan.estimated_revenue))}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">Total de ítems</div>
                    <div className="font-display font-bold text-lg">{fmt(totalCost)}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{plan.items?.length ?? 0} ítems generados</h4>
                  <div className="rounded-lg border border-border divide-y divide-border max-h-96 overflow-auto">
                    {plan.items?.map((it: any, i: number) => (
                      <div key={i} className="p-3 flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{label(CATEGORY_LABELS, it.category)}</Badge>
                            {it.source === "owned"
                              ? <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-400">Propio</Badge>
                              : <Badge variant="secondary" className="text-[10px]">Externo</Badge>
                            }
                            <span className="font-medium">{it.name}</span>
                          </div>
                          {it.description && <div className="text-xs text-muted-foreground mt-1">{it.description}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-muted-foreground">{it.quantity} × {fmt(Number(it.unit_cost), { decimals: 2 })}</div>
                          <div className="font-semibold">{fmt(Number(it.quantity) * Number(it.unit_cost), { decimals: 2 })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Podés editar, agregar o eliminar ítems después de guardar.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
