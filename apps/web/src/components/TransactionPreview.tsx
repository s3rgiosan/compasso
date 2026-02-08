import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CategorySelect } from '@/components/CategorySelect';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Category, BankId, UploadResponse, ParsedTransaction } from '@compasso/shared';

interface TransactionWithSelection extends ParsedTransaction {
  selected: boolean;
  categoryId: number | null;
}

const PAGE_SIZE = 20;

interface TransactionPreviewProps {
  uploadResult: UploadResponse;
  transactions: TransactionWithSelection[];
  categories: Category[];
  banks: Array<{ id: string; name: string }>;
  selectedBank: BankId;
  workspaceId: number;
  confirming: boolean;
  allDescriptions: string[];
  onTransactionsChange: (updater: (prev: TransactionWithSelection[]) => TransactionWithSelection[]) => void;
  onCategoryChange: (index: number, categoryId: number | null) => void;
  onCategoryCreated: (category: Category) => void;
  onConfirm: () => void;
  onReset: () => void;
}

export function TransactionPreview({
  uploadResult,
  transactions,
  categories,
  banks,
  selectedBank,
  workspaceId,
  confirming,
  allDescriptions,
  onTransactionsChange,
  onCategoryChange,
  onCategoryCreated,
  onConfirm,
  onReset,
}: TransactionPreviewProps) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
  const paginatedTransactions = transactions.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  const getActualIndex = (pageIndex: number) => currentPage * PAGE_SIZE + pageIndex;
  const selectedCount = transactions.filter((tx) => tx.selected).length;

  const handleToggleSelect = (index: number) => {
    onTransactionsChange((prev) =>
      prev.map((tx, i) => (i === index ? { ...tx, selected: !tx.selected } : tx))
    );
  };

  const handleSelectAll = () => {
    const allSelected = transactions.every((tx) => tx.selected);
    onTransactionsChange((prev) => prev.map((tx) => ({ ...tx, selected: !allSelected })));
  };

  return (
    <>
      {/* Upload info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{uploadResult.filename}</p>
                <p className="text-sm text-muted-foreground">
                  {t('upload.transactionsParsed', { count: uploadResult.transactionCount, bank: '' })}
                  {uploadResult.periodStart && uploadResult.periodEnd && (
                    <> ({uploadResult.periodStart} to {uploadResult.periodEnd})</>
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onReset}>
              {t('upload.uploadAnother')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction review */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('upload.reviewTransactions')}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t('upload.selectedCount', { selected: selectedCount, total: transactions.length })}
            </span>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {transactions.every((tx) => tx.selected) ? t('upload.deselectAll') : t('upload.selectAll')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((tx, pageIndex) => {
                  const actualIndex = getActualIndex(pageIndex);
                  return (
                    <TableRow key={actualIndex} className={!tx.selected ? 'opacity-50' : ''}>
                      <TableCell>
                        <button
                          onClick={() => handleToggleSelect(actualIndex)}
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            tx.selected
                              ? 'bg-primary border-primary text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {tx.selected && <Check className="h-3 w-3" />}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(tx.date)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                      <TableCell>
                        <CategorySelect
                          value={tx.categoryId}
                          categories={categories}
                          workspaceId={workspaceId}
                          onChange={(categoryId) => onCategoryChange(actualIndex, categoryId)}
                          onCategoryCreated={onCategoryCreated}
                          className="w-40"
                          transactionDescription={tx.description}
                          banks={banks}
                          defaultBankId={selectedBank}
                          allDescriptions={allDescriptions}
                          onPatternApply={(categoryId, matchingIndices) => {
                            onTransactionsChange((prev) =>
                              prev.map((t, i) =>
                                matchingIndices.includes(i) ? { ...t, categoryId } : t
                              )
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            tx.isIncome ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {tx.isIncome ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {currentPage * PAGE_SIZE + 1} to{' '}
                {Math.min((currentPage + 1) * PAGE_SIZE, transactions.length)} of{' '}
                {transactions.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onReset}>
              {t('upload.uploadAnother')}
            </Button>
            <Button onClick={onConfirm} disabled={confirming || selectedCount === 0}>
              {confirming ? t('upload.confirming') : t('upload.confirm')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
