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

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  method: 'mpesa' | 'cash' | 'card' | 'bank_transfer';
  reference: string;
  mpesaReceiptNumber?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  recordedBy: string;
  notes?: string;
  createdAt: string;
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
