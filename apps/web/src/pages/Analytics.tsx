import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { useTenantConfig } from "@/lib/useTenantConfig";

const PIE_COLORS = ["#7C5CFF", "#A57CFF", "#C8B4FF", "#E8DEFF", "#5C3FBF", "#3D2A80"];

function fmt(n: number, currency: string) {
  return `${currency} ${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

function periodStart(period: string) {
  const now = new Date();
  if (period === "30d")  { const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString(); }
  if (period === "90d")  { const d = new Date(now); d.setDate(d.getDate() - 90); return d.toISOString(); }
  if (period === "6m")   { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString(); }
  const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString();
}

export function Analytics() {
  const { currency } = useCurrency();
  const { data: tenantConfig } = useTenantConfig();
  const primary = tenantConfig?.branding?.primary ?? "#7C5CFF";

  const [period, setPeriod] = useState("90d");
  const [groupBy, setGroupBy] = useState<"event" | "client">("event");

  const since = periodStart(period);

  const { data: margins = [], isLoading: mLoading } = useQuery({
    queryKey: ["analytics-margins", period, groupBy],
    queryFn: () => api.analytics.margins({ since, groupBy }),
  });

  const { data: revenue = [], isLoading: rLoading } = useQuery({
    queryKey: ["analytics-revenue", period],
    queryFn: () => api.analytics.revenue({ since }),
  });

  // Build category breakdown from margins (event view only)
  const totalRevenue = margins.reduce((s: number, r: any) => s + Number(r.total_revenue ?? r.revenue ?? 0), 0);
  const totalCost    = margins.reduce((s: number, r: any) => s + Number(r.total_cost ?? 0), 0);
  const totalMargin  = totalRevenue - totalCost;
  const marginPct    = totalRevenue > 0 ? (totalMargin / totalRevenue * 100).toFixed(1) : "0";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-display font-bold">Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "event" | "client")}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="event">By event</SelectItem>
              <SelectItem value="client">By client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Revenue", value: fmt(totalRevenue, currency) },
          { label: "Total Cost",    value: fmt(totalCost,    currency) },
          { label: "Gross Margin",  value: `${fmt(totalMargin, currency)} (${marginPct}%)` },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold font-display">{kpi.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Margins bar chart */}
      <Card>
        <CardHeader><CardTitle>Margin by {groupBy}</CardTitle></CardHeader>
        <CardContent>
          {mLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading…</p>
          ) : margins.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={margins} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
                <XAxis
                  dataKey={groupBy === "client" ? "client_name" : "title"}
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(Number(v), currency)} />
                <Legend />
                <Bar dataKey={groupBy === "client" ? "total_revenue" : "revenue"} name="Revenue" fill={primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey={groupBy === "client" ? "total_cost" : "total_cost"} name="Cost" fill="#E8DEFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Revenue over time */}
      <Card>
        <CardHeader><CardTitle>Revenue over time</CardTitle></CardHeader>
        <CardContent>
          {rLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading…</p>
          ) : revenue.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenue} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(Number(v), currency)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke={primary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cost"    name="Cost"    stroke="#A57CFF" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="margin"  name="Margin"  stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top 6 events by revenue — pie */}
      {groupBy === "event" && margins.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Top events by revenue</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={[...margins]
                    .sort((a: any, b: any) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0))
                    .slice(0, 6)
                    .map((r: any) => ({ name: r.title, value: Number(r.revenue ?? 0) }))}
                  cx="50%" cy="50%" outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {[...Array(6)].map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v), currency)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
