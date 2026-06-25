import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Users, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";

export function Personnel() {
  const qc = useQueryClient();
  const { format: fmt, symbol } = useCurrency();
  const { data } = useQuery({ queryKey: ["personnel"], queryFn: () => api.personnel.list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const save = async (form: any) => {
    try {
      await api.personnel.upsert({
        ...form,
        hourly_rate: Number(form.hourly_rate),
        skills: form.skills
          ? form.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
      });
      qc.invalidateQueries({ queryKey: ["personnel"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); setEditing(null);
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this person?")) return;
    await api.personnel.delete(id);
    qc.invalidateQueries({ queryKey: ["personnel"] });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Personnel</h1>
          <p className="text-sm text-muted-foreground">Roles, rates and availability of the operations team</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
          <PersonDialog editing={editing} onSave={save} />
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((p: any) => (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{p.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{p.role}</p>
                </div>
                <div className="flex gap-1">
                  <Badge variant={p.available ? "default" : "outline"} className="text-xs">
                    {p.available ? "Available" : "Busy"}
                  </Badge>
                </div>
              </div>
              <div className="text-sm flex justify-between">
                <span className="text-muted-foreground">{symbol}/hour</span>
                <span className="font-semibold">{fmt(Number(p.hourly_rate), { decimals: 2 })}</span>
              </div>
              {p.email && <div className="text-xs flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{p.email}</div>}
              {p.phone && <div className="text-xs flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{p.phone}</div>}
              {p.skills && p.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {p.skills.map((s: string) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                </div>
              )}
              <div className="flex gap-1 pt-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditing({ ...p, skills: (p.skills ?? []).join(", ") }); setOpen(true); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">No personnel registered.</p>}
    </div>
  );
}

function PersonDialog({ editing, onSave }: { editing: any; onSave: (f: any) => void }) {
  const [f, setF] = useState(editing ?? { full_name: "", role: "", hourly_rate: 0, email: "", phone: "", skills: "", available: true, notes: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} member</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Role</Label><Input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Sound technician" /></div>
          <div><Label>Hourly rate</Label><Input type="number" step="0.01" value={f.hourly_rate} onChange={(e) => setF({ ...f, hourly_rate: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <div><Label>Skills (comma-separated)</Label><Input value={f.skills ?? ""} onChange={(e) => setF({ ...f, skills: e.target.value })} placeholder="Pro Tools, Yamaha, Ableton" /></div>
        <div className="flex items-center gap-2"><Switch checked={f.available} onCheckedChange={(v) => setF({ ...f, available: v })} /><Label>Available</Label></div>
      </div>
      <DialogFooter><Button onClick={() => onSave(f)}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
