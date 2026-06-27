import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Boxes } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { CATEGORY_LABELS, label } from "@/lib/labels";

const CATS = ["equipo", "mobiliario", "audio_video", "iluminacion", "transporte", "seguridad", "marketing", "extras"];

export function Inventory() {
  const qc = useQueryClient();
  const { format: fmt } = useCurrency();
  const { data } = useQuery({ queryKey: ["equipment"], queryFn: () => api.equipment.list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const save = async (form: any) => {
    try {
      await api.equipment.upsert({ ...form, subcategory: form.subcategory?.trim() || null, quantity: Number(form.quantity), unit_cost: Number(form.unit_cost) });
      qc.invalidateQueries({ queryKey: ["equipment"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); setEditing(null);
      toast.success("Guardado");
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este ítem?")) return;
    await api.equipment.delete(id);
    qc.invalidateQueries({ queryKey: ["equipment"] });
    toast.success("Eliminado");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Boxes className="h-7 w-7 text-primary" /> Inventario</h1>
          <p className="text-sm text-muted-foreground">Equipos, mobiliario y recursos físicos</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nuevo</Button></DialogTrigger>
          <EquipmentDialog key={editing?.id ?? "new"} editing={editing} onSave={save} />
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((item: any) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">{label(CATEGORY_LABELS, item.category)}</Badge>
                    {item.subcategory && <Badge variant="secondary" className="text-xs">{item.subcategory}</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(item); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disponibles</span>
                  <span className={item.available_qty === 0 ? "text-destructive font-medium" : "font-medium"}>
                    {item.available_qty ?? item.quantity} / {item.quantity}
                  </span>
                </div>
                {item.reserved_qty > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">En próximos eventos</span>
                    <span className="text-amber-500">{item.reserved_qty}</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Costo unitario</span><span>{fmt(Number(item.unit_cost), { decimals: 2 })}</span></div>
                {item.location && <div className="flex justify-between"><span className="text-muted-foreground">Ubicación</span><span>{item.location}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">No hay equipos registrados.</p>}
    </div>
  );
}

function EquipmentDialog({ editing, onSave }: { editing: any; onSave: (f: any) => void }) {
  const [f, setF] = useState(editing ?? { name: "", category: "equipo", subcategory: "", quantity: 1, unit_cost: 0, location: "", notes: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Nuevo"} equipo</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nombre</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div>
          <Label>Categoría</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{label(CATEGORY_LABELS, c)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Subcategoría</Label><Input value={f.subcategory ?? ""} onChange={(e) => setF({ ...f, subcategory: e.target.value })} placeholder="Ej. PA, robótica, truss…" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Cantidad</Label><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
          <div><Label>Costo unitario</Label><Input type="number" step="0.01" value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} /></div>
        </div>
        <div><Label>Ubicación</Label><Input value={f.location ?? ""} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        <div><Label>Notas</Label><Input value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSave(f)}>Guardar</Button></DialogFooter>
    </DialogContent>
  );
}
