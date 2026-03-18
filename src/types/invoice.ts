export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  discount: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  pdfUrl?: string;
}

export interface InvoiceFilters {
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page: number;
  limit: number;
}
