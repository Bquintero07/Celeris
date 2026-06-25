import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Building2, Users, Shield, Trash2, Plus } from "lucide-react";
import { api } from "@/lib/api";

export function Admin() {
  const gate = useQuery({ queryKey: ["am-super"], queryFn: () => api.superAdmin.check() });

  if (gate.isLoading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</div>;
  }
  if (!gate.data) {
    return <BootstrapPanel onDone={() => gate.refetch()} />;
  }

  return <SuperAdminContent />;
}

function BootstrapPanel({ onDone }: { onDone: () => void }) {
  const mut = useMutation({
    mutationFn: () => api.superAdmin.bootstrap(),
    onSuccess: () => { toast.success("You are now a super admin"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Not authorized"),
  });
  return (
    <div className="p-8 max-w-xl space-y-4">
      <h1 className="font-display text-2xl font-semibold">Restricted access</h1>
      <p className="text-sm text-muted-foreground">
        This view is exclusive to the software operator team (super admin).
      </p>
      <div className="rounded-lg border border-dashed border-border p-4 bg-card/40">
        <p className="text-sm">
          If you are the one installing this platform and no super admin has been designated yet,
          you can claim that role now. This only works the first time.
        </p>
        <Button className="mt-3" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Claim super admin role
        </Button>
      </div>
    </div>
  );
}

function SuperAdminContent() {
  const qc = useQueryClient();

  const orgsQ = useQuery({ queryKey: ["sa-orgs"], queryFn: () => api.superAdmin.listOrgs() });
  const usersQ = useQuery({ queryKey: ["sa-users"], queryFn: () => api.superAdmin.listUsers() });

  const [newOrgName, setNewOrgName] = useState("");
  const createMut = useMutation({
    mutationFn: () => api.superAdmin.createOrg({ name: newOrgName.trim() }),
    onSuccess: () => {
      toast.success("Organization created");
      setNewOrgName("");
      qc.invalidateQueries({ queryKey: ["sa-orgs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const assignMut = useMutation({
    mutationFn: (v: { user_id: string; organization_id: string }) =>
      api.superAdmin.assignUser({ ...v, makeAdmin: true }),
    onSuccess: () => {
      toast.success("User assigned as tenant admin");
      qc.invalidateQueries({ queryKey: ["sa-users"] });
      qc.invalidateQueries({ queryKey: ["sa-orgs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const grantMut = useMutation({
    mutationFn: (v: { user_id: string; grant: boolean }) => api.superAdmin.grantSuper(v),
    onSuccess: (_d, v) => {
      toast.success(v.grant ? "Super admin granted" : "Super admin revoked");
      qc.invalidateQueries({ queryKey: ["sa-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const deleteMut = useMutation({
    mutationFn: (organization_id: string) => api.superAdmin.deleteOrg(organization_id),
    onSuccess: () => {
      toast.success("Organization deleted");
      qc.invalidateQueries({ queryKey: ["sa-orgs"] });
      qc.invalidateQueries({ queryKey: ["sa-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <header>
        <div className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">Super Admin</div>
        <h1 className="font-display text-3xl font-semibold mt-1">Multi-Tenant Management</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Exclusive panel for the software operator. Create organizations (tenants), assign owners and manage global permissions.
        </p>
      </header>

      <Tabs defaultValue="orgs">
        <TabsList>
          <TabsTrigger value="orgs"><Building2 className="h-4 w-4 mr-2" /> Organizations</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" /> Users</TabsTrigger>
        </TabsList>

        <TabsContent value="orgs" className="space-y-6 mt-6">
          <div className="rounded-xl border border-border bg-card/70 p-5">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="newOrg">Create new organization (tenant)</Label>
                <Input id="newOrg" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="e.g. Acme Productions Inc." maxLength={200} />
              </div>
              <Button onClick={() => createMut.mutate()} disabled={!newOrgName.trim() || createMut.isPending}>
                {createMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-3">Logo</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Members</th>
                  <th className="text-left p-3">Colors</th>
                  <th className="text-left p-3">Created</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {orgsQ.isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
                {(orgsQ.data ?? []).map((o: any) => (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="p-3">
                      {o.logo_url ? <img src={o.logo_url} alt={o.name} className="h-8 w-8 rounded object-contain bg-card" /> : <div className="h-8 w-8 rounded bg-muted" />}
                    </td>
                    <td className="p-3 font-medium">{o.name}</td>
                    <td className="p-3">{o.member_count}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <span className="h-5 w-5 rounded border border-border" style={{ background: o.primary_color }} />
                        <span className="h-5 w-5 rounded border border-border" style={{ background: o.accent_color }} />
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm(`Delete "${o.name}"? Users will be left without an organization.`)) deleteMut.mutate(o.id);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(orgsQ.data ?? []).length === 0 && !orgsQ.isLoading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No organizations yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Organization</th>
                  <th className="text-left p-3">Roles</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQ.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
                {(usersQ.data ?? []).map((u: any) => {
                  const isSuper = u.roles.includes("super_admin");
                  return (
                    <tr key={u.id} className="border-t border-border/60 align-top">
                      <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{u.email}</td>
                      <td className="p-3 min-w-[220px]">
                        <Select
                          value={u.organization_id ?? ""}
                          onValueChange={(v) => assignMut.mutate({ user_id: u.id, organization_id: v })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No organization" /></SelectTrigger>
                          <SelectContent>
                            {(orgsQ.data ?? []).map((o: any) => (
                              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r: string) => (
                            <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="text-[0.65rem]">{r}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant={isSuper ? "destructive" : "outline"}
                          onClick={() => grantMut.mutate({ user_id: u.id, grant: !isSuper })}
                        >
                          <Shield className="h-3.5 w-3.5 mr-1.5" />
                          {isSuper ? "Revoke super admin" : "Make super admin"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
