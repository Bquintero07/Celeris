import { Outlet, NavLink, Navigate, useNavigate } from "react-router-dom";
import { Loader2, Building2, Users, Bot, UserCog, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMyRoles } from "@/lib/use-my-roles";
import { CelerisLogo } from "@/components/celeris-logo";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/admin",         label: "Empresas", icon: Building2, end: true },
  { to: "/admin/users",   label: "Usuarios", icon: Users,     end: false },
  { to: "/admin/agent",   label: "Agente",   icon: Bot,       end: false },
  { to: "/admin/profile", label: "Perfil",   icon: UserCog,   end: false },
];

export function AdminLayout() {
  const { isLoading, isSuperAdmin } = useMyRoles();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verificando acceso…
      </div>
    );
  }
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex w-full bg-vignette">
      <aside className="w-60 shrink-0 border-r border-border/40 bg-card/30 flex flex-col">
        <div className="flex items-center gap-2 p-4">
          <CelerisLogo size={28} />
          <div className="leading-tight">
            <div className="font-display font-bold">Celeris</div>
            <div className="text-[0.6rem] tracking-[0.25em] uppercase text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Operador
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`
              }
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
