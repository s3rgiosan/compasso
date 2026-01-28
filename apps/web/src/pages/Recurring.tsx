import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Repeat, RefreshCw, Loader2, ToggleLeft, ToggleRight, Trash2, Pencil, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingPlaceholder } from '@/components/ui/LoadingPlaceholder';
import {
  getRecurringPatterns,
  detectRecurringPatterns,
  toggleRecurringPattern,
  deleteRecurringPattern,
  getPatternTransactions,
  updateRecurringPattern,
  type RecurringPatternResponse,
} from '@/services/api';
import type { TransactionWithCategory } from '@compasso/shared';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';

type FrequencyFilter = 'all' | 'weekly' | 'monthly' | 'yearly';
type StatusFilter = 'all' | 'active' | 'inactive';

const FREQUENCY_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  weekly: 'default',
  monthly: 'secondary',
  yearly: 'outline',
};

function estimateMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return amount * 4.33;
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}

export default function Recurring() {
  const { t } = useTranslation();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { showToast } = useToast();

  const SORT_OPTIONS = [
    { value: 'newest', label: t('recurring.newestFirst') },
    { value: 'oldest', label: t('recurring.oldestFirst') },
    { value: 'amount', label: t('recurring.highestAmount') },
    { value: 'occurrences', label: t('recurring.mostOccurrences') },
    { value: 'name', label: t('recurring.nameAZ') },
  ];

  const [patterns, setPatterns] = useState<RecurringPatternResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState('newest');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<RecurringPatternResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Expand state
  const [expandedPatternId, setExpandedPatternId] = useState<number | null>(null);
  const [patternTransactions, setPatternTransactions] = useState<TransactionWithCategory[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Edit state
  const [editTarget, setEditTarget] = useState<RecurringPatternResponse | null>(null);
  const [editForm, setEditForm] = useState({ descriptionPattern: '', frequency: '', avgAmount: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPatterns() {
      if (!currentWorkspace) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getRecurringPatterns(currentWorkspace.id);
        setPatterns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recurring patterns');
      } finally {
        setLoading(false);
      }
    }
    loadPatterns();
  }, [currentWorkspace]);

  const filteredPatterns = useMemo(() => {
    let result = [...patterns];

    if (frequencyFilter !== 'all') {
      result = result.filter((p) => p.frequency === frequencyFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((p) => (statusFilter === 'active' ? p.isActive : !p.isActive));
    }

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'amount':
        result.sort((a, b) => b.avgAmount - a.avgAmount);
        break;
      case 'occurrences':
        result.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
        break;
      case 'name':
        result.sort((a, b) => a.descriptionPattern.localeCompare(b.descriptionPattern));
        break;
    }

    return result;
  }, [patterns, frequencyFilter, statusFilter, sortBy]);

  const summaryStats = useMemo(() => {
    const total = patterns.length;
    const active = patterns.filter((p) => p.isActive).length;
    const inactive = total - active;
    const estimatedMonthlyCost = patterns
      .filter((p) => p.isActive)
      .reduce((sum, p) => sum + estimateMonthlyAmount(p.avgAmount, p.frequency), 0);

    return { total, active, inactive, estimatedMonthlyCost };
  }, [patterns]);

  const handleDetect = async () => {
    if (!currentWorkspace) return;
    setDetecting(true);
    setError(null);
    try {
      const result = await detectRecurringPatterns(currentWorkspace.id);
      const data = await getRecurringPatterns(currentWorkspace.id);
      setPatterns(data);
      showToast(t('recurring.detectedPatterns', { count: result.detected }), 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect patterns');
    } finally {
      setDetecting(false);
    }
  };

  const handleToggle = async (pattern: RecurringPatternResponse) => {
    const newIsActive = !pattern.isActive;
    setTogglingId(pattern.id);

    // Optimistic update
    setPatterns((prev) =>
      prev.map((p) => (p.id === pattern.id ? { ...p, isActive: newIsActive } : p))
    );

    try {
      await toggleRecurringPattern(pattern.id, currentWorkspace!.id, newIsActive);
      showToast(
        `${pattern.descriptionPattern} ${newIsActive ? t('common.active').toLowerCase() : t('common.inactive').toLowerCase()}`,
        'success'
      );
    } catch (err) {
      // Revert on error
      setPatterns((prev) =>
        prev.map((p) => (p.id === pattern.id ? { ...p, isActive: !newIsActive } : p))
      );
      showToast(t('recurring.failedToUpdate'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRecurringPattern(deleteTarget.id, currentWorkspace!.id);
      setPatterns((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      showToast(`Pattern "${deleteTarget.descriptionPattern}" deleted`, 'success');
      if (expandedPatternId === deleteTarget.id) {
        setExpandedPatternId(null);
        setPatternTransactions([]);
      }
    } catch (err) {
      showToast(t('recurring.failedToDelete'), 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleExpandToggle = async (pattern: RecurringPatternResponse) => {
    if (expandedPatternId === pattern.id) {
      setExpandedPatternId(null);
      setPatternTransactions([]);
      return;
    }

    if (!currentWorkspace) return;
    setExpandedPatternId(pattern.id);
    setLoadingTransactions(true);
    setPatternTransactions([]);
    try {
      const txs = await getPatternTransactions(pattern.id, currentWorkspace.id);
      setPatternTransactions(txs);
    } catch (err) {
      showToast(t('recurring.failedToLoadTransactions'), 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleEditOpen = (pattern: RecurringPatternResponse) => {
    setEditTarget(pattern);
    setEditForm({
      descriptionPattern: pattern.descriptionPattern,
      frequency: pattern.frequency,
      avgAmount: String(pattern.avgAmount),
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setSaving(true);

    const data: Record<string, unknown> = {};
    if (editForm.descriptionPattern !== editTarget.descriptionPattern) {
      data.descriptionPattern = editForm.descriptionPattern;
    }
    if (editForm.frequency !== editTarget.frequency) {
      data.frequency = editForm.frequency;
    }
    const newAmount = parseFloat(editForm.avgAmount);
    if (!isNaN(newAmount) && newAmount !== editTarget.avgAmount) {
      data.avgAmount = newAmount;
    }

    if (Object.keys(data).length === 0) {
      setEditTarget(null);
      setSaving(false);
      return;
    }

    try {
      await updateRecurringPattern(editTarget.id, currentWorkspace!.id, data);
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === editTarget.id
            ? {
                ...p,
                descriptionPattern: editForm.descriptionPattern,
                frequency: editForm.frequency,
                avgAmount: parseFloat(editForm.avgAmount) || p.avgAmount,
              }
            : p
        )
      );
      showToast(t('recurring.patternUpdated'), 'success');
      setEditTarget(null);
    } catch (err) {
      showToast(t('recurring.failedToUpdate'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (workspaceLoading || !currentWorkspace) {
    return <LoadingPlaceholder text={t('common.loadingWorkspace')} />;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('recurring.title')}</h1>
          <p className="text-muted-foreground">{t('recurring.subtitle')}</p>
        </div>
        <Button onClick={handleDetect} disabled={detecting}>
          <RefreshCw className={`h-4 w-4 mr-2 ${detecting ? 'animate-spin' : ''}`} />
          {detecting ? t('recurring.detecting') : t('recurring.detectPatterns')}
        </Button>
      </div>

      {/* Error banner */}
      {error && <ErrorAlert message={error} />}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('recurring.totalPatterns')}</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {t('recurring.activeSummary', { active: summaryStats.active, inactive: summaryStats.inactive })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('recurring.activePatterns')}</CardTitle>
            <ToggleRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summaryStats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('recurring.estMonthlyCost')}</CardTitle>
            <Repeat className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summaryStats.estimatedMonthlyCost)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value as FrequencyFilter)}
              options={[
                { value: 'all', label: t('recurring.allFrequencies') },
                { value: 'weekly', label: t('recurring.weekly') },
                { value: 'monthly', label: t('recurring.monthly') },
                { value: 'yearly', label: t('recurring.yearly') },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[
                { value: 'all', label: t('recurring.allStatuses') },
                { value: 'active', label: t('common.active') },
                { value: 'inactive', label: t('common.inactive') },
              ]}
            />
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              options={SORT_OPTIONS}
            />
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('recurring.deletePattern')}
        message={t('recurring.deletePatternConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        loading={deleting}
      />

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={t('recurring.editPattern')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('recurring.descriptionPattern')}
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={editForm.descriptionPattern}
              onChange={(e) => setEditForm((f) => ({ ...f, descriptionPattern: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('recurring.frequency')}</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={editForm.frequency}
              onChange={(e) => setEditForm((f) => ({ ...f, frequency: e.target.value }))}
            >
              <option value="weekly">{t('recurring.weekly')}</option>
              <option value="monthly">{t('recurring.monthly')}</option>
              <option value="yearly">{t('recurring.yearly')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('recurring.avgAmount')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={editForm.avgAmount}
              onChange={(e) => setEditForm((f) => ({ ...f, avgAmount: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Patterns table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('recurring.patternCount', { count: filteredPatterns.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : patterns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Repeat className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-muted-foreground">{t('recurring.noPatterns')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('recurring.clickDetect')}
                </p>
              </div>
              <Button onClick={handleDetect} disabled={detecting}>
                <RefreshCw className={`h-4 w-4 mr-2 ${detecting ? 'animate-spin' : ''}`} />
                {detecting ? t('recurring.detecting') : t('recurring.detectPatterns')}
              </Button>
            </div>
          ) : filteredPatterns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <p className="text-muted-foreground">{t('recurring.noMatchingPatterns')}</p>
              <p className="text-sm text-muted-foreground">
                {t('recurring.adjustFilters')}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('transactions.description')}</TableHead>
                    <TableHead>{t('recurring.frequency')}</TableHead>
                    <TableHead className="text-right">{t('recurring.avgAmount')}</TableHead>
                    <TableHead className="text-right">{t('recurring.occurrences')}</TableHead>
                    <TableHead>{t('recurring.status')}</TableHead>
                    <TableHead>{t('recurring.created')}</TableHead>
                    <TableHead className="text-right">{t('recurring.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatterns.map((pattern) => (
                    <>
                      <TableRow key={pattern.id}>
                        <TableCell className="max-w-xs">
                          <button
                            className="flex items-center gap-2 text-left w-full"
                            onClick={() => handleExpandToggle(pattern)}
                          >
                            {expandedPatternId === pattern.id ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <Repeat className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <span className="truncate block">{pattern.descriptionPattern}</span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={FREQUENCY_BADGE_VARIANT[pattern.frequency] || 'default'}>
                            {pattern.frequency.charAt(0).toUpperCase() + pattern.frequency.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(pattern.avgAmount)}
                        </TableCell>
                        <TableCell className="text-right">{pattern.occurrenceCount}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggle(pattern)}
                            disabled={togglingId === pattern.id}
                            className={`gap-1.5 ${pattern.isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'}`}
                          >
                            {pattern.isActive ? (
                              <ToggleRight className="h-5 w-5" />
                            ) : (
                              <ToggleLeft className="h-5 w-5" />
                            )}
                            {pattern.isActive ? t('common.active') : t('common.inactive')}
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(pattern.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditOpen(pattern)}
                              className="text-gray-500 hover:text-blue-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(pattern)}
                              className="text-gray-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedPatternId === pattern.id && (
                        <TableRow key={`${pattern.id}-expand`}>
                          <TableCell colSpan={7} className="bg-gray-50 p-0">
                            <div className="px-6 py-3">
                              {loadingTransactions ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                              ) : patternTransactions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  {t('recurring.noLinkedTransactions')}
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {patternTransactions.map((tx) => (
                                    <div
                                      key={tx.id}
                                      className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground whitespace-nowrap">
                                          {formatDate(tx.date)}
                                        </span>
                                        <span className="truncate max-w-xs">{tx.description}</span>
                                        {tx.category && (
                                          <Badge
                                            variant="secondary"
                                            style={{
                                              backgroundColor: tx.category.color
                                                ? `${tx.category.color}20`
                                                : undefined,
                                              color: tx.category.color || undefined,
                                            }}
                                          >
                                            {tx.category.name}
                                          </Badge>
                                        )}
                                      </div>
                                      <span
                                        className={`font-medium whitespace-nowrap ${
                                          tx.isIncome ? 'text-green-600' : 'text-red-600'
                                        }`}
                                      >
                                        {tx.isIncome ? '+' : '-'}
                                        {formatCurrency(tx.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
