import { ExternalLink, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InvoiceRow } from "@/lib/stripe/invoices";

function formatCurrency(cents: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function statusVariant(status: string | null) {
  switch (status) {
    case "paid":
      return "default" as const;
    case "open":
      return "secondary" as const;
    case "draft":
      return "outline" as const;
    case "void":
    case "uncollectible":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function InvoiceTable({
  invoices,
  showMemberColumn = false,
}: {
  invoices: InvoiceRow[];
  showMemberColumn?: boolean;
}) {
  const hasTax = invoices.some((inv) => inv.taxAmount > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Invoice
            </th>
            {showMemberColumn && (
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Member
              </th>
            )}
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Date
            </th>
            {hasTax && (
              <>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Subtotal
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Tax
                </th>
              </>
            )}
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              {hasTax ? "Total" : "Amount"}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              PDF
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-border/50">
              <td className="px-4 py-3 font-mono text-xs">
                {inv.number ?? inv.id.slice(0, 20)}
              </td>
              {showMemberColumn && (
                <td className="px-4 py-3 text-xs">
                  {inv.customerName ?? inv.customerEmail ?? "—"}
                </td>
              )}
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {new Date(inv.date * 1000).toLocaleDateString()}
              </td>
              {hasTax && (
                <>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatCurrency(inv.subtotal, inv.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                    {inv.taxAmount > 0 ? formatCurrency(inv.taxAmount, inv.currency) : "—"}
                  </td>
                </>
              )}
              <td className="px-4 py-3 text-right font-mono text-xs">
                {formatCurrency(inv.amountDue, inv.currency)}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant(inv.status)}>
                  {inv.status ?? "unknown"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex gap-2">
                  {inv.pdfUrl && (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="Download PDF"
                    >
                      <FileDown className="h-4 w-4" />
                    </a>
                  )}
                  {inv.hostedUrl && (
                    <a
                      href={inv.hostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="View in Stripe"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </span>
              </td>
            </tr>
          ))}
          {invoices.length === 0 && (
            <tr>
              <td
                colSpan={(showMemberColumn ? 6 : 5) + (hasTax ? 2 : 0)}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No invoices yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
