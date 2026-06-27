import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft } from "lucide-react";
import { CelerisLogo } from "@/components/celeris-logo";
import { toast } from "sonner";

export function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) {
      const clean = code.trim().toUpperCase();
      localStorage.setItem("pending_invite_code", clean);
      setInviteCode(clean);
    } else {
      const stored = localStorage.getItem("pending_invite_code");
      if (stored) setInviteCode(stored);
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate("/onboarding", { replace: true });
    });
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Bienvenido de nuevo!");
    navigate("/onboarding", { replace: true });
  };

  // Realistic email: local@domain.tld with a 2+ letter TLD (does not force .co/.com).
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim());
  // Password: at least 8 chars with at least one letter and one number.
  const isValidPassword = (v: string) => v.length >= 8 && /[a-zA-Z]/.test(v) && /\d/.test(v);

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = name.trim();
    if (fullName.length < 2 || fullName.length > 80) return toast.error("Ingresá un nombre válido (2 a 80 caracteres)");
    if (!isValidEmail(email)) return toast.error("Ingresá un correo válido (ej. nombre@empresa.com)");
    if (!isValidPassword(password)) return toast.error("La contraseña debe tener al menos 8 caracteres, con letras y números");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin + "/onboarding",
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    // If Supabase requires email confirmation there is no session yet.
    if (!data.session) {
      toast.success("Cuenta creada. Revisá tu correo para confirmarla antes de iniciar sesión.");
      return;
    }
    toast.success("Cuenta creada. Iniciando sesión…");
    navigate("/onboarding", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background bg-aurora flex items-center justify-center px-4 py-12 relative">
      <Link
        to="/"
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
      </Link>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex">
            <CelerisLogo size={56} />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Celeris</h1>
          <p className="text-sm text-muted-foreground">Plataforma white-label para logística de eventos</p>
        </div>

        {inviteCode && (
          <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-center">
            Te invitaron con el código <span className="font-mono font-semibold tracking-widest">{inviteCode}</span>.
            <div className="text-xs text-muted-foreground mt-1">Al iniciar sesión, te agregaremos automáticamente a esa organización.</div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur">
          <Tabs defaultValue={inviteCode ? "signup" : "signin"}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="e1">Email</Label>
                  <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p1">Contraseña</Label>
                  <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar sesión"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="n">Nombre completo</Label>
                  <Input id="n" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e2">Email</Label>
                  <Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p2">Contraseña</Label>
                  <Input id="p2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Después de crear tu cuenta podés crear una organización o unirte a una con un código de invitación.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
