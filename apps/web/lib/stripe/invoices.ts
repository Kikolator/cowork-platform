import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./client";

export interface InvoiceRow {
  id: string;
  number: string | null;
  date: number;
  subtotal: number;
  taxAmount: number;
  amountDue: number;
  currency: string;
  status: string | null;
  pdfUrl: string | null;
  hostedUrl: string | null;
  customerName: string | null;
  customerEmail: string | null;
}

function mapInvoice(inv: Stripe.Invoice): InvoiceRow {
  return {
    id: inv.id,
    number: inv.number ?? null,
    date: inv.created,
    subtotal: inv.subtotal,
    taxAmount: inv.tax ?? 0,
    amountDue: inv.amount_due,
    currency: inv.currency,
    status: inv.status ?? null,
    pdfUrl: inv.invoice_pdf ?? null,
    hostedUrl: inv.hosted_invoice_url ?? null,
    customerName: inv.customer_name ?? null,
    customerEmail: inv.customer_email ?? null,
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
