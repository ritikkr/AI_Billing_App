import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { CertificateDetail } from '../types';
import { resolveTemplate } from '../components/certificates/TemplateEditor';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b', lineHeight: 1.5 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  companyBlock: { maxWidth: '55%' },
  companyName: { fontSize: 15, fontWeight: 700, color: '#0f766e', marginBottom: 2 },
  small: { fontSize: 8, color: '#475569', lineHeight: 1.5 },
  certBlock: { alignItems: 'flex-end' },
  certTitle: { fontSize: 13, fontWeight: 700, color: '#0f766e' },
  divider: { borderBottomWidth: 1.5, borderBottomColor: '#0f766e', marginVertical: 16 },
  refLine: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginBottom: 18 },
  refValue: { fontWeight: 700, color: '#1e293b' },
  subject: { fontSize: 15, fontWeight: 700, textAlign: 'center', marginBottom: 20 },
  body: { fontSize: 10.5, lineHeight: 1.7, color: '#1e293b' },
  signatureBlock: { marginTop: 50, alignItems: 'center' },
  signatureName: { fontSize: 11, fontWeight: 700, marginTop: 4 },
  signatureRole: { fontSize: 9, color: '#475569' },
  signatureImg: { height: 42, maxWidth: 140, objectFit: 'contain', marginTop: 4 },
  footer: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, textAlign: 'center' },
  footerText: { fontSize: 8, color: '#94a3b8' },
});

export function CertificatePdf({ certificate }: { certificate: CertificateDetail }) {
  const company = certificate.company || {};
  const values: Record<string, string> = {
    company_name: company.name || '',
    outlet_name: certificate.outletName || '',
    outlet_address: certificate.outletAddress || '',
    service_date: certificate.serviceDate || '',
    service_type: certificate.serviceType || '',
    valid_from: certificate.validFrom || '',
    valid_until: certificate.validUntil || '',
    certificate_date: certificate.certificateDate || '',
    certificate_number: certificate.certificateNumber || '',
    customer_name: certificate.customer?.name || '',
    ...(certificate.customFields || {}),
  };

  const subject = certificate.template?.subject || 'Service Completion Certificate';
  const body = resolveTemplate(certificate.template?.body || '', values);

  return (
    <Document title={certificate.certificateNumber}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
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
          <View style={styles.certBlock}>
            <Text style={styles.certTitle}>CERTIFICATE</Text>
            <Text style={styles.small}>No: {certificate.certificateNumber}</Text>
            <Text style={styles.small}>Date: {formatDate(certificate.certificateDate)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.refLine}>
          <Text>
            Certificate No: <Text style={styles.refValue}>{certificate.certificateNumber}</Text>
          </Text>
          <Text>
            Date: <Text style={styles.refValue}>{formatDate(certificate.certificateDate)}</Text>
          </Text>
        </View>
        {certificate.customer?.name && (
          <View style={styles.refLine}>
            <Text>
              Customer: <Text style={styles.refValue}>{certificate.customer.name}</Text>
            </Text>
          </View>
        )}

        <Text style={styles.subject}>{subject}</Text>

        <Text style={styles.body}>{body}</Text>

        <View style={styles.signatureBlock}>
          <Text style={styles.small}>For {company.name}</Text>
          {company.signature_url && <Image src={company.signature_url} style={styles.signatureImg} />}
          <Text style={[styles.signatureName, { marginTop: company.signature_url ? 2 : 30 }]}>Authorized Signatory</Text>
          <Text style={styles.signatureRole}>{certificate.issuedBy ? `Issued by: ${certificate.issuedBy}` : ' '}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This certificate has been generated electronically by {company.name} and does not require a physical signature.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}