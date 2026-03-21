import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { verifyStripeReady } from "@/lib/stripe/connect";
import { listCustomerInvoices } from "@/lib/stripe/invoices";
import { InvoiceTable } from "./invoice-table";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!spaceId || !tenantId) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .maybeSingle();

  let invoices: Awaited<ReturnType<typeof listCustomerInvoices>> = [];

  if (member?.stripe_customer_id) {
    try {
      const { stripeAccountId } = await verifyStripeReady(tenantId);
      invoices = await listCustomerInvoices(
        stripeAccountId,
        member.stripe_customer_id,
      );
    } catch {
      // Stripe not configured — show empty state
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your billing history and invoice downloads.
        </p>
      </div>

      <InvoiceTable invoices={invoices} />
    </div>
  );
}
