import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { amountInWords } from '../utils/gst';
import type { InvoiceDetail } from '../types';

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  companyName: { fontSize: 15, fontWeight: 700, marginBottom: 2 },
  small: { fontSize: 8, color: '#475569', lineHeight: 1.5 },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 16, fontWeight: 700, color: '#4f46e5', marginBottom: 2 },
  section: { marginBottom: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 10 },
  twoCol: { flexDirection: 'row', justifyContent: 'space-between' },
  colBox: { width: '48%' },
  label: { fontSize: 7.5, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 },
  boldText: { fontWeight: 700 },
  table: { display: 'flex', width: '100%', marginTop: 6 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#eef2ff', paddingVertical: 5, paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  th: { fontSize: 7.5, fontWeight: 700, color: '#4338ca', textTransform: 'uppercase' },
  td: { fontSize: 8.5 },
  colSr: { width: '5%' },
  colDesc: { width: '27%' },
  colHsn: { width: '10%' },
  colQty: { width: '8%', textAlign: 'right' },
  colRate: { width: '10%', textAlign: 'right' },
  colTaxable: { width: '12%', textAlign: 'right' },
  colTax: { width: '14%', textAlign: 'right' },
  colTotal: { width: '14%', textAlign: 'right' },
  totalsBlock: { marginTop: 10, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', width: 220, justifyContent: 'space-between', paddingVertical: 2 },
  grandTotalRow: { flexDirection: 'row', width: 220, justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 2 },
  footer: { marginTop: 16, fontSize: 8, color: '#64748b' },
  bankBox: { marginTop: 10, padding: 8, backgroundColor: '#f8fafc', borderRadius: 4 },
  stamp: { marginTop: 30, alignItems: 'flex-end' },
});

export function InvoicePdf({ invoice }: { invoice: InvoiceDetail }) {
  const company = invoice.company || {};
  const customer = invoice.customer || {};

  return (
    <Document title={`${invoice.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ maxWidth: '55%' }}>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.small}>
              {[company.address_line1, company.address_line2, company.city, company.state, company.pincode].filter(Boolean).join(', ')}
            </Text>
            {company.gstin && <Text style={styles.small}>GSTIN: {company.gstin}</Text>}
            {company.phone && <Text style={styles.small}>Phone: {company.phone}</Text>}
            {company.email && <Text style={styles.small}>Email: {company.email}</Text>}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>TAX INVOICE</Text>
            <Text style={styles.small}>Invoice #: {invoice.invoiceNumber}</Text>
            <Text style={styles.small}>Date: {formatDate(invoice.invoiceDate)}</Text>
            {invoice.dueDate && <Text style={styles.small}>Due: {formatDate(invoice.dueDate)}</Text>}
            {invoice.reverseCharge && <Text style={styles.small}>Reverse Charge: Yes</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.twoCol}>
          <View style={styles.colBox}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.boldText}>{customer.name}</Text>
            <Text style={styles.small}>
              {[customer.billing_address, customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(', ')}
            </Text>
            {customer.gstin && <Text style={styles.small}>GSTIN: {customer.gstin}</Text>}
          </View>
          <View style={styles.colBox}>
            <Text style={styles.label}>Ship To</Text>
            <Text style={styles.boldText}>{customer.name}</Text>
            <Text style={styles.small}>
              {[customer.shipping_address || customer.billing_address, customer.shipping_city || customer.billing_city, customer.shipping_state || customer.billing_state]
                .filter(Boolean)
                .join(', ')}
            </Text>
            <Text style={{ ...styles.small, marginTop: 4 }}>
              Place of Supply: {invoice.placeOfSupplyStateCode} ({invoice.isInterstate ? 'Inter-state' : 'Intra-state'})
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colSr]}>#</Text>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colHsn]}>HSN/SAC</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colRate]}>Rate</Text>
            <Text style={[styles.th, styles.colTaxable]}>Taxable</Text>
            <Text style={[styles.th, styles.colTax]}>Tax</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {invoice.lineItems.map((item, idx) => (
            <View style={styles.tableRow} key={item.id || idx} wrap={false}>
              <Text style={[styles.td, styles.colSr]}>{idx + 1}</Text>
              <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.td, styles.colHsn]}>{item.hsnSacCode || '-'}</Text>
              <Text style={[styles.td, styles.colQty]}>
                {item.qty} {item.unit}
              </Text>
              <Text style={[styles.td, styles.colRate]}>{fmt(item.rate)}</Text>
              <Text style={[styles.td, styles.colTaxable]}>{fmt(item.taxableValue)}</Text>
              <Text style={[styles.td, styles.colTax]}>
                {invoice.isInterstate ? `IGST ${item.gstRate}%` : `${item.gstRate}%`}
                {'\n'}
                {fmt((item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0))}
              </Text>
              <Text style={[styles.td, styles.colTotal]}>{fmt(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{fmt(invoice.subtotal)}</Text>
          </View>
          {invoice.totalDiscount > 0 && (
            <View style={styles.totalsRow}>
              <Text>Discount</Text>
              <Text>-{fmt(invoice.totalDiscount)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text>Taxable Value</Text>
            <Text>{fmt(invoice.taxableValue)}</Text>
          </View>
          {invoice.isInterstate ? (
            <View style={styles.totalsRow}>
              <Text>IGST</Text>
              <Text>{fmt(invoice.totalIgst)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.totalsRow}>
                <Text>CGST</Text>
                <Text>{fmt(invoice.totalCgst)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text>SGST</Text>
                <Text>{fmt(invoice.totalSgst)}</Text>
              </View>
            </>
          )}
          {invoice.roundOff !== 0 && (
            <View style={styles.totalsRow}>
              <Text>Round Off</Text>
              <Text>{fmt(invoice.roundOff)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.boldText}>Grand Total</Text>
            <Text style={styles.boldText}>{fmt(invoice.grandTotal)}</Text>
          </View>
        </View>

        <Text style={{ ...styles.small, marginTop: 6 }}>Amount in words: {amountInWords(invoice.grandTotal)}</Text>

        {(company.bank_name || company.bank_account_no) && (
          <View style={styles.bankBox}>
            <Text style={styles.label}>Bank Details</Text>
            <Text style={styles.small}>Bank: {company.bank_name}</Text>
            <Text style={styles.small}>Account No: {company.bank_account_no}</Text>
            <Text style={styles.small}>IFSC: {company.bank_ifsc}</Text>
            {company.bank_branch && <Text style={styles.small}>Branch: {company.bank_branch}</Text>}
          </View>
        )}

        {invoice.notes && (
          <View style={styles.footer}>
            <Text style={styles.label}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}
        {invoice.terms && (
          <View style={styles.footer}>
            <Text style={styles.label}>Terms & Conditions</Text>
            <Text>{invoice.terms}</Text>
          </View>
        )}

        <View style={styles.stamp}>
          <Text style={styles.small}>For {company.name}</Text>
          <Text style={{ ...styles.small, marginTop: 24 }}>Authorized Signatory</Text>
        </View>

        <Text style={{ ...styles.small, marginTop: 16, textAlign: 'center', color: '#94a3b8' }}>
          This is a computer-generated invoice and does not require a physical signature.
        </Text>
      </Page>
    </Document>
  );
}

function fmt(n: number | null | undefined) {
  const v = n ?? 0;
  return `Rs. ${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
