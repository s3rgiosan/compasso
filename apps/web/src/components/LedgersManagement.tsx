import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { getLedgers, deleteLedger, type LedgerItem } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { PaginatedResponse } from '@compasso/shared';

interface Bank {
  id: string;
  name: string;
}

interface LedgersManagementProps {
  workspaceId: number;
  banks?: Bank[];
  onLedgerDeleted?: () => void;
}

const PAGE_SIZE = 20;

export function LedgersManagement({
  workspaceId,
  banks = [],
  onLedgerDeleted,
}: LedgersManagementProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [ledgersData, setLedgersData] = useState<PaginatedResponse<LedgerItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<LedgerItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);

  // Filters
  const [filterBank, setFilterBank] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');

  useEffect(() => {
    loadLedgers();
  }, [workspaceId, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterBank, filterYear]);

  async function loadLedgers() {
    setLoading(true);
    try {
      const result = await getLedgers(workspaceId, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setLedgersData(result);
    } catch (err) {
      console.error('Failed to load ledgers:', err);
    } finally {
      setLoading(false);
    }
  }

  const ledgers = ledgersData?.items ?? [];
  const totalPages = ledgersData ? Math.ceil(ledgersData.total / PAGE_SIZE) : 0;

  const handleDeleteLedger = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      await deleteLedger(deleteConfirm.id);
      showToast(t('upload.ledgerDeleted'), 'success');
      setDeleteConfirm(null);
      onLedgerDeleted?.();
      await loadLedgers();
    } catch (err) {
      console.error('Failed to delete ledger:', err);
      showToast(t('upload.ledgerDeleteFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Extract unique years from ledger periods
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    ledgers.forEach((ledger) => {
      if (ledger.periodStart) {
        const year = ledger.periodStart.split('-')[0];
        if (year) years.add(year);
      }
      if (ledger.periodEnd) {
        const year = ledger.periodEnd.split('-')[0];
        if (year) years.add(year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [ledgers]);

  // Extract unique banks from ledgers
  const availableBanks = useMemo(() => {
    const bankIds = new Set<string>();
    ledgers.forEach((ledger) => {
      if (ledger.bankId) bankIds.add(ledger.bankId);
    });
    return Array.from(bankIds);
  }, [ledgers]);

  // Filter ledgers
  const filteredLedgers = useMemo(() => {
    return ledgers.filter((ledger) => {
      // Bank filter
      if (filterBank && ledger.bankId !== filterBank) {
        return false;
      }
      // Year filter (check if period overlaps with year)
      if (filterYear) {
        const startYear = ledger.periodStart?.split('-')[0];
        const endYear = ledger.periodEnd?.split('-')[0];
        if (startYear !== filterYear && endYear !== filterYear) {
          return false;
        }
      }
      return true;
    });
  }, [ledgers, filterBank, filterYear]);

  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    return bank?.name || bankId;
  };

  return (
    <>
      {/* Filters */}
      {ledgers.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Select
                value={filterBank}
                onChange={(e) => setFilterBank(e.target.value)}
                options={[
                  { value: '', label: 'All Banks' },
                  ...availableBanks.map((bankId) => ({
                    value: bankId,
                    label: getBankName(bankId),
                  })),
                ]}
                className="w-40"
              />
              <Select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                options={[
                  { value: '', label: 'All Years' },
                  ...availableYears.map((year) => ({
                    value: year,
                    label: year,
                  })),
                ]}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploads table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('upload.ledgers')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
          ) : ledgers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-muted-foreground">{t('upload.noLedgers')}</p>
            </div>
          ) : filteredLedgers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-muted-foreground">No uploads match the filters</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLedgers.map((ledger) => (
                      <TableRow key={ledger.id}>
                        <TableCell className="font-medium">{ledger.filename}</TableCell>
                        <TableCell>{getBankName(ledger.bankId)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(ledger.uploadDate)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {ledger.periodStart && ledger.periodEnd
                            ? `${ledger.periodStart} to ${ledger.periodEnd}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">{ledger.transactionCount}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(ledger)}
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
                    {Math.min((page + 1) * PAGE_SIZE, ledgersData?.total ?? 0)} of {ledgersData?.total ?? 0}
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
        onConfirm={handleDeleteLedger}
        title={t('upload.deleteLedger')}
        message={t('upload.deleteLedgerConfirm')}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
