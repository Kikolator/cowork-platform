import "server-only";
import { getStripe } from "./client";

export interface InvoiceRow {
  id: string;
  number: string | null;
  date: number;
  amountDue: number;
  currency: string;
  status: string | null;
  pdfUrl: string | null;
  hostedUrl: string | null;
  customerName: string | null;
  customerEmail: string | null;
}

function mapInvoice(inv: {
  id: string;
  number: string | null;
  created: number;
  amount_due: number;
  currency: string;
  status: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  customer_name: string | null;
  customer_email: string | null;
}): InvoiceRow {
  return {
    id: inv.id,
    number: inv.number,
    date: inv.created,
    amountDue: inv.amount_due,
    currency: inv.currency,
    status: inv.status,
    pdfUrl: inv.invoice_pdf,
    hostedUrl: inv.hosted_invoice_url,
    customerName: inv.customer_name,
    customerEmail: inv.customer_email,
  };
}

/**
 * List invoices for a specific customer on a connected Stripe account.
 */
export async function listCustomerInvoices(
  stripeAccountId: string,
  stripeCustomerId: string,
  limit = 50,
): Promise<InvoiceRow[]> {
  const stripe = getStripe();
  const invoices = await stripe.invoices.list(
    { customer: stripeCustomerId, limit },
    { stripeAccount: stripeAccountId },
  );
  return invoices.data.map(mapInvoice);
}

/**
 * List all invoices on a connected Stripe account (for space admins).
 */
export async function listAccountInvoices(
  stripeAccountId: string,
  limit = 100,
): Promise<InvoiceRow[]> {
  const stripe = getStripe();
  const invoices = await stripe.invoices.list(
    { limit },
    { stripeAccount: stripeAccountId },
  );
  return invoices.data.map(mapInvoice);
}
