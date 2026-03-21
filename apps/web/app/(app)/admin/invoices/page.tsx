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

      <InvoiceTable invoices={invoices} showMemberColumn />
    </div>
  );
}
