export type InvoiceStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface PaymentInvoice {
  id: string;
  userSubscriptionId: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  gatewayInvoiceId: string | null;
  dueDate: string | null;
  paidAt: string | null;
  receiptUrl: string | null;
  createdAt: string;
}
