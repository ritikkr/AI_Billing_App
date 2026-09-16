import { useState } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { getCertificate, deleteCertificate, cancelCertificate, issueCertificate } from '../../api/certificates';
import { apiErrorMessage } from '../../api/client';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { formatDate } from '../../utils/format';
import { resolveTemplate } from '../../components/certificates/TemplateEditor';
import { CertificatePreviewModal } from '../../components/print/CertificatePreviewModal';

export default function CertificateDetail() {
  const { id } = useParams();
  const { companyId, canEdit } = useCompany();
  const { notify } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: certificate, isLoading } = useQuery({
    queryKey: ['certificate', companyId, id],
    queryFn: () => getCertificate(companyId!, id!),
    enabled: !!companyId && !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['certificate', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['certificates', companyId] });
  };

  const issueMutation = useMutation({
    mutationFn: () => issueCertificate(companyId!, id!),
    onSuccess: () => {
      invalidate();
      notify('Certificate issued');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not issue certificate'), 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelCertificate(companyId!, id!),
    onSuccess: () => {
      invalidate();
      notify('Certificate cancelled');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not cancel certificate'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCertificate(companyId!, id!),
    onSuccess: () => {
      notify('Certificate deleted');
      navigate('/certificates');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not delete certificate'), 'error'),
  });

  if (isLoading) return <PageLoader />;
  if (!certificate) return <Navigate to="/certificates" replace />;

  const values: Record<string, string> = {
    company_name: certificate.company?.name || '',
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/certificates" className="text-sm text-slate-400 hover:text-slate-600">
              Certificates
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-900">{certificate.certificateNumber}</h1>
            <StatusBadge status={certificate.status} />
          </div>
          <p className="text-sm text-slate-500">
            {certificate.outletName || certificate.customer?.name || '-'} · {formatDate(certificate.certificateDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print / Download
          </Button>
          {canEdit && certificate.status === 'draft' && (
            <>
              <Link to={`/certificates/${certificate.id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
              <Button loading={issueMutation.isPending} onClick={() => confirm('Issue this certificate? It will be locked for editing.') && issueMutation.mutate()}>
                Issue
              </Button>
              <Button variant="danger" loading={deleteMutation.isPending} onClick={() => confirm('Delete this draft certificate?') && deleteMutation.mutate()}>
                Delete
              </Button>
            </>
          )}
          {canEdit && certificate.status !== 'cancelled' && (
            <Button variant="danger" loading={cancelMutation.isPending} onClick={() => confirm('Cancel this certificate? This cannot be undone.') && cancelMutation.mutate()}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader title="Certificate preview" subtitle={certificate.template?.name || 'No template'} />
        <CardBody>
          <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-8">
            <h3 className="text-center text-xl font-semibold text-slate-900">{certificate.template?.subject || 'Service Completion Certificate'}</h3>
            <div className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {resolveTemplate(certificate.template?.body || '', values)}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Certificate date" value={formatDate(certificate.certificateDate)} />
          <Detail label="Service date" value={formatDate(certificate.serviceDate)} />
          <Detail label="Service type" value={certificate.serviceType || '-'} />
          <Detail label="Outlet" value={certificate.outletName || '-'} />
          <Detail label="Outlet address" value={certificate.outletAddress || '-'} />
          <Detail label="Valid from" value={formatDate(certificate.validFrom)} />
          <Detail label="Valid until" value={formatDate(certificate.validUntil)} />
          <Detail label="Customer" value={certificate.customer?.name || '-'} />
          {certificate.notes && <Detail label="Notes" value={certificate.notes} className="lg:col-span-2" />}
          {certificate.issuedBy && <Detail label="Issued by" value={certificate.issuedBy} />}
        </CardBody>
      </Card>

      {previewOpen && (
        <CertificatePreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} certificate={certificate} />
      )}
    </div>
  );
}

function Detail({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}