import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Music, Mic, Image as ImgIcon, Lock, Globe, Briefcase, Heart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";

const templates = [
  { id: "concierto", label: "Concert", icon: Music, prompt: "Live music concert for " },
  { id: "charla", label: "Talk / Conference", icon: Mic, prompt: "Professional conference for " },
  { id: "exposicion", label: "Exhibition", icon: ImgIcon, prompt: "Art exhibition for " },
  { id: "privado", label: "Private event", icon: Lock, prompt: "Private gala dinner event for " },
  { id: "publico", label: "Public event", icon: Globe, prompt: "Outdoor public festival for " },
  { id: "corporativo", label: "Corporate", icon: Briefcase, prompt: "Corporate product launch for " },
  { id: "boda", label: "Wedding", icon: Heart, prompt: "Elegant wedding for " },
];

export function NewEvent() {
  const nav = useNavigate();
  const { currency, format: fmt, symbol } = useCurrency();
  const [prompt, setPrompt] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [budgetCap, setBudgetCap] = useState<string>("");
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    if (prompt.trim().length < 10) return toast.error("Please describe the event in more detail");
    setLoading(true);
    try {
      const cap = budgetCap ? Number(budgetCap) : null;
      const result = await api.ai.generate({ prompt, template, currency, budget_cap: cap && cap > 0 ? cap : null });
      setPlan(result);
      toast.success("Plan generated. Review it before saving.");
    } catch (e: any) {
      toast.error(e.message || "Error generating the plan");
    } finally {
      setLoading(false);
    }
  };

  const VALID_TYPES = ["concierto", "charla", "exposicion", "privado", "publico", "corporativo", "boda", "otro"];

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const event_type = VALID_TYPES.includes(plan.event_type) ? plan.event_type : "otro";
      const ev = await api.events.create({
        title: String(plan.title || "Untitled event").slice(0, 200),
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
        name: String(it.name ?? "Item").slice(0, 200),
        description: it.description ? String(it.description) : null,
        quantity: Number(it.quantity) || 1,
        unit_cost: Number(it.unit_cost) || 0,
        notes: it.notes ? String(it.notes) : null,
      }));
      if (items.length > 0) {
        await api.events.bulkAddItems(ev.id, items);
      }
      toast.success("Event created successfully");
      nav(`/events/${ev.id}`);
    } catch (e: any) {
      toast.error(e.message || "Error saving");
    } finally {
      setSaving(false);
    }
  };

  const totalCost = plan?.items?.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_cost), 0) ?? 0;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> New AI Event
        </h1>
        <p className="text-sm text-muted-foreground">Choose a template and describe your event. The AI will generate the full plan.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Template</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>2. Describe your event</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="p">Prompt</Label>
          <Textarea
            id="p"
            rows={5}
            placeholder="e.g. Outdoor rock concert for 5000 people, 3 bands, large stage, food and drinks..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={2000}
          />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <Label htmlFor="cap">Optional budget cap ({symbol})</Label>
              <input
                id="cap"
                type="number"
                min="0"
                step="100"
                placeholder="Leave empty for AI to decide"
                value={budgetCap}
                onChange={(e) => setBudgetCap(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">The AI will use market ranges and won't exceed this cap.</p>
            </div>
            <Button onClick={generate} disabled={loading} className="glow-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generate plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>3. Review the plan</span>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save event
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-display text-xl font-bold">{plan.title}</h3>
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary">{plan.event_type}</Badge>
                <Badge variant="outline">{plan.estimated_attendees} attendees</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              {plan.summary && <p className="mt-2 text-sm italic">{plan.summary}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">AI Budget</div>
                <div className="font-display font-bold text-lg">{fmt(Number(plan.estimated_budget))}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Projected Revenue</div>
                <div className="font-display font-bold text-lg">{fmt(Number(plan.estimated_revenue))}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Items total</div>
                <div className="font-display font-bold text-lg">{fmt(totalCost)}</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">{plan.items?.length ?? 0} items generated</h4>
              <div className="rounded-lg border border-border divide-y divide-border max-h-96 overflow-auto">
                {plan.items?.map((it: any, i: number) => (
                  <div key={i} className="p-3 flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{it.category}</Badge>
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
              <p className="text-xs text-muted-foreground mt-2">You can edit, add or delete items after saving.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
