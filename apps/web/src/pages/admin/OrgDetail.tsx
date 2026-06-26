import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { MODULES } from "@celeris/shared";
import { api } from "@/lib/api";

const MODULE_LABELS: Record<string, string> = {
  events_quotes: "Eventos y cotizaciones (core)",
  inventory: "Inventario",
  suppliers: "Proveedores",
  crew: "Personal",
  ai_assistant: "Asistente IA",
  analytics: "Analítica",
  branding: "Marca / White-label",
  approval: "Flujo de aprobación",
  billing: "Facturación",
  notifications: "Notificaciones",
};

export function AdminOrgDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const detailQ = useQuery({ queryKey: ["sa-org", id], queryFn: () => api.superAdmin.getOrgDetail(id) });

  const toggleMut = useMutation({
    mutationFn: (v: { module: string; enabled: boolean }) => api.superAdmin.toggleModule(id, v.module, v.enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sa-org", id] }),
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  if (detailQ.isLoading) {
    return <div className="p-10 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }
  if (detailQ.isError || !detailQ.data) {
    return <div className="p-10 text-muted-foreground">No se pudo cargar la empresa. <Link to="/admin" className="text-primary">Volver</Link></div>;
  }

  const { org, members, counts } = detailQ.data;
  const enabled: string[] = org.enabled_modules ?? [];

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Empresas</Link>

      <header className="flex items-center gap-3">
        {org.logo_url ? <img src={org.logo_url} alt="" className="h-12 w-12 rounded-lg object-contain bg-card" /> : <div className="h-12 w-12 rounded-lg" style={{ background: org.primary_color }} />}
        <div>
          <h1 className="font-display text-2xl font-semibold">{org.name}</h1>
          <div className="text-xs text-muted-foreground">/{org.slug} · código {org.join_code} · <Badge variant={org.status === "active" ? "secondary" : "destructive"} className="text-[0.6rem]">{org.status}</Badge></div>
        </div>
      </header>

      {/* Feature flags */}
      <section className="rounded-xl border border-border bg-card/70 p-5">
        <h2 className="font-medium mb-1">Funcionalidades (feature flags)</h2>
        <p className="text-xs text-muted-foreground mb-4">Activá o desactivá módulos para esta empresa. Si no usa algo, apagalo.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODULES.map((m) => {
            const isCore = m === "events_quotes";
            const on = enabled.includes(m);
            return (
              <div key={m} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <div>
                  <div className="text-sm">{MODULE_LABELS[m] ?? m}</div>
                  <div className="text-[0.65rem] text-muted-foreground font-mono">{m}</div>
                </div>
                <Switch
                  checked={on}
                  disabled={isCore || toggleMut.isPending}
                  onCheckedChange={(v) => toggleMut.mutate({ module: m, enabled: v })}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Data counts for diagnostics */}
      <section className="rounded-xl border border-border bg-card/70 p-5">
        <h2 className="font-medium mb-3">Datos (diagnóstico)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          {[["Eventos", counts.events], ["Inventario", counts.equipment], ["Personal", counts.personnel], ["Proveedores", counts.suppliers], ["Clientes", counts.clients]].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-border/60 py-3">
              <div className="text-xl font-semibold">{v ?? 0}</div>
              <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Members */}
      <section className="rounded-xl border border-border bg-card/70 overflow-hidden">
        <div className="p-4 border-b border-border/60"><h2 className="font-medium">Miembros ({members.length})</h2></div>
        <table className="w-full text-sm">
          <tbody>
            {members.map((u: any) => (
              <tr key={u.id} className="border-t border-border/60">
                <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{u.email}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1 justify-end">
                    {(u.roles ?? []).map((r: string) => <Badge key={r} variant="secondary" className="text-[0.6rem]">{r}</Badge>)}
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td className="p-4 text-center text-muted-foreground text-sm">Sin miembros.</td></tr>}
          </tbody>
        </table>
        <div className="p-3 border-t border-border/60 text-right">
          <Button asChild variant="outline" size="sm"><Link to="/admin/users">Gestionar usuarios</Link></Button>
        </div>
      </section>
    </div>
  );
}
