import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMyRoles } from "@/lib/use-my-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { CelerisLogo } from "@/components/celeris-logo";
import { api } from "@/lib/api";

export function BrandSettings() {
  const { isAdmin, isLoading: rolesLoading } = useMyRoles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-organization"], queryFn: () => api.org.get() });

  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("#7C5CFF");
  const [accent, setAccent] = useState("#22D3EE");
  const [logo, setLogo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.name ?? "");
    setPrimary(q.data.primary_color ?? "#7C5CFF");
    setAccent(q.data.accent_color ?? "#22D3EE");
    setLogo(q.data.logo_url ?? null);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      api.org.update({ name, primary_color: primary, accent_color: accent, logo_url: logo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-organization"] });
      toast.success("Brand updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 240_000) {
      toast.error("Logo too large. Max 240KB. Please compress the image.");
      return;
    }
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type)) {
      toast.error("Unsupported format (PNG, JPG, SVG or WebP).");
      return;
    }
    const r = new FileReader();
    r.onload = () => setLogo(r.result as string);
    r.readAsDataURL(f);
  };

  if (rolesLoading || q.isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="font-display text-2xl font-semibold">Restricted access</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Only organization administrators can edit the brand.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <header>
        <div className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground">Settings</div>
        <h1 className="font-display text-3xl font-semibold mt-1">Organization Brand</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Customize the logo and colors. Applied across the entire app and in exported PDFs/Excel files.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="rounded-xl border border-border bg-card/70 p-6 space-y-5">
          <div>
            <Label htmlFor="org-name">Company name</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>

          <div>
            <Label>Logo (PNG, JPG, SVG or WebP · max 240KB)</Label>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onFile} className="hidden" />
            <div className="mt-2 flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Upload logo
              </Button>
              {logo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary">Primary color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input id="primary" type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-12 rounded cursor-pointer bg-transparent border border-border" />
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div>
              <Label htmlFor="accent">Accent color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input id="accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 rounded cursor-pointer bg-transparent border border-border" />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save brand
          </Button>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-card/70 p-6">
          <div className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground mb-4">Preview</div>

          <div
            className="rounded-lg p-6 text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
          >
            <div className="flex items-center gap-3">
              {logo ? (
                <img src={logo} alt="Logo" className="h-10 w-10 rounded-md object-contain bg-white/10 p-1" />
              ) : (
                <CelerisLogo size={40} />
              )}
              <div>
                <div className="text-[0.6rem] tracking-[0.3em] uppercase opacity-80">Report header</div>
                <div className="font-semibold text-lg">{name || "My Company"}</div>
              </div>
            </div>
            <div className="mt-6 text-xs opacity-90">These colors will appear in the app and in PDF/Excel exports.</div>
          </div>

          <div className="mt-4 flex gap-2">
            <div className="flex-1 rounded p-2 text-xs text-white text-center" style={{ background: primary }}>Primary</div>
            <div className="flex-1 rounded p-2 text-xs text-white text-center" style={{ background: accent }}>Accent</div>
          </div>
        </div>
      </div>
    </div>
  );
}
