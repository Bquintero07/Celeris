import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Download } from "lucide-react";
import { useCurrency } from "@/lib/currency";

function downloadBase64(base64: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  link.click();
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  sent:     "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function Billing() {
  const { currency } = useCurrency();
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: () => api.billing.list(),
  });

  const invoiceMut = useMutation({
    mutationFn: (eventId: string) => api.billing.generateInvoice(eventId, currency),
    onSuccess: ({ base64, filename }) => {
      downloadBase64(base64, filename);
      toast.success("Invoice downloaded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-display font-bold">Billing</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approved &amp; sent quotes</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            These invoices do not integrate with DIAN. For fiscal invoicing, export the PDF and submit manually.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No approved quotes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Revenue ({currency})</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.title}</TableCell>
                    <TableCell>{inv.client_name ?? "—"}</TableCell>
                    <TableCell>
                      {inv.start_date
                        ? new Date(inv.start_date).toLocaleDateString("en-US")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {Number(inv.revenue ?? 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[inv.approval_status] ?? ""} variant="outline">
                        {inv.approval_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="outline"
                        disabled={invoiceMut.isPending}
                        onClick={() => invoiceMut.mutate(inv.id)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
