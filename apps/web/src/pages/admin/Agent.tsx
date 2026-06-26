import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Bot, CircleCheck, CircleX } from "lucide-react";
import { api, type AgentConfig } from "@/lib/api";

const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

export function AdminAgent() {
  const cfgQ = useQuery({ queryKey: ["agent-config"], queryFn: () => api.superAdmin.agentGetConfig() });
  const healthQ = useQuery({ queryKey: ["agent-health"], queryFn: () => api.superAdmin.agentHealth(), refetchInterval: 15000 });
  const [form, setForm] = useState<AgentConfig | null>(null);

  useEffect(() => { if (cfgQ.data && !form) setForm(cfgQ.data); }, [cfgQ.data, form]);

  const saveMut = useMutation({
    mutationFn: () => api.superAdmin.agentSetConfig(form!),
    onSuccess: (d) => { setForm(d); toast.success("Configuración del agente guardada"); },
    onError: (e: any) => toast.error(e?.message ?? "Error al guardar"),
  });

  if (cfgQ.isLoading || !form) {
    return <div className="p-10 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }

  const set = (patch: Partial<AgentConfig>) => setForm({ ...form, ...patch });
  const healthy = healthQ.data?.ok;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">Operador</div>
          <h1 className="font-display text-3xl font-semibold mt-1 flex items-center gap-2"><Bot className="h-7 w-7" /> Agente IA</h1>
        </div>
        <div className={`flex items-center gap-1.5 text-sm ${healthy ? "text-emerald-500" : "text-red-500"}`}>
          {healthy ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
          {healthQ.isLoading ? "…" : healthy ? "Servicio activo" : "Sin conexión"}
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card/70 p-5 space-y-5">
        <div>
          <Label>Modelo</Label>
          <Select value={form.model} onValueChange={(v) => set({ model: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex justify-between"><Label>Temperature</Label><span className="text-sm text-muted-foreground">{form.temperature.toFixed(2)}</span></div>
          <Slider min={0} max={2} step={0.05} value={[form.temperature]} onValueChange={([v]) => set({ temperature: v })} className="mt-2" />
        </div>

        <div>
          <Label>Max tokens (opcional)</Label>
          <Input type="number" min={1} value={form.max_tokens ?? ""} placeholder="por defecto del modelo"
            onChange={(e) => set({ max_tokens: e.target.value ? Number(e.target.value) : null })} />
        </div>

        <div>
          <Label>Instrucción extra para planes de evento (opcional)</Label>
          <Textarea rows={3} value={form.plan_system_prompt ?? ""} placeholder="Se agrega como system prompt adicional…"
            onChange={(e) => set({ plan_system_prompt: e.target.value || null })} />
        </div>

        <div>
          <Label>Instrucción extra para cotizaciones (opcional)</Label>
          <Textarea rows={3} value={form.quote_system_prompt ?? ""} placeholder="Se agrega como system prompt adicional…"
            onChange={(e) => set({ quote_system_prompt: e.target.value || null })} />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar
          </Button>
        </div>
      </section>
    </div>
  );
}
