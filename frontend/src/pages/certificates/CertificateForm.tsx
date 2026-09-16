import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { listCustomers } from '../../api/customers';
import { getCompany } from '../../api/companies';
import {
  createCertificate,
  getCertificate,
  updateCertificate,
  issueCertificate,
  listCertificateTemplates,
  getNextCertificateNumber,
} from '../../api/certificates';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { TemplateEditor, resolveTemplate } from '../../components/certificates/TemplateEditor';
import { PageLoader } from '../../components/ui/Spinner';
import { todayIso } from '../../utils/format';

interface CustomField {
  key: string;
  value: string;
}

const STANDARD_FIELDS = ['company_name', 'outlet_name', 'outlet_address', 'service_date', 'service_type', 'valid_from', 'valid_until', 'certificate_date', 'certificate_number', 'customer_name'];

export default function CertificateForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { companyId, canEdit } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({ queryKey: ['customers', companyId, ''], queryFn: () => listCustomers(companyId!), enabled: !!companyId });
  const { data: company } = useQuery({ queryKey: ['company', companyId], queryFn: () => getCompany(companyId!), enabled: !!companyId });
  const { data: templates } = useQuery({ queryKey: ['certificate-templates', companyId], queryFn: () => listCertificateTemplates(companyId!), enabled: !!companyId });
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['certificate', companyId, id],
    queryFn: () => getCertificate(companyId!, id!),
    enabled: !!companyId && isEdit,
  });

  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [certificateDate, setCertificateDate] = useState(todayIso());
  const [customerId, setCustomerId] = useState('');
  const [outletName, setOutletName] = useState('');
  const [outletAddress, setOutletAddress] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [notes, setNotes] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [previewNumber, setPreviewNumber] = useState('');
  const [error, setError] = useState('');

  const selectedTemplate = templates?.find((t) => t.id === templateId);

  // Load the default (is_default) template first for new certificates
  useEffect(() => {
    if (!isEdit && templates && templates.length > 0 && !templateId) {
      const def = templates.find((t) => t.isDefault) || templates[0];
      setTemplateId(def.id);
      setSubject(def.subject);
      setBody(def.body);
    }
  }, [templates, isEdit, templateId]);

  useEffect(() => {
    if (isEdit && existing) {
      setTemplateId(existing.templateId || '');
      setCertificateDate(existing.certificateDate);
      setCustomerId(existing.customerId || '');
      setOutletName(existing.outletName || '');
      setOutletAddress(existing.outletAddress || '');
      setServiceDate(existing.serviceDate || '');
      setServiceType(existing.serviceType || '');
      setValidFrom(existing.validFrom || '');
      setValidUntil(existing.validUntil || '');
      setCustomFields(
        existing.customFields
          ? Object.entries(existing.customFields).map(([key, value]) => ({ key, value }))
          : []
      );
      setNotes(existing.notes || '');
      setIssuedBy(existing.issuedBy || '');
      if (existing.template) {
        setSubject(existing.template.subject);
        setBody(existing.template.body);
      }
    }
  }, [isEdit, existing]);

  // Preview the next certificate number for new certs
  useEffect(() => {
    if (!isEdit && certificateDate) {
      getNextCertificateNumber(companyId!, certificateDate)
        .then((n) => setPreviewNumber(n.certificateNumber))
        .catch(() => {});
    }
  }, [isEdit, companyId, certificateDate]);

  useEffect(() => {
    if (selectedTemplate && !subject && !body) {
      setSubject(selectedTemplate.subject);
      setBody(selectedTemplate.body);
    }
  }, [selectedTemplate, subject, body]);

  function selectTemplate(eid: string) {
    const t = templates?.find((x) => x.id === eid);
    setTemplateId(eid);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  function addCustomField() {
    setCustomFields((fs) => [...fs, { key: '', value: '' }]);
  }
  function updateCustomField(idx: number, patch: Partial<CustomField>) {
    setCustomFields((fs) => fs.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function removeCustomField(idx: number) {
    setCustomFields((fs) => fs.filter((_, i) => i !== idx));
  }

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  const previewValues = useMemo(() => {
    const values: Record<string, string> = {
      company_name: company?.name || '',
      outlet_name: outletName,
      outlet_address: outletAddress,
      service_date: serviceDate,
      service_type: serviceType,
      valid_from: validFrom,
      valid_until: validUntil,
      certificate_date: certificateDate,
      certificate_number: isEdit ? existing?.certificateNumber || '' : previewNumber,
      customer_name: selectedCustomer?.name || '',
    };
    for (const f of customFields) {
      if (f.key.trim()) values[f.key.trim()] = f.value;
    }
    return values;
  }, [company, outletName, outletAddress, serviceDate, serviceType, validFrom, validUntil, certificateDate, isEdit, existing, previewNumber, selectedCustomer, customFields]);

  const customFieldsObject = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const f of customFields) {
      if (f.key.trim()) obj[f.key.trim()] = f.value;
    }
    return obj;
  }, [customFields]);

  function buildPayload() {
    return {
      templateId: templateId || null,
      certificateDate,
      customerId: customerId || null,
      outletName: outletName || null,
      outletAddress: outletAddress || null,
      serviceDate: serviceDate || null,
      serviceType: serviceType || null,
      validFrom: validFrom || null,
      validUntil: validUntil || null,
      customFields: Object.keys(customFieldsObject).length > 0 ? customFieldsObject : undefined,
      notes: notes || null,
      issuedBy: issuedBy || null,
    };
  }

  const mutation = useMutation({
    mutationFn: () => (isEdit ? updateCertificate(companyId!, id!, buildPayload()) : createCertificate(companyId!, buildPayload())),
    onSuccess: (cert) => {
      queryClient.invalidateQueries({ queryKey: ['certificates', companyId] });
      notify(isEdit ? 'Certificate updated' : `Certificate ${cert.certificateNumber} created`);
      navigate(`/certificates/${cert.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save certificate')),
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await updateCertificate(companyId!, id!, buildPayload());
        return issueCertificate(companyId!, id!);
      }
      const cert = await createCertificate(companyId!, buildPayload());
      return issueCertificate(companyId!, cert.id);
    },
    onSuccess: (cert) => {
      queryClient.invalidateQueries({ queryKey: ['certificates', companyId] });
      notify('Certificate issued');
      navigate(`/certificates/${cert.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save certificate')),
  });

  function validate(): string | null {
    if (!templateId) return 'Please select a template';
    if (!body.trim()) return 'Certificate body cannot be empty';
    if (!certificateDate) return 'Please select a certificate date';
    const unknown = [...new Set(body.match(/\{\{\s*(\w+)\s*\}\}/g)?.map((m) => m.match(/\{\{\s*(\w+)\s*\}\}/)?.[1]) || [])].filter(
      (k) => !STANDARD_FIELDS.includes(k!) && !customFieldsObject[k!]
    );
    if (unknown.length > 0) {
      return `Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Add them as custom fields or remove them.`;
    }
    return null;
  }

  function handleSave(asDraft: boolean) {
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (asDraft) mutation.mutate();
    else issueMutation.mutate();
  }

  if (isEdit && loadingExisting) return <PageLoader />;
  const readOnly = isEdit && existing?.status !== 'draft';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/certificates" className="text-sm text-slate-400 hover:text-slate-600">
          Certificates
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-semibold text-slate-900">
          {isEdit ? `Edit ${existing?.certificateNumber}` : 'New Certificate'}
        </h1>
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {readOnly && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Issued certificates are locked for editing.
        </div>
      )}

      <Card>
        <CardHeader title="Certificate details" subtitle="Since certificates are read-only after issue, review everything carefully." />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Template"
              value={templateId}
              onChange={(e) => selectTemplate(e.target.value)}
              hint="Choose a certificate template; its subject & body will load below."
              disabled={readOnly}
            >
              <option value="">Select a template</option>
              {(templates || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.isDefault ? ' (Default)' : ''}
                </option>
              ))}
            </Select>
            <Input label="Certificate number" value={isEdit ? existing?.certificateNumber || '' : previewNumber} readOnly hint="Auto-generated" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Certificate date" type="date" required value={certificateDate} onChange={(e) => setCertificateDate(e.target.value)} disabled={!!isEdit || readOnly} />
            <Input label="Service date" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} disabled={readOnly} />
            <Input label="Service type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="e.g. Pest Control" disabled={readOnly} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Outlet & customer" subtitle="Who the certificate is for" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SearchableSelect
            label="Customer (optional)"
            value={customerId}
            onChange={setCustomerId}
            placeholder="Search by name, GSTIN or email…"
            emptyMessage="No customers found"
            options={(customers || []).map((c) => ({
              value: c.id,
              label: c.name,
              searchText: `${c.gstin || ''} ${c.email || ''}`,
              hint: c.gstin ? `GSTIN: ${c.gstin}` : 'Unregistered (B2C)',
            }))}
          />
          <Input label="Outlet / establishment name" value={outletName} onChange={(e) => setOutletName(e.target.value)} placeholder="e.g. GreenMart Superstore" disabled={readOnly} />
          <div className="sm:col-span-2">
            <Textarea label="Outlet / establishment address" rows={2} value={outletAddress} onChange={(e) => setOutletAddress(e.target.value)} placeholder="Outlet address where the service was performed" disabled={readOnly} />
          </div>
          <Input label="Validity from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={readOnly} />
          <Input label="Validity until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} disabled={readOnly} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Template" subtitle="Edit the subject & body. Use placeholders for auto-filled values." />
        <CardBody>
          <TemplateEditor
            subject={subject}
            onSubjectChange={setSubject}
            body={body}
            onBodyChange={setBody}
            previewValues={previewValues}
            showPreview={false}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Custom fields" subtitle="Extra placeholders you want to fill into the template body." />
        <CardBody className="space-y-3">
          {customFields.length === 0 && <p className="text-sm text-slate-500">No custom fields. Add one to use custom placeholders in the body.</p>}
          {customFields.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Placeholder key (e.g. technician_name)"
                value={f.key}
                onChange={(e) => updateCustomField(idx, { key: e.target.value })}
                className="max-w-[280px]"
                disabled={readOnly}
              />
              <Input
                placeholder="Value"
                value={f.value}
                onChange={(e) => updateCustomField(idx, { value: e.target.value })}
                className="flex-1"
                disabled={readOnly}
              />
              <button type="button" onClick={() => removeCustomField(idx)} className="shrink-0 text-slate-400 hover:text-red-600" aria-label="Remove custom field">
                ✕
              </button>
            </div>
          ))}
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
              + Add custom field
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Preview" subtitle="How the certificate will appear with the current values." />
        <CardBody>
          <div className="rounded-lg border border-slate-200 p-6">
            <h3 className="text-center text-lg font-semibold text-slate-900">{subject}</h3>
            <div className="mx-auto mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {resolveTemplate(body, previewValues)}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notes & signatory" />
        <CardBody className="space-y-4">
          <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes (not printed)" disabled={readOnly} />
          <Textarea label="Issued by" rows={1} value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="Name of the person issuing this certificate" disabled={readOnly} />
        </CardBody>
      </Card>

      {canEdit && (
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-1 py-3 backdrop-blur">
          {!readOnly && (
            <>
              <Button variant="outline" onClick={() => handleSave(true)} loading={mutation.isPending} disabled={issueMutation.isPending}>
                Save as draft
              </Button>
              <Button onClick={() => handleSave(false)} loading={issueMutation.isPending}>
                {isEdit ? 'Save & Issue' : 'Create & Issue'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}