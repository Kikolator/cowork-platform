import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { verifyStripeReady } from "@/lib/stripe/connect";
import { listAccountInvoices } from "@/lib/stripe/invoices";
import { InvoiceTable } from "../../invoices/invoice-table";

export default async function AdminInvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) redirect("/login");

  let invoices: Awaited<ReturnType<typeof listAccountInvoices>> = [];

  try {
    const { stripeAccountId } = await verifyStripeReady(tenantId);
    invoices = await listAccountInvoices(stripeAccountId);
  } catch {
    // Stripe not configured — show empty state
  }

  // Revenue summary from paid invoices
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");
  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);
  const totalTax = paidInvoices.reduce((sum, inv) => sum + inv.taxAmount, 0);
  const netRevenue = totalRevenue - totalTax;
  const currency = paidInvoices[0]?.currency ?? "eur";

  function fmt(cents: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All member invoices for this space.
        </p>
      </div>

      {paidInvoices.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
            <p className="mt-1 text-xl font-bold">{fmt(totalRevenue)}</p>
          </div>
          {totalTax > 0 && (
            <>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground">Tax Collected</p>
                <p className="mt-1 text-xl font-bold">{fmt(totalTax)}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground">Net Revenue</p>
                <p className="mt-1 text-xl font-bold">{fmt(netRevenue)}</p>
              </div>
            </>
          )}
        </div>
      )}

      <InvoiceTable invoices={invoices} showMemberColumn />
    </div>
  );
}
