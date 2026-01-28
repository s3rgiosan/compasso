import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { Upload as UploadIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import type { BankId } from '@compasso/shared';

interface DropzoneUploaderProps {
  banks: Array<{ id: string; name: string }>;
  selectedBank: BankId;
  onBankChange: (bank: BankId) => void;
  uploading: boolean;
  onUpload: (file: File) => void;
}

export function DropzoneUploader({
  banks,
  selectedBank,
  onBankChange,
  uploading,
  onUpload,
}: DropzoneUploaderProps) {
  const { t } = useTranslation();
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      onUpload(acceptedFiles[0]);
    },
    [onUpload]
  );

  const noBankSelected = !selectedBank;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: uploading || noBankSelected,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Bank & Upload PDF</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('upload.selectBank')}</label>
          <Select
            value={selectedBank}
            onChange={(e) => onBankChange(e.target.value as BankId)}
            options={banks.map((b) => ({ value: b.id, label: b.name }))}
            placeholder={t('upload.selectBankPlaceholder')}
            required
            className="w-full max-w-xs"
          />
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-primary'
          } ${uploading || noBankSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                <p className="text-muted-foreground">{t('upload.uploadingPDF')}</p>
              </>
            ) : (
              <>
                <UploadIcon className="h-10 w-10 text-muted-foreground" />
                <p className="text-lg font-medium">
                  {t('upload.dragDrop')}
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
