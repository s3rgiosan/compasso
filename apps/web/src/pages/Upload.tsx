import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { DropzoneUploader } from '@/components/DropzoneUploader';
import { TransactionPreview } from '@/components/TransactionPreview';
import { LedgersManagement } from '@/components/LedgersManagement';
import { PatternModal } from '@/components/PatternModal';
import {
  uploadPDF,
  confirmTransactions,
  getCategories,
  getSupportedBanks,
  createQuickPattern,
} from '@/services/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { ParsedTransaction, Category, BankId, UploadResponse } from '@compasso/shared';

interface TransactionWithSelection extends ParsedTransaction {
  selected: boolean;
  categoryId: number | null;
}

export default function Upload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [banks, setBanks] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBank, setSelectedBank] = useState<BankId>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithSelection[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pattern modal state
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [patternTransaction, setPatternTransaction] = useState<{
    index: number;
    categoryId: number;
    categoryName: string;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!currentWorkspace) return;
      try {
        const [banksData, categoriesData] = await Promise.all([
          getSupportedBanks(),
          getCategories(currentWorkspace.id, { limit: 1000 }),
        ]);
        setBanks(banksData);
        setCategories(categoriesData.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load initial data');
      }
    }
    loadData();
  }, [currentWorkspace]);

  const allDescriptions = useMemo(
    () => transactions.map((tx) => tx.description),
    [transactions]
  );

  const handleUpload = async (file: File) => {
    if (!currentWorkspace) return;
    if (!selectedBank) {
      setError(t('upload.selectBankFirst'));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadPDF(file, currentWorkspace.id, selectedBank);
      setUploadResult(result);

      setTransactions(
        result.transactions.map((tx) => ({
          ...tx,
          selected: true,
          categoryId: tx.suggestedCategoryId,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleCategoryChange = (index: number, categoryId: number | null) => {
    setTransactions((prev) =>
      prev.map((tx, i) => (i === index ? { ...tx, categoryId } : tx))
    );

    if (categoryId !== null) {
      const category = categories.find((c) => c.id === categoryId);
      if (category) {
        setPatternTransaction({
          index,
          categoryId,
          categoryName: category.name,
        });
        setShowPatternModal(true);
      }
    }
  };

  const handlePatternSave = async (pattern: string, applyToAll: boolean) => {
    if (!patternTransaction || !currentWorkspace) return;

    const { categoryId } = patternTransaction;

    try {
      const matchingIndices: number[] = [];
      if (applyToAll && pattern) {
        const upperPattern = pattern.toUpperCase();
        transactions.forEach((tx, i) => {
          if (tx.description.toUpperCase().includes(upperPattern)) {
            matchingIndices.push(i);
          }
        });
      }

      if (matchingIndices.length > 0) {
        setTransactions((prev) =>
          prev.map((tx, i) =>
            matchingIndices.includes(i) ? { ...tx, categoryId } : tx
          )
        );
      }

      await createQuickPattern(categoryId, {
        pattern,
        bankId: selectedBank,
        workspaceId: currentWorkspace.id,
        transactionIndices: matchingIndices,
      });
    } catch (err) {
      console.error('Failed to save pattern:', err);
    }

    setPatternTransaction(null);
  };

  const handleConfirm = async () => {
    if (!uploadResult) return;

    const selectedTransactions = transactions.filter((tx) => tx.selected);
    if (selectedTransactions.length === 0) {
      setError(t('upload.selectAtLeastOne'));
      return;
    }

    setConfirming(true);
    setError(null);

    try {
      await confirmTransactions({
        ledgerId: uploadResult.ledgerId,
        transactions: selectedTransactions.map((tx) => ({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          balance: tx.balance,
          isIncome: tx.isIncome,
          categoryId: tx.categoryId,
          rawText: tx.rawText,
        })),
      });

      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm transactions');
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setUploadResult(null);
    setTransactions([]);
    setError(null);
  };

  if (workspaceLoading || !currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('common.loadingWorkspace')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('upload.title')}</h1>
        <p className="text-muted-foreground">
          {t('upload.subtitle')}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {!uploadResult ? (
        <DropzoneUploader
          banks={banks}
          selectedBank={selectedBank}
          onBankChange={setSelectedBank}
          uploading={uploading}
          onUpload={handleUpload}
        />
      ) : (
        <TransactionPreview
          uploadResult={uploadResult}
          transactions={transactions}
          categories={categories}
          banks={banks}
          selectedBank={selectedBank}
          workspaceId={currentWorkspace.id}
          confirming={confirming}
          allDescriptions={allDescriptions}
          onTransactionsChange={setTransactions}
          onCategoryChange={handleCategoryChange}
          onCategoryCreated={(newCat) => setCategories((prev) => [...prev, newCat])}
          onConfirm={handleConfirm}
          onReset={handleReset}
        />
      )}

      <LedgersManagement workspaceId={currentWorkspace.id} banks={banks} />

      <PatternModal
        open={showPatternModal}
        onClose={() => {
          setShowPatternModal(false);
          setPatternTransaction(null);
        }}
        onSave={handlePatternSave}
        transaction={
          patternTransaction
            ? transactions[patternTransaction.index]
            : null
        }
        categoryName={patternTransaction?.categoryName || ''}
        allDescriptions={allDescriptions}
      />
    </div>
  );
}
