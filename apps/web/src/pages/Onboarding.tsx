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
        <div className="text-[0.65rem] tracking-[0.35em] uppercase text-muted-foreground">Welcome</div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold mt-2">Set up your access</h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
          Are you creating a new organization or does your team already have one in Celeris? Choose an option to continue.
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
      toast.success(`Organization "${org.name}" created. You are the admin.`);
      navigate("/brand-settings", { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error creating organization"),
  });

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <CardTitle>Create new organization</CardTitle>
        </div>
        <CardDescription>
          You'll have your own isolated workspace. You'll be the admin and can customize the brand and invite your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="orgname">Company or organization name</Label>
          <Input id="orgname" value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="e.g. Aurora Productions Inc." maxLength={200} />
        </div>
        <Button className="w-full" onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Building2 className="h-4 w-4 mr-2" />
          Create and customize brand
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
      toast.success(`Joined ${org.name}. Ask your admin to assign you a role.`);
      navigate("/dashboard", { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Invalid code"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-foreground">
          <KeyRound className="h-5 w-5" />
          <CardTitle>Join an organization</CardTitle>
        </div>
        <CardDescription>
          Ask your organization administrator for the invite code. You'll join as a guest and the admin will assign you a role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Invite code</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                 placeholder="ABCD1234XY" maxLength={20} className="tracking-widest font-mono uppercase" />
        </div>
        <Button variant="outline" className="w-full" onClick={() => mut.mutate()}
                disabled={code.trim().length < 4 || mut.isPending}>
          {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Join
        </Button>
      </CardContent>
    </Card>
  );
}
