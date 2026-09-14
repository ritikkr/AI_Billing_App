import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { amountInWords } from '../utils/gst';
import type { InvoiceDetail, DocumentDesign } from '../types';

Font.registerHyphenationCallback((word) => [word]);

const base = {
  classic: {
    page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' as string },
    titleColor: '#4f46e5',
    headerBg: 'transparent',
    tableHeaderBg: '#eef2ff',
    tableHeaderText: '#4338ca',
    labelColor: '#94a3b8',
    bankBoxBg: '#f8fafc',
    grandTotalBg: 'transparent',
    titleBg: 'transparent',
    accentBar: false,
  },
  modern: {
    page: { padding: 0, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' as string },
    titleColor: '#ffffff',
    headerBg: '#4338ca',
    tableHeaderBg: '#eef2ff',
    tableHeaderText: '#3730a3',
    labelColor: '#818cf8',
    bankBoxBg: '#eef2ff',
    grandTotalBg: '#4338ca',
    titleBg: '#4f46e5',
    accentBar: true,
  },
  minimal: {
    page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: '#0f172a' as string },
    titleColor: '#0f172a',
    headerBg: 'transparent',
    tableHeaderBg: '#f8fafc',
    tableHeaderText: '#334155',
    labelColor: '#64748b',
    bankBoxBg: '#ffffff',
    grandTotalBg: 'transparent',
    titleBg: 'transparent',
    accentBar: false,
  },
};

