import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Calendar, Package, Truck, Users, LogOut, Boxes, Settings, ShieldCheck, UserRound, BarChart3, Receipt, MessageSquare, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CurrencyProvider, CurrencySwitcher } from "@/lib/currency";
import { useMyRoles, canSeeNav } from "@/lib/use-my-roles";
import { useTenantConfig } from "@/lib/useTenantConfig";
import { CelerisLogo } from "@/components/celeris-logo";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const navItems = [
  { title: "Dashboard",   url: "/dashboard",      icon: LayoutDashboard },
  { title: "Events",      url: "/events",          icon: Calendar },
  { title: "Clients",     url: "/clients",         icon: UserRound },
  { title: "Inventory",   url: "/inventory",       icon: Boxes },
  { title: "Personnel",   url: "/personnel",       icon: Users },
  { title: "Suppliers",   url: "/suppliers",       icon: Truck },
  { title: "Analytics",   url: "/analytics",       icon: BarChart3 },
  { title: "Billing",     url: "/billing",         icon: Receipt },
  { title: "Team",        url: "/team",            icon: Package },
  { title: "Brand",       url: "/brand-settings",  icon: Settings },
  { title: "AI Chat",     url: "/chat",            icon: MessageSquare },
  { title: "Knowledge",   url: "/documents",       icon: BookOpen },
  { title: "Super Admin", url: "/admin",           icon: ShieldCheck },
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
    toast.success("Signed out");
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
            <span className="font-display text-lg font-bold truncate">
              {orgName ?? "Celeris"}
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
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
          {!collapsed && <span className="ml-2">Sign out</span>}
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
    const onOnboarding = pathname === "/onboarding";
    if (!data.hasOrganization && !data.isSuperAdmin && !onOnboarding) {
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
                  Celeris · Operations
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[0.65rem] tracking-[0.3em] uppercase text-muted-foreground hidden md:inline">Currency</span>
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
