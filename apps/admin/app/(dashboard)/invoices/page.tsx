import { FileText } from "lucide-react";
import { listApplicationFees } from "@/lib/stripe/invoices";

function formatCurrency(cents: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function PlatformInvoicesPage() {
  let fees: Awaited<ReturnType<typeof listApplicationFees>> = [];

  try {
    fees = await listApplicationFees();
  } catch {
    // Stripe may not be configured
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform commission fees collected from tenant transactions.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Fee ID
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Tenant
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Fee Amount
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) => (
              <tr key={fee.id} className="border-b border-border/50">
                <td className="px-4 py-3 font-mono text-xs">{fee.id}</td>
                <td className="px-4 py-3 text-xs">
                  {fee.accountName ?? fee.accountId}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {formatCurrency(fee.amount, fee.currency)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {new Date(fee.date * 1000).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {fees.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No platform fees collected yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
