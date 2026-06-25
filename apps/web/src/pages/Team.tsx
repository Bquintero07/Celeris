import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Shield, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";

const ROLES = ["admin", "comercial", "contable", "personal", "logistica", "viewer"] as const;

export function Team() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["team"], queryFn: () => api.team.list() });
  const { data: orgCode } = useQuery({ queryKey: ["my-join-code"], queryFn: () => api.team.joinCode() });

  const toggle = async (user_id: string, role: string, has: boolean) => {
    try {
      await api.team.setRole({ user_id, role, action: has ? "remove" : "add" });
      qc.invalidateQueries({ queryKey: ["team"] });
      toast.success("Role updated");
    } catch (e: any) { toast.error(e.message || "Only admins can change roles"); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Package className="h-7 w-7 text-primary" /> Team</h1>
        <p className="text-sm text-muted-foreground">Users in your organization and their roles (admin only).</p>
      </div>

      {orgCode?.join_code && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div>
              <div className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">Invite your team to <strong>{orgCode.name}</strong></div>
              <p className="text-xs text-muted-foreground mt-1">Share this link: anyone who signs up or signs in from it will join your organization directly.</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/auth?invite=${orgCode.join_code}`}
                className="font-mono text-xs"
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select()}
              />
              <Button size="sm" variant="outline" onClick={() => {
                const url = `${window.location.origin}/auth?invite=${orgCode.join_code}`;
                navigator.clipboard.writeText(url);
                toast.success("Link copied");
              }}>
                <Copy className="h-4 w-4 mr-2" /> Copy link
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>Or share the code:</span>
              <span className="font-mono tracking-widest text-foreground">{orgCode.join_code}</span>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => {
                navigator.clipboard.writeText(orgCode.join_code);
                toast.success("Code copied");
              }}>
                <Copy className="h-3 w-3 mr-1" /> Copy code
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((u: any) => (
          <Card key={u.id}>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold">{u.full_name || u.email}</h3>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Shield className="h-3 w-3" /> Roles</div>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map((r) => {
                    const has = u.roles.includes(r);
                    return (
                      <Button key={r} size="sm" variant={has ? "default" : "outline"} className="h-7 text-xs" onClick={() => toggle(u.id, r, has)}>
                        {r}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">No users.</p>}
    </div>
  );
}
