import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar, MapPin } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, label } from "@/lib/labels";

export function EventsList() {
  const { format: fmt } = useCurrency();
  const { data, isLoading } = useQuery({ queryKey: ["events"], queryFn: () => api.events.list() });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Eventos</h1>
          <p className="text-sm text-muted-foreground">Todos los eventos de la organización</p>
        </div>
        <Link to="/events/new">
          <Button className="glow-primary"><Sparkles className="h-4 w-4 mr-1" /> Nuevo con IA</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="font-display text-xl font-semibold">Aún no hay eventos</h2>
            <p className="text-sm text-muted-foreground mt-1">Creá tu primer evento con ayuda de la IA.</p>
            <Link to="/events/new" className="inline-block mt-4">
              <Button>Crear evento</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((e: any) => (
          <Link key={e.id} to={`/events/${e.id}`}>
            <Card className="hover:border-primary/50 transition cursor-pointer h-full">
              <CardContent className="p-5 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-display font-semibold line-clamp-2">{e.title}</h3>
                  <Badge variant="outline" className="shrink-0">{label(EVENT_STATUS_LABELS, e.status)}</Badge>
                </div>
                <Badge variant="secondary" className="text-xs">{label(EVENT_TYPE_LABELS, e.event_type)}</Badge>
                {e.location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {e.location}
                  </div>
                )}
                {e.start_date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {new Date(e.start_date).toLocaleDateString("es-CO")}
                  </div>
                )}
                <div className="pt-2 text-xs text-muted-foreground">
                  Presupuesto: <span className="text-foreground font-semibold">{fmt(Number(e.budget || 0))}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
