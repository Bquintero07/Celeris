import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

export function AdminProfile() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const usersQ = useQuery({ queryKey: ["sa-users"], queryFn: () => api.superAdmin.listUsers() });
  const supers = (usersQ.data ?? []).filter((u: any) => u.roles.includes("super_admin"));

  const changePassword = async () => {
    if (password.length < 6) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(error.message);
    setPassword("");
    toast.success("Contraseña actualizada");
  };

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-8">
      <header>
        <div className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">Operador</div>
        <h1 className="font-display text-3xl font-semibold mt-1 flex items-center gap-2"><UserCog className="h-7 w-7" /> Mi perfil</h1>
      </header>

      <section className="rounded-xl border border-border bg-card/70 p-5 space-y-4">
        <div><Label>Email</Label><Input value={email} disabled /></div>
        <div>
          <Label>Cambiar mi contraseña</Label>
          <div className="flex gap-2">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña (mín. 6)" />
            <Button onClick={changePassword} disabled={password.length < 6 || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-5">
        <h2 className="font-medium mb-3">Super admins ({supers.length})</h2>
        <div className="space-y-2">
          {supers.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <span>{u.full_name ?? u.email} <span className="text-muted-foreground text-xs">· {u.email}</span></span>
              <Badge className="text-[0.6rem]">super_admin</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
