import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ArrowUpRight, ArrowDownRight, Trash2, Repeat, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { CategorySelect } from '@/components/CategorySelect';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingPlaceholder } from '@/components/ui/LoadingPlaceholder';
import { useToast } from '@/components/ui/Toast';
import {
  getTransactions,
  getCategories,
  getAvailableYears,
  getSupportedBanks,
  updateTransaction,
  deleteTransaction,
  exportTransactionsCsv,
} from '@/services/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { TransactionWithCategory, Category, PaginatedResponse } from '@compasso/shared';

const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const;

const PAGE_SIZE = 20;

export default function Transactions() {
  const { t } = useTranslation();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { showToast } = useToast();
  const [data, setData] = useState<PaginatedResponse<TransactionWithCategory> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banks, setBanks] = useState<Array<{ id: string; name: string }>>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; description: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      if (!currentWorkspace) return;
      try {
        const [yearsData, categoriesData, banksData] = await Promise.all([
          getAvailableYears(currentWorkspace.id),
          getCategories(currentWorkspace.id, { limit: 1000 }),
          getSupportedBanks(),
        ]);
        setYears(yearsData);
        setCategories(categoriesData.items);
        setBanks(banksData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load initial data');
      }
    }
    loadInitialData();
  }, [currentWorkspace]);

  useEffect(() => {
    if (currentWorkspace) {
      loadTransactions();
    }
  }, [currentWorkspace, selectedYear, selectedMonth, selectedCategory, selectedType, search, page]);

  async function loadTransactions() {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const result = await getTransactions(currentWorkspace.id, {
        year: selectedYear,
        month: selectedMonth,
        categoryId: selectedCategory,
        isIncome: selectedType === 'all' ? undefined : selectedType === 'income',
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  const handleCategoryChange = async (transactionId: number, categoryId: number | null) => {
    if (!currentWorkspace) return;
    try {
      await updateTransaction(transactionId, currentWorkspace.id, { categoryId });
      loadTransactions();
    } catch (err) {
      console.error('Failed to update transaction:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      await deleteTransaction(deleteConfirm.id, currentWorkspace!.id);
      showToast(t('transactions.transactionDeleted'), 'success');
      setDeleteConfirm(null);
      loadTransactions();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      showToast(t('transactions.transactionDeleteFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCategoryCreated = (newCategory: Category) => {
    setCategories((prev) => [...prev, newCategory]);
  };

  const handleExport = async () => {
    if (!currentWorkspace) return;
    setExporting(true);
    try {
      await exportTransactionsCsv(currentWorkspace.id, {
        year: selectedYear,
        month: selectedMonth,
        categoryId: selectedCategory,
        isIncome: selectedType === 'all' ? undefined : selectedType === 'income',
        search: search || undefined,
      });
      showToast(t('transactions.exportSuccess'), 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast(t('transactions.exportFailed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  if (workspaceLoading || !currentWorkspace) {
    return <LoadingPlaceholder text={t('common.loadingWorkspace')} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('transactions.title')}</h1>
        <p className="text-muted-foreground">{t('transactions.subtitle')}</p>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('transactions.search')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={selectedYear?.toString() || ''}
              onChange={(e) => {
                setSelectedYear(e.target.value ? parseInt(e.target.value) : undefined);
                setPage(0);
              }}
              options={[
                { value: '', label: t('transactions.allYears') },
                ...years.map((y) => ({ value: y, label: y.toString() })),
              ]}
            />
            <Select
              value={selectedMonth?.toString() || ''}
              onChange={(e) => {
                setSelectedMonth(e.target.value ? parseInt(e.target.value) : undefined);
                setPage(0);
              }}
              options={[
                { value: '', label: t('transactions.allMonths') },
                ...MONTH_KEYS.map((key, i) => ({ value: i + 1, label: t(`months.${key}`) })),
              ]}
            />
            <Select
              value={selectedCategory?.toString() || ''}
              onChange={(e) => {
                setSelectedCategory(e.target.value ? parseInt(e.target.value) : undefined);
                setPage(0);
              }}
              options={[
                { value: '', label: t('transactions.allCategories') },
                ...[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as 'all' | 'income' | 'expense');
                setPage(0);
              }}
              options={[
                { value: 'all', label: t('transactions.allTypes') },
                { value: 'income', label: t('transactions.incomeOnly') },
                { value: 'expense', label: t('transactions.expensesOnly') },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {t('transactions.transactionCount', { count: data?.total ?? 0 })}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || !data?.total}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? t('transactions.exporting') : t('transactions.exportCsv')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingPlaceholder text={t('common.loading')} />
          ) : data?.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-muted-foreground">{t('transactions.noTransactionsFound')}</p>
              <p className="text-sm text-muted-foreground">
                {t('transactions.adjustFilters')}
              </p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>{t('transactions.date')}</TableHead>
                      <TableHead>{t('transactions.description')}</TableHead>
                      <TableHead>{t('transactions.category')}</TableHead>
                      <TableHead className="text-right">{t('transactions.amount')}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div
                            className={`p-1.5 rounded-full ${
                              tx.isIncome ? 'bg-green-100' : 'bg-red-100'
                            }`}
                          >
                            {tx.isIncome ? (
                              <ArrowUpRight className="h-3 w-3 text-green-600" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-center gap-2">
                            <span className="truncate block">{tx.description}</span>
                            {tx.recurringPatternId && (
                              <span title={t('transactions.recurringTransaction')} className="flex-shrink-0">
                                <Repeat className="h-3.5 w-3.5 text-blue-500" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <CategorySelect
                            value={tx.categoryId}
                            categories={categories}
                            workspaceId={currentWorkspace.id}
                            onChange={(categoryId) => handleCategoryChange(tx.id, categoryId)}
                            onCategoryCreated={handleCategoryCreated}
                            className="w-40"
                            transactionDescription={tx.description}
                            banks={banks}
                            defaultBankId={tx.bankId}
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
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm({ id: tx.id, description: tx.description })}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1} to{' '}
                    {Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={t('transactions.deleteTransaction')}
        message={t('transactions.deleteTransactionConfirm', { description: deleteConfirm?.description })}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
