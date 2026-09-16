import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { amountInWords } from '../utils/gst';
import type { QuotationDetail, DocumentDesign } from '../types';

const base = {
  classic: {
    page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' as string },
    titleColor: '#0f766e',
    headerBg: 'transparent',
    tableHeaderBg: '#f0fdfa',
    tableHeaderText: '#0f766e',
    labelColor: '#94a3b8',
    bankBoxBg: '#f8fafc',
    grandTotalBg: 'transparent',
    titleBg: 'transparent',
    accentBar: false,
  },
  modern: {
    page: { padding: 0, fontSize: 9, fontFamily: 'Helvetica', color: '#1e293b' as string },
    titleColor: '#ffffff',
    headerBg: '#0f766e',
    tableHeaderBg: '#f0fdfa',
    tableHeaderText: '#0f766e',
    labelColor: '#5eead4',
    bankBoxBg: '#f0fdfa',
    grandTotalBg: '#0f766e',
    titleBg: '#14b8a6',
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
  const dividerColor = design === 'minimal' ? '#cbd5e1' : design === 'modern' ? '#99f6e4' : '#e2e8f0';

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
      color: design === 'modern' && c.headerBg !== 'transparent' ? '#ccfbf1' : '#475569',
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
    notesBlock: { marginTop: 10, fontSize: 8, color: '#475569' },
    stamp: { marginTop: 30, alignItems: 'flex-end' },
  });
}

export function QuotationPdf({ quotation, design = 'classic' }: { quotation: QuotationDetail; design?: DocumentDesign }) {
  const safeDesign: Exclude<DocumentDesign, 'vyapar'> = design === 'vyapar' ? 'classic' : design;
  const company = quotation.company || {};
  const customer = quotation.customer || {};
  const styles = buildStyles(safeDesign);

  return (
    <Document title={`${quotation.quotationNumber}`}>
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
              <Text style={styles.title}>QUOTATION</Text>
              <Text style={styles.small}>Quotation #: {quotation.quotationNumber}</Text>
              <Text style={styles.small}>Date: {formatDate(quotation.quotationDate)}</Text>
              {quotation.validUntil && <Text style={styles.small}>Valid Until: {formatDate(quotation.validUntil)}</Text>}
            </View>
          </View>
        </View>

        <View style={[styles.divider, ...(safeDesign === 'modern' ? [{ marginTop: 6 }] : [])]} />

        <View style={styles.twoCol}>
          <View style={styles.colBox}>
            <Text style={styles.label}>Prepared For</Text>
            <Text style={styles.boldText}>{customer.name}</Text>
            <Text style={styles.small}>
              {[customer.billing_address, customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(', ')}
            </Text>
            {customer.gstin && <Text style={styles.small}>GSTIN: {customer.gstin}</Text>}
          </View>
          <View style={styles.colBox}>
            <Text style={styles.label}>Place of Supply</Text>
            <Text style={{ ...styles.boldText, marginBottom: 4 }}>
              {quotation.placeOfSupplyStateCode} ({quotation.isInterstate ? 'Inter-state' : 'Intra-state'})
            </Text>
            <Text style={styles.label}>Our Reference</Text>
            <Text style={styles.small}>{quotation.company?.name}</Text>
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
          {quotation.lineItems.map((item, idx) => (
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
                {quotation.isInterstate ? `IGST ${item.gstRate}%` : `${item.gstRate}%`}
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
            <Text>{fmt(quotation.subtotal)}</Text>
          </View>
          {quotation.totalDiscount > 0 && (
            <View style={styles.totalsRow}>
              <Text>Discount</Text>
              <Text>-{fmt(quotation.totalDiscount)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text>Taxable Value</Text>
            <Text>{fmt(quotation.taxableValue)}</Text>
          </View>
          {quotation.isInterstate ? (
            <View style={styles.totalsRow}>
              <Text>IGST</Text>
              <Text>{fmt(quotation.totalIgst)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.totalsRow}>
                <Text>CGST</Text>
                <Text>{fmt(quotation.totalCgst)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text>SGST</Text>
                <Text>{fmt(quotation.totalSgst)}</Text>
              </View>
            </>
          )}
          {quotation.roundOff !== 0 && (
            <View style={styles.totalsRow}>
              <Text>Round Off</Text>
              <Text>{fmt(quotation.roundOff)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.boldText}>Grand Total</Text>
            <Text style={styles.boldText}>{fmt(quotation.grandTotal)}</Text>
          </View>
        </View>

        <Text style={{ ...styles.small, marginTop: 6 }}>Amount in words: {amountInWords(quotation.grandTotal)}</Text>

        {quotation.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.label}>Notes</Text>
            <Text>{quotation.notes}</Text>
          </View>
        )}
        {quotation.terms && (
          <View style={styles.notesBlock}>
            <Text style={styles.label}>Terms & Conditions</Text>
            <Text>{quotation.terms}</Text>
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
          This is a computer-generated quotation and does not require a physical signature.
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