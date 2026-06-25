import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Users, Truck, Package, TrendingUp, DollarSign, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, label } from "@/lib/labels";

export function Dashboard() {
  const { format: fmt } = useCurrency();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.dashboard.stats() });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">General overview of your events and operations</p>
        </div>
        <Link to="/events/new">
          <Button className="glow-primary">
            <Sparkles className="h-4 w-4 mr-1" /> New AI Event
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Calendar} label="Events" value={data?.counts.events ?? 0} loading={isLoading} />
        <KpiCard icon={Users} label="Personnel" value={data?.counts.personnel ?? 0} loading={isLoading} />
        <KpiCard icon={Truck} label="Suppliers" value={data?.counts.suppliers ?? 0} loading={isLoading} />
        <KpiCard icon={Package} label="Equipment" value={data?.counts.equipment ?? 0} loading={isLoading} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FinCard icon={DollarSign} label="Total Budget" value={fmt(data?.financial.totalBudget ?? 0)} loading={isLoading} />
        <FinCard icon={TrendingUp} label="Projected Revenue" value={fmt(data?.financial.totalRevenue ?? 0)} loading={isLoading} />
        <FinCard
          icon={TrendingUp}
          label="Estimated Margin"
          value={fmt(data?.financial.margin ?? 0)}
          sub={`${(data?.financial.marginPct ?? 0).toFixed(1)}% profitability`}
          tone={(data?.financial.margin ?? 0) >= 0 ? "success" : "destructive"}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Upcoming Events</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.upcoming ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No scheduled events.</p>
            )}
            {data?.upcoming.map((e: any) => (
              <Link key={e.id} to={`/events/${e.id}`} className="block rounded-lg border border-border p-3 hover:border-primary/40 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(e.start_date!).toLocaleString("en-US")}</div>
                  </div>
                  <Badge variant="secondary">{label(EVENT_TYPE_LABELS, e.event_type)}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Events</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.recent ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet. <Link to="/events/new" className="text-primary underline">Create the first one</Link>.</p>
            )}
            {data?.recent.map((e: any) => (
              <Link key={e.id} to={`/events/${e.id}`} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50">
                <span className="truncate">{e.title}</span>
                <Badge variant="outline" className="text-xs">{label(EVENT_STATUS_LABELS, e.status)}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, loading }: { icon: any; label: string; value: number; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2 font-display text-3xl font-bold">{loading ? "…" : value}</div>
      </CardContent>
    </Card>
  );
}

function FinCard({ icon: Icon, label, value, sub, tone = "default", loading }: { icon: any; label: string; value: string; sub?: string; tone?: "default" | "success" | "destructive"; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className={`h-4 w-4 ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary"}`} />
        </div>
        <div className={`mt-2 font-display text-2xl font-bold ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""}`}>
          {loading ? "…" : value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
