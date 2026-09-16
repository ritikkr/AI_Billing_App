export type Role = 'admin' | 'accountant' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Membership {
  companyId: string;
  role: Role;
  companyName: string;
}

export interface Company {
  id: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string;
  stateCode: string;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
  invoicePrefix: string;
  creditNotePrefix: string;
  debitNotePrefix: string;
  quotationPrefix: string;
  certificatePrefix: string;
  financialYearStartMonth: number;
  logoUrl: string | null;
  signatureUrl: string | null;
  termsAndConditions: string | null;
  myRole?: Role;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  group: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  creditLimit: number;
  openingBalance: number;
  receivableBalance: number;
  payableBalance: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends Customer {
  outstandingBalance: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: number;
    amountPaid: number;
    status: InvoiceStatus;
  }>;
}

export interface Item {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  hsnSacCode: string | null;
  itemType: 'goods' | 'service';
  unit: string;
  salePrice: number;
  purchasePrice: number | null;
  gstRate: number;
  stockQty: number | null;
  trackInventory: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  id?: string;
  itemId?: string | null;
  description: string;
  hsnSacCode?: string | null;
  qty: number;
  unit: string;
  rate: number;
  discountPercent?: number;
  taxableValue?: number;
  gstRate: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  lineTotal?: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  financialYear: string;
  invoiceDate: string;
  dueDate: string | null;
  customerId: string;
  customerName?: string;
  placeOfSupplyStateCode: string;
  isInterstate: boolean;
  subtotal: number;
  totalDiscount: number;
  taxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes: string | null;
  terms: string | null;
  reverseCharge: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDetail extends Invoice {
  lineItems: InvoiceLineItem[];
  customer: any;
  company: any;
  payments: Payment[];
}

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber?: string;
  customerName?: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  notes: string | null;
  createdAt: string;
}

export type NoteType = 'credit' | 'debit';

export interface CreditNote {
  id: string;
  companyId: string;
  noteType: NoteType;
  noteNumber: string;
  financialYear: string;
  noteDate: string;
  customerId: string;
  customerName?: string;
  invoiceId: string | null;
  reason: string | null;
  placeOfSupplyStateCode: string;
  isInterstate: boolean;
  taxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  roundOff: number;
  grandTotal: number;
  status: 'draft' | 'issued' | 'cancelled';
  notes: string | null;
  createdAt: string;
}

export interface CreditNoteDetail extends CreditNote {
  lineItems: InvoiceLineItem[];
  customer: any;
  company: any;
}

export interface StateOption {
  code: string;
  name: string;
}

export interface Meta {
  states: StateOption[];
  gstRateSlabs: number[];
  units: string[];
  paymentModes: string[];
}

export interface DashboardStats {
  totalRevenue: number;
  outstanding: number;
  taxCollected: number;
  invoiceCount: number;
  thisMonthRevenue: number;
  customerCount: number;
  itemCount: number;
  topCustomers: Array<{ id: string; name: string; total: number; invoiceCount: number }>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: number;
    status: InvoiceStatus;
    customerName: string;
  }>;
  revenueTrend: Array<{ month: string; total: number }>;
}

export interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type DocumentDesign = 'classic' | 'modern' | 'minimal' | 'vyapar';

export interface Preferences {
  printDesign: DocumentDesign;
  downloadDesign: DocumentDesign;
  updatedAt?: string;
}

export interface CertificateTemplate {
  id: string;
  companyId: string | null;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CertificateStatus = 'draft' | 'issued' | 'cancelled';

export interface Certificate {
  id: string;
  companyId: string;
  certificateNumber: string;
  financialYear: string;
  templateId: string | null;
  certificateDate: string;
  customerId: string | null;
  outletName: string | null;
  outletAddress: string | null;
  serviceDate: string | null;
  serviceType: string | null;
  validFrom: string | null;
  validUntil: string | null;
  customFields: Record<string, string> | null;
  notes: string | null;
  status: CertificateStatus;
  issuedBy: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  templateName?: string;
}

export interface CertificateDetail extends Certificate {
  customer: Customer | null;
  company: any;
  template: { id: string; name: string; subject: string; body: string; isDefault: boolean } | null;
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface Quotation {
  id: string;
  companyId: string;
  quotationNumber: string;
  financialYear: string;
  quotationDate: string;
  validUntil: string | null;
  customerId: string;
  customerName?: string;
  placeOfSupplyStateCode: string;
  isInterstate: boolean;
  subtotal: number;
  totalDiscount: number;
  taxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  roundOff: number;
  grandTotal: number;
  status: QuotationStatus;
  notes: string | null;
  terms: string | null;
  convertedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationDetail extends Quotation {
  lineItems: InvoiceLineItem[];
  customer: any;
  company: any;
}

export interface QuotationSummary {
  counts: {
    total: number;
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
    expired: number;
    converted: number;
  };
  totalQuoted: number;
  totalConverted: number;
}

export interface NextDocumentNumber {
  quotationNumber?: string;
  certificateNumber?: string;
  invoiceNumber?: string;
  financialYear: string;
  quotationDate?: string;
  certificateDate?: string;
  invoiceDate?: string;
}