function buildStyles(design: Exclude<DocumentDesign, 'vyapar'>) {
  const c = base[design];
  const dividerColor = design === 'minimal' ? '#cbd5e1' : design === 'modern' ? '#e9e5fb' : '#e2e8f0';

  return StyleSheet.create({
    page: c.page,
    headerWrap: c.headerBg === 'transparent' ? { paddingTop: 2 } : { backgroundColor: c.headerBg, paddingVertical: 20, paddingHorizontal: 28, marginBottom: 18 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    companyName: {
      fontSize: 15,
      fontWeight: 700,
      marginBottom: 2,
      color: c.headerBg === 'transparent' ? '#1e293b' : '#ffffff',
    },
    small: {
      fontSize: 8,
      color: design === 'modern' && c.headerBg !== 'transparent' ? '#e0e7ff' : '#475569',
      lineHeight: 1.5,
    },
    titleBlock: { alignItems: 'flex-end' },
    title: {
      fontSize: 16,
      fontWeight: 700,
      color: c.titleColor,
      marginBottom: 2,
      backgroundColor: c.accentBar ? c.titleBg : 'transparent',
      paddingHorizontal: c.accentBar ? 8 : 0,
      paddingVertical: c.accentBar ? 4 : 0,
      borderRadius: c.accentBar ? 4 : 0,
    },
    section: { marginBottom: 10 },
    divider: { borderBottomWidth: 1, borderBottomColor: dividerColor, marginVertical: 10 },
    twoCol: { flexDirection: 'row', justifyContent: 'space-between' },
    colBox: { width: '48%' },
    label: { fontSize: 7.5, color: c.labelColor, textTransform: 'uppercase' as const, marginBottom: 2, letterSpacing: 0.5 },
    boldText: { fontWeight: 700 },
    table: { display: 'flex', width: '100%', marginTop: 6 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: c.tableHeaderBg, paddingVertical: 5, paddingHorizontal: 4 },
    tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    th: { fontSize: 7.5, fontWeight: 700, color: c.tableHeaderText, textTransform: 'uppercase' as const },
    td: { fontSize: 8.5 },
    colSr: { width: '5%' },
    colDesc: { width: '27%' },
    colHsn: { width: '10%' },
    colQty: { width: '8%', textAlign: 'right' as const },
    colRate: { width: '10%', textAlign: 'right' as const },
    colTaxable: { width: '12%', textAlign: 'right' as const },
    colTax: { width: '14%', textAlign: 'right' as const },
    colTotal: { width: '14%', textAlign: 'right' as const },
    totalsBlock: { marginTop: 10, alignItems: 'flex-end' },
    totalsRow: { flexDirection: 'row', width: 220, justifyContent: 'space-between', paddingVertical: 2 },
    grandTotalRow: {
      flexDirection: 'row',
      width: 220,
      justifyContent: 'space-between',
      paddingVertical: 5,
      paddingHorizontal: 6,
      borderTopWidth: 1,
      borderTopColor: '#cbd5e1',
      marginTop: 2,
      backgroundColor: c.grandTotalBg,
      color: c.grandTotalBg === 'transparent' ? '#0f172a' : '#ffffff',
    },
    footer: { marginTop: 16, fontSize: 8, color: '#64748b' },
    bankBox: { marginTop: 10, padding: 8, backgroundColor: c.bankBoxBg, borderRadius: 4 },
    stamp: { marginTop: 30, alignItems: 'flex-end' },
  });
}

export function InvoicePdf({ invoice, design = 'classic' }: { invoice: InvoiceDetail; design?: DocumentDesign }) {
  if (design === 'vyapar') return <VyaparPdf invoice={invoice} />;
  const company = invoice.company || {};
  const customer = invoice.customer || {};
  const styles = buildStyles(design);

  return (
    <Document title={`${invoice.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <View style={{ maxWidth: '55%' }}>
              {company.logo_url && (
                <Image src={company.logo_url} style={{ height: 38, maxWidth: 140, objectFit: 'contain', marginBottom: 4, alignSelf: 'flex-start' }} />
              )}
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
        </View>

        <View style={[styles.divider, ...(design === 'modern' ? [{ marginTop: 6 }] : [])]} />

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
          {company.signature_url && (
            <Image src={company.signature_url} style={{ height: 42, maxWidth: 140, objectFit: 'contain', marginTop: 6 }} />
          )}
          <Text style={{ ...styles.small, marginTop: company.signature_url ? 3 : 24 }}>Authorized Signatory</Text>
        </View>

        <Text style={{ ...styles.small, marginTop: 16, textAlign: 'center', color: '#94a3b8' }}>
          This is a computer-generated invoice and does not require a physical signature.
        </Text>
      </Page>
    </Document>
  );
}

function VyaparPdf({ invoice }: { invoice: InvoiceDetail }) {
  const company = invoice.company || {};
  const customer = invoice.customer || {};
  const tax = invoice.isInterstate ? invoice.totalIgst : (invoice.totalCgst || 0) + (invoice.totalSgst || 0);
  const gstRate = invoice.taxableValue ? Math.round((tax / invoice.taxableValue) * 100) : 0;
  const qtySum = invoice.lineItems.reduce((sum, item) => sum + (item.qty || 0), 0);
  const BORDER = { borderColor: '#808080', borderWidth: 0.75 } as const;
  const topBorder = { borderTopWidth: 0.75, borderTopColor: '#808080' } as const;
  const cell = { ...BORDER, paddingVertical: 3, paddingHorizontal: 5 };
  const rightCell = { ...cell, textAlign: 'right' as const };
  const boldCell = { ...cell, fontWeight: 700 };
  const amountRow = {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 6,
    paddingVertical: 4,
    ...topBorder,
  };

  return (
    <Document title={`${invoice.invoiceNumber}`}>
      <Page size="A4" style={{ padding: 28, fontSize: 9.5, fontFamily: 'Helvetica', color: '#0f172a', lineHeight: 1.4 }}>
        <Text style={{ textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Tax Invoice</Text>

        <View style={{ ...BORDER, marginTop: 8, flexDirection: 'row' }}>
          <View style={{ ...BORDER, flexGrow: 1, flexBasis: 0, padding: 7 }}>
            {company.logo_url && (
              <Image src={company.logo_url} style={{ height: 34, maxWidth: 150, objectFit: 'contain', marginBottom: 4 }} />
            )}
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{company.name}</Text>
            <Text style={{ fontSize: 8, marginTop: 2 }}>
              {[company.address_line1, company.address_line2, company.city, company.state, company.pincode].filter(Boolean).join(', ')}
            </Text>
            <Text style={{ fontSize: 8 }}>Phone no.: {company.phone}</Text>
            {company.email && <Text style={{ fontSize: 8 }}>Email: {company.email}</Text>}
            {company.gstin && <Text style={{ fontSize: 8 }}>GSTIN: {company.gstin}</Text>}
            <Text style={{ fontSize: 8 }}>State: {[company.stateCode, company.state].filter(Boolean).join('-')}</Text>
          </View>
          <View style={{ ...BORDER, width: '32%', padding: 0 }}>
            <View style={{ ...BORDER, flexDirection: 'row' }}>
              <View style={{ flexBasis: '50%' as const, padding: 5 }}>
                <Text style={{ fontSize: 7.5, color: '#475569' }}>Invoice No.</Text>
                <Text style={{ fontSize: 10, fontWeight: 700 }}>{invoice.invoiceNumber}</Text>
              </View>
              <View style={{ ...BORDER, flexBasis: '50%' as const, padding: 5 }}>
                <Text style={{ fontSize: 7.5, color: '#475569' }}>Date</Text>
                <Text style={{ fontSize: 10, fontWeight: 700 }}>{formatDate(invoice.invoiceDate)}</Text>
              </View>
            </View>
            <View style={{ padding: 5 }}>
              <Text style={{ fontSize: 7.5, color: '#475569' }}>Place of supply</Text>
              <Text style={{ fontSize: 10, fontWeight: 700 }}>
                {[invoice.placeOfSupplyStateCode, customer.billing_state].filter(Boolean).join('-') || '-'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ ...BORDER, marginTop: 8 }}>
          <Text style={{ ...BORDER, fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', paddingVertical: 2, paddingHorizontal: 7 }}>
            Bill To
          </Text>
          <View style={{ padding: 7 }}>
            <Text style={{ fontWeight: 700 }}>{customer.name}</Text>
            <Text style={{ fontSize: 8.5 }}>
              {[customer.billing_address, customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(', ')}
            </Text>
            {customer.gstin && <Text style={{ fontSize: 8.5 }}>GSTIN : {customer.gstin}</Text>}
            <Text style={{ fontSize: 8.5 }}>State: {customer.billing_state || [company.stateCode, company.state].filter(Boolean).join('-')}</Text>
          </View>
        </View>

        <View style={{ ...BORDER, marginTop: 8 }}>
          <View style={{ ...BORDER, flexDirection: 'row' }}>
            <Text style={[boldCell, { width: '4%', fontSize: 8 }]}>#</Text>
            <Text style={[boldCell, { width: '34%', fontSize: 8 }]}>Item name</Text>
            <Text style={[boldCell, { width: '13%', fontSize: 8 }]}>HSN/ SAC</Text>
            <Text style={[boldCell, { width: '13%', fontSize: 8, textAlign: 'right' }]}>Quantity</Text>
            <Text style={[boldCell, { width: '17%', fontSize: 8, textAlign: 'right' }]}>Price/ Unit</Text>
            <Text style={[boldCell, { width: '19%', fontSize: 8, textAlign: 'right' }]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item, idx) => (
            <View style={{ ...BORDER, flexDirection: 'row' }} key={item.id || idx} wrap={false}>
              <Text style={[cell, { width: '4%' }]}>{idx + 1}</Text>
              <Text style={[cell, { width: '34%' }]}>{item.description}</Text>
              <Text style={[cell, { width: '13%' }]}>{item.hsnSacCode || '-'}</Text>
              <Text style={[rightCell, { width: '13%' }]}>
                {item.qty} {item.unit}
              </Text>
              <Text style={[rightCell, { width: '17%' }]}>{fmt(item.rate)}</Text>
              <Text style={[rightCell, { width: '19%' }]}>{fmt(item.lineTotal)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row' }}>
            <Text style={[cell, { width: '38%', fontWeight: 700 }]}>Total</Text>
            <Text style={[cell, { width: '13%' }]} />
            <Text style={[rightCell, { width: '13%', fontWeight: 700 }]}>{qtySum}</Text>
            <Text style={[cell, { width: '17%' }]} />
            <Text style={[rightCell, { width: '19%', fontWeight: 700 }]}>{fmt(invoice.subtotal)}</Text>
          </View>
        </View>

        <View style={{ ...BORDER, marginTop: 8, flexDirection: 'row' }}>
          <View style={{ ...BORDER, flexBasis: '56%' as const, padding: 7 }}>
            <Text style={{ fontSize: 7.5, color: '#475569' }}>Invoice Amount in Words</Text>
            <Text style={{ fontSize: 8.5, fontWeight: 700, marginTop: 2 }}>{amountInWords(invoice.grandTotal)}</Text>
          </View>
          <View style={{ flexBasis: '44%' as const }}>
            <Text style={{ fontWeight: 700, padding: 6 }}>Amounts</Text>
            <View style={amountRow}>
              <Text>Sub Total</Text>
              <Text>{fmt(invoice.subtotal)}</Text>
            </View>
            {invoice.totalDiscount > 0 && (
              <View style={amountRow}>
                <Text>Discount</Text>
                <Text>-{fmt(invoice.totalDiscount)}</Text>
              </View>
            )}
            {gstRate > 0 && (
              <View style={amountRow}>
                <Text>Tax ({gstRate}%)</Text>
                <Text>{fmt(tax)}</Text>
              </View>
            )}
            {invoice.roundOff !== 0 && (
              <View style={amountRow}>
                <Text>Round off</Text>
                <Text>{fmt(invoice.roundOff)}</Text>
              </View>
            )}
            <View style={{ ...amountRow, fontWeight: 700 }}>
              <Text>Total</Text>
              <Text>{fmt(invoice.grandTotal)}</Text>
            </View>
          </View>
        </View>

        <View style={{ ...BORDER, marginTop: 8 }}>
          <View style={{ ...BORDER, flexDirection: 'row' }}>
            <Text style={[boldCell, { width: '14%', fontSize: 8 }]}>HSN/ SAC</Text>
            <Text style={[boldCell, { width: '18%', fontSize: 8, textAlign: 'right' }]}>Taxable amount</Text>
            {!invoice.isInterstate ? (
              <>
                <Text style={[BORDER, { width: '24%', textAlign: 'center', paddingVertical: 3, fontSize: 8, fontWeight: 700 }]}>CGST</Text>
                <Text style={[BORDER, { width: '24%', textAlign: 'center', paddingVertical: 3, fontSize: 8, fontWeight: 700 }]}>SGST</Text>
                <Text style={[boldCell, { width: '20%', fontSize: 8, textAlign: 'right' }]}>Total Tax Amount</Text>
              </>
            ) : (
              <>
                <Text style={[BORDER, { width: '34%', textAlign: 'center', paddingVertical: 3, fontSize: 8, fontWeight: 700 }]}>IGST</Text>
                <Text style={[boldCell, { width: '34%', fontSize: 8, textAlign: 'right' }]}>Total Tax Amount</Text>
              </>
            )}
          </View>
          <View style={{ ...BORDER, flexDirection: 'row' }}>
            {!invoice.isInterstate ? (
              <>
                <Text style={[cell, { width: '32%' }]} />
                <Text style={[rightCell, { width: '16%', fontSize: 8, fontWeight: 700 }]}>Rate</Text>
                <Text style={[rightCell, { width: '16%', fontSize: 8, fontWeight: 700 }]}>Amount</Text>
                <Text style={[rightCell, { width: '16%', fontSize: 8, fontWeight: 700 }]}>Rate</Text>
                <Text style={[rightCell, { width: '16%', fontSize: 8, fontWeight: 700 }]}>Amount</Text>
              </>
            ) : (
              <>
                <Text style={[cell, { width: '32%' }]} />
                <Text style={[rightCell, { width: '34%', fontSize: 8, fontWeight: 700 }]}>Rate</Text>
                <Text style={[rightCell, { width: '34%', fontSize: 8, fontWeight: 700 }]}>Amount</Text>
              </>
            )}
          </View>
        </View>

        <View style={{ marginTop: 4 }}>
          {invoice.lineItems.map((item, idx) => (
            <View style={{ flexDirection: 'row' }} key={item.id || idx} wrap={false}>
              <Text style={[cell, { width: '14%' }]}>{item.hsnSacCode || '-'}</Text>
              <Text style={[rightCell, { width: '18%' }]}>{fmt(item.taxableValue)}</Text>
              {!invoice.isInterstate ? (
                <>
                  <Text style={[rightCell, { width: '12%' }]}>{item.gstRate}%</Text>
                  <Text style={[rightCell, { width: '12%' }]}>{fmt(item.cgstAmount || 0)}</Text>
                  <Text style={[rightCell, { width: '12%' }]}>{item.gstRate}%</Text>
                  <Text style={[rightCell, { width: '12%' }]}>{fmt(item.sgstAmount || 0)}</Text>
                  <Text style={[rightCell, { width: '20%' }]}>{fmt((item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0))}</Text>
                </>
              ) : (
                <>
                  <Text style={[rightCell, { width: '17%' }]}>{item.gstRate}%</Text>
                  <Text style={[rightCell, { width: '17%' }]}>{fmt(item.igstAmount || 0)}</Text>
                  <Text style={[rightCell, { width: '34%' }]}>{fmt((item.sgstAmount || 0) + (item.igstAmount || 0))}</Text>
                </>
              )}
            </View>
          ))}
          <View style={{ flexDirection: 'row' }}>
            <Text style={[boldCell, { width: '14%' }]}>Total</Text>
            <Text style={[rightCell, { width: '18%', fontWeight: 700 }]}>{fmt(invoice.taxableValue)}</Text>
            {!invoice.isInterstate ? (
              <>
                <Text style={[cell, { width: '12%' }]} />
                <Text style={[rightCell, { width: '12%', fontWeight: 700 }]}>{fmt(invoice.totalCgst)}</Text>
                <Text style={[cell, { width: '12%' }]} />
                <Text style={[rightCell, { width: '12%', fontWeight: 700 }]}>{fmt(invoice.totalSgst)}</Text>
                <Text style={[rightCell, { width: '20%', fontWeight: 700 }]}>{fmt(invoice.totalCgst + invoice.totalSgst)}</Text>
              </>
            ) : (
              <>
                <Text style={[cell, { width: '17%' }]} />
                <Text style={[rightCell, { width: '17%', fontWeight: 700 }]}>{fmt(invoice.totalIgst)}</Text>
                <Text style={[rightCell, { width: '34%', fontWeight: 700 }]}>{fmt(invoice.totalIgst)}</Text>
              </>
            )}
          </View>
        </View>

        <View style={{ ...BORDER, marginTop: 8, flexDirection: 'row' }}>
          {(company.bank_name || company.bank_account_no) && (
            <View style={{ ...BORDER, width: '34%', padding: 6 }}>
              <Text style={{ fontSize: 8, fontWeight: 700 }}>Bank Details</Text>
              {company.bank_name && <Text style={{ fontSize: 7.5 }}>Name : {company.bank_name}</Text>}
              {company.bank_account_no && <Text style={{ fontSize: 7.5 }}>Account No. : {company.bank_account_no}</Text>}
              {company.bank_ifsc && <Text style={{ fontSize: 7.5 }}>IFSC code : {company.bank_ifsc}</Text>}
              {company.bank_branch && <Text style={{ fontSize: 7.5 }}>Branch : {company.bank_branch}</Text>}
            </View>
          )}
          <View style={{ ...BORDER, flexGrow: 1, flexBasis: 0, padding: 6 }}>
            {invoice.notes && (
              <>
                <Text style={{ fontSize: 8, fontWeight: 700 }}>Notes</Text>
                <Text style={{ fontSize: 7.5 }}>{invoice.notes}</Text>
              </>
            )}
            {invoice.terms && (
              <>
                <Text style={{ fontSize: 8, fontWeight: 700 }}>Terms and conditions</Text>
                <Text style={{ fontSize: 7.5 }}>{invoice.terms}</Text>
              </>
            )}
          </View>
          <View style={{ ...BORDER, width: '34%', padding: 6, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 8 }}>For : {company.name}</Text>
            {company.signature_url && (
              <Image src={company.signature_url} style={{ height: 38, maxWidth: 130, objectFit: 'contain', marginTop: 6 }} />
            )}
            <Text style={{ fontSize: 8, fontWeight: 700, marginTop: company.signature_url ? 2 : 26 }}>Authorized Signatory</Text>
          </View>
        </View>
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