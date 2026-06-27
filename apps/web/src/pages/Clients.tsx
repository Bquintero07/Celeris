import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, UserRound } from "lucide-react";
import { useMyRoles } from "@/lib/use-my-roles";

type Client = {
  id: string; name: string; contact_name: string | null; email: string | null;
  phone: string | null; address: string | null; tax_id: string | null; notes: string | null;
};

const EMPTY: Omit<Client, "id"> = {
  name: "", contact_name: null, email: null, phone: null,
  address: null, tax_id: null, notes: null,
};

export function Clients() {
  const qc = useQueryClient();
  const { can } = useMyRoles();
  const canEdit = can("clients.manage");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.clients.list(),
  });

  const [open, setOpen]   = useState(false);
  const [form, setForm]   = useState<Partial<Client>>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) return api.clients.update(editing, form);
      return api.clients.create(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editing ? "Cliente actualizado" : "Cliente creado");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.clients.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => { setForm(EMPTY); setEditing(null); setOpen(true); };
  const openEdit   = (c: Client) => { setForm(c); setEditing(c.id); setOpen(true); };
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v || null }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserRound className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-display font-bold">Clientes</h1>
        </div>
        {canEdit && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Agregar cliente
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Directorio de clientes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4">Cargando…</p>
          ) : clients.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Aún no hay clientes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>NIT</TableHead>
                  {canEdit && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c: Client) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.contact_name ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>{c.tax_id ?? "—"}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => { if (confirm("¿Eliminar cliente?")) deleteMut.mutate(c.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre de la empresa *</Label>
              <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Acme Events" />
            </div>
            <div className="space-y-1">
              <Label>Persona de contacto</Label>
              <Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>NIT / ID fiscal</Label>
              <Input value={form.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Dirección</Label>
              <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notas</Label>
              <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.name || saveMut.isPending}>
              {saveMut.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
