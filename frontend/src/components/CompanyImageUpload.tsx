import { useRef, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/Button';
import { apiErrorMessage } from '../api/client';
import {
  removeCompanyLogo,
  removeCompanyPaymentQr,
  removeCompanySignature,
  uploadCompanyLogo,
  uploadCompanyPaymentQr,
  uploadCompanySignature,
} from '../api/companies';
import { useToast } from '../context/ToastContext';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

type CompanyImageKind = 'logo' | 'signature' | 'paymentQr';
type CompanyImageUploadResult = { logoUrl: string } | { signatureUrl: string } | { paymentQrUrl: string };
type CompanyImageRemoveResult = { logoUrl: null } | { signatureUrl: null } | { paymentQrUrl: null };

export function CompanyImageUpload({
  label,
  value,
  fileKind,
  companyId,
  hint,
  placeholder,
}: {
  label: string;
  value: string | null;
  fileKind: CompanyImageKind;
  companyId: string;
  hint: string;
  placeholder: string;
}) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation<CompanyImageUploadResult, Error, File>({
    mutationFn: (file: File) =>
      fileKind === 'logo'
        ? uploadCompanyLogo(companyId, file)
        : fileKind === 'signature'
          ? uploadCompanySignature(companyId, file)
          : uploadCompanyPaymentQr(companyId, file),
    onSuccess: async () => {
      notify(fileKind === 'logo' ? 'Logo uploaded' : fileKind === 'signature' ? 'Signature uploaded' : 'Payment QR code uploaded');
      await queryClient.invalidateQueries({ queryKey: ['company', companyId] });
    },
    onError: (err) => notify(apiErrorMessage(err, 'Upload failed'), 'error'),
  });

  const removeMutation = useMutation<CompanyImageRemoveResult, Error>({
    mutationFn: () =>
      fileKind === 'logo'
        ? removeCompanyLogo(companyId)
        : fileKind === 'signature'
          ? removeCompanySignature(companyId)
          : removeCompanyPaymentQr(companyId),
    onSuccess: async () => {
      notify(fileKind === 'logo' ? 'Logo removed' : fileKind === 'signature' ? 'Signature removed' : 'Payment QR code removed');
      await queryClient.invalidateQueries({ queryKey: ['company', companyId] });
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not remove image'), 'error'),
  });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file (PNG or JPG)', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      notify('Image must be smaller than 2MB', 'error');
      return;
    }
    uploadMutation.mutate(file);
  }

  return (
    <div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-2 flex items-center gap-3">
        {value ? (
          <img src={value} alt={label} className="h-12 w-auto max-w-[160px] rounded border border-slate-200 bg-white object-contain p-1" />
        ) : (
          <div className="flex h-12 w-32 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 px-2 text-center text-xs text-slate-400">
            {placeholder}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} loading={uploadMutation.isPending}>
            {value ? 'Change' : 'Upload'}
          </Button>
          {value && (
            <Button type="button" variant="outline" size="sm" onClick={() => removeMutation.mutate()} loading={removeMutation.isPending}>
              Remove
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}