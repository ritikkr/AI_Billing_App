import type { CertificateDetail } from '../../types';
import { formatDate } from '../../utils/format';
import { resolveTemplate } from '../certificates/TemplateEditor';

export function CertificatePrintView({ certificate }: { certificate: CertificateDetail }) {
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
    <div className="px-10 pb-8 pt-10 text-[13px] leading-snug text-slate-800">
      <div className="flex items-start justify-between">
        <div className="max-w-[55%]">
          {company.logo_url && <img src={company.logo_url} alt="Company logo" className="mb-2 h-12 w-auto max-w-[150px] rounded object-contain" />}
          <h1 className="text-xl font-bold text-teal-700">{company.name}</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {[company.address_line1, company.address_line2, company.city, company.state, company.pincode].filter(Boolean).join(', ')}
          </p>
          {company.gstin && <p className="text-xs text-slate-500">GSTIN: {company.gstin}</p>}
          {company.phone && <p className="text-xs text-slate-500">Phone: {company.phone}</p>}
          {company.email && <p className="text-xs text-slate-500">Email: {company.email}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-teal-700">CERTIFICATE</h2>
          <p className="mt-1 text-xs text-slate-500">No: {certificate.certificateNumber}</p>
          <p className="text-xs text-slate-500">Date: {formatDate(certificate.certificateDate)}</p>
        </div>
      </div>

      <hr className="my-6 border-teal-700" />

      <div className="mb-6 flex justify-between text-xs text-slate-500">
        <p>
          Certificate No: <span className="font-semibold text-slate-900">{certificate.certificateNumber}</span>
        </p>
        <p>
          Date: <span className="font-semibold text-slate-900">{formatDate(certificate.certificateDate)}</span>
        </p>
      </div>
      {certificate.customer?.name && (
        <div className="mb-6 text-xs text-slate-500">
          Customer: <span className="font-semibold text-slate-900">{certificate.customer.name}</span>
        </div>
      )}

      <h3 className="mb-6 text-center text-lg font-bold text-slate-900">{subject}</h3>

      <div className="mx-auto max-w-2xl whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{body}</div>

      <div className="mt-14 text-center">
        <p className="text-xs text-slate-500">For {company.name}</p>
        {company.signature_url && <img src={company.signature_url} alt="Authorized signatory signature" className="mx-auto mt-3 h-11 w-auto max-w-[140px] object-contain" />}
        <p className={`mt-1 text-sm font-semibold text-slate-900 ${company.signature_url ? '' : 'mt-10'}`}>Authorized Signatory</p>
        {certificate.issuedBy && <p className="text-xs text-slate-500">Issued by: {certificate.issuedBy}</p>}
      </div>

      <div className="mt-12 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
        This certificate has been generated electronically by {company.name} and does not require a physical signature.
      </div>
    </div>
  );
}