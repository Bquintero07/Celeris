import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Shield, UserPlus, KeyRound, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

export function AdminUsers() {
  const qc = useQueryClient();
  const orgsQ = useQuery({ queryKey: ["sa-orgs"], queryFn: () => api.superAdmin.listOrgs() });
  const usersQ = useQuery({ queryKey: ["sa-users"], queryFn: () => api.superAdmin.listUsers() });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["sa-users"] }); qc.invalidateQueries({ queryKey: ["sa-orgs"] }); };

  const assignMut = useMutation({
    mutationFn: (v: { user_id: string; organization_id: string }) => api.superAdmin.assignUser({ ...v, makeAdmin: true }),
    onSuccess: () => { toast.success("Usuario asignado como admin del tenant"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
  const grantMut = useMutation({
    mutationFn: (v: { user_id: string; grant: boolean }) => api.superAdmin.grantSuper(v),
    onSuccess: (_d, v) => { toast.success(v.grant ? "Super admin otorgado" : "Super admin revocado"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
  const deleteMut = useMutation({
    mutationFn: (userId: string) => api.superAdmin.deleteUser(userId),
    onSuccess: () => { toast.success("Usuario eliminado"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">Operador</div>
          <h1 className="font-display text-3xl font-semibold mt-1">Usuarios</h1>
        </div>
        <CreateUserDialog orgs={orgsQ.data ?? []} onDone={invalidate} />
      </header>

      <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-3">Usuario</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Empresa</th>
              <th className="text-left p-3">Roles</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usersQ.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>}
            {(usersQ.data ?? []).map((u: any) => {
              const isSuper = u.roles.includes("super_admin");
              return (
                <tr key={u.id} className="border-t border-border/60 align-top">
                  <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{u.email}</td>
                  <td className="p-3 min-w-[200px]">
                    <Select value={u.organization_id ?? ""} onValueChange={(v) => assignMut.mutate({ user_id: u.id, organization_id: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin empresa" /></SelectTrigger>
                      <SelectContent>
                        {(orgsQ.data ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r: string) => <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="text-[0.65rem]">{r}</Badge>)}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant={isSuper ? "destructive" : "outline"} onClick={() => grantMut.mutate({ user_id: u.id, grant: !isSuper })}>
                        <Shield className="h-3.5 w-3.5 mr-1.5" />{isSuper ? "Revocar super" : "Hacer super"}
                      </Button>
                      <ResetPasswordDialog userId={u.id} email={u.email} />
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Eliminar a ${u.email}? Esta acción no se puede deshacer.`)) deleteMut.mutate(u.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserDialog({ orgs, onDone }: { orgs: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgId, setOrgId] = useState<string>("");
  const [makeAdmin, setMakeAdmin] = useState(true);

  const mut = useMutation({
    mutationFn: () => api.superAdmin.createUser({
      email: email.trim(), password, full_name: fullName.trim() || undefined,
      organization_id: orgId || undefined, makeAdmin,
    }),
    onSuccess: () => {
      toast.success("Usuario creado");
      setOpen(false); setEmail(""); setPassword(""); setFullName(""); setOrgId("");
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al crear"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-2" /> Crear usuario</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear usuario</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Contraseña</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 6 caracteres" /></div>
          <div>
            <Label>Empresa (opcional)</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue placeholder="Sin empresa" /></SelectTrigger>
              <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {orgId && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={makeAdmin} onCheckedChange={(v) => setMakeAdmin(!!v)} /> Asignar como admin del tenant
            </label>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={!email.trim() || password.length < 6 || mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const mut = useMutation({
    mutationFn: () => api.superAdmin.resetPassword(userId, password),
    onSuccess: () => { toast.success("Contraseña actualizada"); setOpen(false); setPassword(""); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" title="Resetear contraseña"><KeyRound className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Resetear contraseña</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{email}</p>
        <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña (mín. 6)" />
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={password.length < 6 || mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
