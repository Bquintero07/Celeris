import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Truck, Phone, Mail, Globe } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export function Suppliers() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.suppliers.list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "interno" | "externo">("todos");

  const filtered = (data ?? []).filter((s: any) =>
    (filter === "todos" || s.type === filter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase())),
  );

  const save = async (form: any) => {
    try {
      await api.suppliers.upsert(form);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); setEditing(null);
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    await api.suppliers.delete(id);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Truck className="h-7 w-7 text-primary" /> Suppliers</h1>
          <p className="text-sm text-muted-foreground">Internal and external. Search and direct contact.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
          <SupplierDialog editing={editing} onSave={save} />
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">All</SelectItem>
            <SelectItem value="interno">Internal</SelectItem>
            <SelectItem value="externo">External</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s: any) => (
          <Card key={s.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="text-sm text-muted-foreground">{s.category}</p>
                </div>
                <Badge variant={s.type === "interno" ? "default" : "outline"} className="text-xs">{s.type}</Badge>
              </div>
              {s.contact_name && <p className="text-sm">{s.contact_name}</p>}
              {s.email && <a href={`mailto:${s.email}`} className="text-xs flex items-center gap-1 text-primary hover:underline"><Mail className="h-3 w-3" />{s.email}</a>}
              {s.phone && <a href={`tel:${s.phone}`} className="text-xs flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{s.phone}</a>}
              {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-primary hover:underline"><Globe className="h-3 w-3" />Website</a>}
              <div className="flex gap-1 pt-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">No suppliers found.</p>}
    </div>
  );
}

function SupplierDialog({ editing, onSave }: { editing: any; onSave: (f: any) => void }) {
  const [f, setF] = useState(editing ?? { name: "", category: "", type: "externo", contact_name: "", email: "", phone: "", website: "", notes: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} supplier</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Catering, audio…" /></div>
          <div>
            <Label>Type</Label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="interno">Internal</SelectItem>
                <SelectItem value="externo">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Contact person</Label><Input value={f.contact_name ?? ""} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <div><Label>Website</Label><Input value={f.website ?? ""} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
        <div><Label>Notes</Label><Input value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSave(f)}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
