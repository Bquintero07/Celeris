import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, KeyRound, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => api.onboarding.status(),
    staleTime: 0,
  });
  const autoJoinedRef = useRef(false);

  useEffect(() => {
    if (!status.data) return;
    if (status.data.hasOrganization) {
      localStorage.removeItem("pending_invite_code");
      navigate("/dashboard", { replace: true });
      return;
    }
    if (status.data.isSuperAdmin) {
      navigate("/admin", { replace: true });
      return;
    }
    const pending = localStorage.getItem("pending_invite_code");
    if (pending && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      api.onboarding.joinOrg({ code: pending })
        .then((org) => {
          localStorage.removeItem("pending_invite_code");
          toast.success(`Joined ${org.name}.`);
          qc.invalidateQueries({ queryKey: ["onboarding-status"] });
          navigate("/dashboard", { replace: true });
        })
        .catch((e: any) => {
          localStorage.removeItem("pending_invite_code");
          toast.error(e?.message ?? "Invalid invite code");
        });
    }
  }, [status.data, navigate, qc]);

  if (status.isLoading || status.data?.hasOrganization || status.data?.isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparing…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-12 md:py-20 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <div className="text-[0.65rem] tracking-[0.35em] uppercase text-muted-foreground">Bienvenido</div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold mt-2">Configurá tu acceso</h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
          ¿Estás creando una organización nueva o tu equipo ya tiene una en Celeris? Elegí una opción para continuar.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CreateCard />
        <JoinCard />
      </div>
    </div>
  );
}

function CreateCard() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const mut = useMutation({
    mutationFn: () => api.onboarding.createOrg({ name: name.trim() }),
    onSuccess: (org) => {
      toast.success(`Organización "${org.name}" creada. Sos el admin.`);
      navigate("/brand-settings", { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al crear la organización"),
  });

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <CardTitle>Crear nueva organización</CardTitle>
        </div>
        <CardDescription>
          Vas a tener tu propio espacio aislado. Serás el admin y podrás personalizar la marca e invitar a tu equipo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="orgname">Nombre de la empresa u organización</Label>
          <Input id="orgname" value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="Ej. Aurora Productions Inc." maxLength={200} />
        </div>
        <Button className="w-full" onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Building2 className="h-4 w-4 mr-2" />
          Crear y personalizar marca
        </Button>
      </CardContent>
    </Card>
  );
}

function JoinCard() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const mut = useMutation({
    mutationFn: () => api.onboarding.joinOrg({ code: code.trim().toUpperCase() }),
    onSuccess: (org) => {
      toast.success(`Te uniste a ${org.name}. Pedile a tu admin que te asigne un rol.`);
      navigate("/dashboard", { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Código inválido"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-foreground">
          <KeyRound className="h-5 w-5" />
          <CardTitle>Unirse a una organización</CardTitle>
        </div>
        <CardDescription>
          Pedile el código de invitación al administrador de tu organización. Te unirás como invitado y el admin te asignará un rol.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Código de invitación</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                 placeholder="ABCD1234XY" maxLength={20} className="tracking-widest font-mono uppercase" />
        </div>
        <Button variant="outline" className="w-full" onClick={() => mut.mutate()}
                disabled={code.trim().length < 4 || mut.isPending}>
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Unirse
        </Button>
      </CardContent>
    </Card>
  );
}
