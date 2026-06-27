import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Calendar, Package, Truck, Users, LogOut, Boxes, Settings, UserRound, BarChart3, Receipt, MessageSquare, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CurrencyProvider, CurrencySwitcher } from "@/lib/currency";
import { useMyRoles, canSeeNav } from "@/lib/use-my-roles";
import { useTenantConfig } from "@/lib/useTenantConfig";
import { CelerisLogo } from "@/components/celeris-logo";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const navItems = [
  { title: "Inicio",      url: "/dashboard",      icon: LayoutDashboard },
  { title: "Eventos",     url: "/events",          icon: Calendar },
  { title: "Clientes",    url: "/clients",         icon: UserRound },
  { title: "Equipo",  url: "/inventory",       icon: Boxes },
  { title: "Personal",    url: "/personnel",       icon: Users },
  { title: "Proveedores", url: "/suppliers",       icon: Truck },
  { title: "Analítica",   url: "/analytics",       icon: BarChart3 },
  { title: "Facturación", url: "/billing",         icon: Receipt },
  { title: "Gestion Personal",      url: "/team",            icon: Package },
  { title: "Marca",       url: "/brand-settings",  icon: Settings },
  { title: "Chat IA",     url: "/chat",            icon: MessageSquare },
  { title: "Conocimiento", url: "/documents",      icon: BookOpen },
];

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { roles } = useMyRoles();
  const { data: tenantConfig } = useTenantConfig();

  const enabledModules = tenantConfig?.enabledModules as string[] | undefined;
  const branding = tenantConfig?.branding;
  const orgName = branding?.name ?? null;

  const visibleNav = navItems.filter((n) =>
    canSeeNav(n.url, roles as any, enabledModules),
  );

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate("/auth", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={orgName ?? "Logo"}
              className="h-8 w-8 rounded-lg object-contain bg-card/60"
            />
          ) : (
            <CelerisLogo size={32} />
          )}
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <span className="font-display text-lg font-bold block break-words">
                {orgName ?? "Celeris"}
              </span>
              {/* Co-branding: when inside a tenant workspace, keep Celeris visible. */}
              {orgName && (
                <span className="text-[0.6rem] tracking-[0.15em] uppercase text-muted-foreground">
                  por Celeris
                </span>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => api.onboarding.status(),
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    // Super admins live in the operator console, never the tenant shell.
    if (data.isSuperAdmin) {
      navigate("/admin", { replace: true });
      return;
    }
    const onOnboarding = pathname === "/onboarding";
    if (!data.hasOrganization && !onOnboarding) {
      navigate("/onboarding", { replace: true });
    }
  }, [data, pathname, navigate]);

  return <>{children}</>;
}

export function AppLayout() {
  return (
    <CurrencyProvider>
      <SidebarProvider>
        <OnboardingGate>
          <div className="min-h-screen flex w-full bg-vignette">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <header className="h-14 flex items-center border-b border-border/40 px-4 sticky top-0 bg-background/60 backdrop-blur-md z-10 gap-3">
                <SidebarTrigger />
                <div className="ml-2 text-[0.65rem] tracking-[0.35em] uppercase text-muted-foreground hidden sm:block">
                  Celeris · Operaciones
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground hidden md:inline">Moneda</span>
                  <CurrencySwitcher />
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Outlet />
              </main>
            </div>
          </div>
        </OnboardingGate>
      </SidebarProvider>
    </CurrencyProvider>
  );
}
