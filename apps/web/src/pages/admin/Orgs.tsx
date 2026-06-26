import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Building2, Plus, Trash2, Power, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

export function AdminOrgs() {
  const qc = useQueryClient();
  const orgsQ = useQuery({ queryKey: ["sa-orgs"], queryFn: () => api.superAdmin.listOrgs() });
  const usersQ = useQuery({ queryKey: ["sa-users"], queryFn: () => api.superAdmin.listUsers() });
  const [newOrgName, setNewOrgName] = useState("");

  const createMut = useMutation({
    mutationFn: () => api.superAdmin.createOrg({ name: newOrgName.trim() }),
    onSuccess: () => { toast.success("Empresa creada"); setNewOrgName(""); qc.invalidateQueries({ queryKey: ["sa-orgs"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) => api.superAdmin.setStatus(v.id, v.status),
    onSuccess: () => { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["sa-orgs"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.superAdmin.deleteOrg(id),
    onSuccess: () => { toast.success("Empresa eliminada"); qc.invalidateQueries({ queryKey: ["sa-orgs"] }); qc.invalidateQueries({ queryKey: ["sa-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const orgs = orgsQ.data ?? [];
  const active = orgs.filter((o: any) => (o.status ?? "active") === "active").length;
  const stat = (label: string, value: number | string) => (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <header>
        <div className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">Operador</div>
        <h1 className="font-display text-3xl font-semibold mt-1">Empresas</h1>
        <p className="text-sm text-muted-foreground mt-2">Gestioná los tenants de la plataforma: crear, suspender, eliminar y configurar.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {stat("Empresas", orgs.length)}
        {stat("Activas", active)}
        {stat("Usuarios", usersQ.data?.length ?? "—")}
      </div>

      <div className="rounded-xl border border-border bg-card/70 p-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="newOrg">Crear nueva empresa</Label>
            <Input id="newOrg" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Ej. Acme Productions Inc." maxLength={200} />
          </div>
          <Button onClick={() => createMut.mutate()} disabled={!newOrgName.trim() || createMut.isPending}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Crear
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Empresa</th>
              <th className="text-left p-3">Miembros</th>
              <th className="text-left p-3">Módulos</th>
              <th className="text-left p-3">Estado</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orgsQ.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>}
            {orgs.map((o: any) => {
              const suspended = (o.status ?? "active") !== "active";
              return (
                <tr key={o.id} className="border-t border-border/60">
                  <td className="p-3">
                    <Link to={`/admin/orgs/${o.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                      {o.logo_url ? <img src={o.logo_url} alt="" className="h-7 w-7 rounded object-contain bg-card" /> : <div className="h-7 w-7 rounded bg-muted flex items-center justify-center"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /></div>}
                      {o.name}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </td>
                  <td className="p-3">{o.member_count}</td>
                  <td className="p-3 text-xs text-muted-foreground">{(o.enabled_modules ?? []).length} activos</td>
                  <td className="p-3">
                    <Badge variant={suspended ? "destructive" : "secondary"} className="text-[0.65rem]">{suspended ? "Suspendida" : "Activa"}</Badge>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" title={suspended ? "Activar" : "Suspender"}
                      onClick={() => statusMut.mutate({ id: o.id, status: suspended ? "active" : "suspended" })}>
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Eliminar "${o.name}"? Los usuarios quedan sin empresa.`)) deleteMut.mutate(o.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {orgs.length === 0 && !orgsQ.isLoading && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aún no hay empresas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
