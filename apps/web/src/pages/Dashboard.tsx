import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingPlaceholder } from '@/components/ui/LoadingPlaceholder';
import { getDashboard, getAvailableYears, getRecurringPatterns, detectRecurringPatterns, type RecurringPatternResponse } from '@/services/api';
import { formatCurrency, formatDate, formatMonth } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { DashboardData } from '@compasso/shared';

export default function Dashboard() {
  const { t } = useTranslation();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [data, setData] = useState<DashboardData | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recurringPatterns, setRecurringPatterns] = useState<RecurringPatternResponse[]>([]);
  const [detectingPatterns, setDetectingPatterns] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      if (!currentWorkspace) return;
      try {
        const yearsData = await getAvailableYears(currentWorkspace.id);
        setYears(yearsData);
        if (yearsData.length > 0) {
          setSelectedYear(yearsData[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load initial data');
      }
    }
    loadInitialData();
  }, [currentWorkspace]);

  useEffect(() => {
    async function loadDashboard() {
      if (!currentWorkspace) return;
      setLoading(true);
      setError(null);
      try {
        const dashboardData = await getDashboard(currentWorkspace.id, {
          year: selectedYear,
          month: selectedMonth,
        });
        setData(dashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [currentWorkspace, selectedYear, selectedMonth]);

  useEffect(() => {
    async function loadRecurringPatterns() {
      if (!currentWorkspace) return;
      try {
        const patterns = await getRecurringPatterns(currentWorkspace.id);
        setRecurringPatterns(patterns);
      } catch (err) {
        console.error('Failed to load recurring patterns:', err);
        // Non-critical: don't set page error for recurring patterns
      }
    }
    loadRecurringPatterns();
  }, [currentWorkspace]);

  const handleDetectPatterns = async () => {
    if (!currentWorkspace) return;
    setDetectingPatterns(true);
    try {
      await detectRecurringPatterns(currentWorkspace.id);
      const patterns = await getRecurringPatterns(currentWorkspace.id);
      setRecurringPatterns(patterns);
    } catch (err) {
      console.error('Failed to detect patterns:', err);
    } finally {
      setDetectingPatterns(false);
    }
  };

  if (workspaceLoading) {
    return <LoadingPlaceholder text={t('common.loadingWorkspace')} />;
  }

  if (loading && !data) {
    return <LoadingPlaceholder text={t('common.loading')} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <ErrorAlert message={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">{t('dashboard.noDataYet')}</p>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.uploadToStart')}
        </p>
      </div>
    );
  }

  const { summary, categoryBreakdown, monthlyTrends, recentTransactions, recurringSummary } = data;

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedYear?.toString() || ''}
            onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : undefined)}
            options={[
              { value: '', label: t('dashboard.allYears') },
              ...years.map((y) => ({ value: y, label: y.toString() })),
            ]}
            className="w-32"
          />
          <Select
            value={selectedMonth?.toString() || ''}
            onChange={(e) =>
              setSelectedMonth(e.target.value ? parseInt(e.target.value) : undefined)
            }
            options={[
              { value: '', label: t('dashboard.allMonths') },
              { value: 1, label: t('months.january') },
              { value: 2, label: t('months.february') },
              { value: 3, label: t('months.march') },
              { value: 4, label: t('months.april') },
              { value: 5, label: t('months.may') },
              { value: 6, label: t('months.june') },
              { value: 7, label: t('months.july') },
              { value: 8, label: t('months.august') },
              { value: 9, label: t('months.september') },
              { value: 10, label: t('months.october') },
              { value: 11, label: t('months.november') },
              { value: 12, label: t('months.december') },
            ]}
            className="w-36"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${recurringSummary.totalActive > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalIncome')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalExpenses')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.netBalance')}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                summary.balance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(summary.balance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.transactions')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.transactionCount}</div>
          </CardContent>
        </Card>

        {recurringSummary.totalActive > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.estMonthlyRecurring')}</CardTitle>
              <Repeat className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(recurringSummary.estimatedMonthlyCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.activePatterns', { count: recurringSummary.totalActive })}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.monthlyTrends')}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => formatMonth(value)}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => formatMonth(label)}
                  />
                  <Bar dataKey="income" name={t('dashboard.income')} fill="#22c55e" />
                  <Bar dataKey="expenses" name={t('dashboard.expenses')} fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {t('common.noDataAvailable')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.expensesByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="total"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ categoryName, percentage }) =>
                      percentage > 5 ? `${categoryName} (${percentage.toFixed(0)}%)` : ''
                    }
                    labelLine={false}
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.categoryColor || `hsl(${index * 30}, 70%, 50%)`}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {t('dashboard.noExpenseData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recurring Patterns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            {t('dashboard.recurringTransactions')}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDetectPatterns}
            disabled={detectingPatterns}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${detectingPatterns ? 'animate-spin' : ''}`} />
            {detectingPatterns ? t('dashboard.detecting') : t('dashboard.detectPatterns')}
          </Button>
        </CardHeader>
        <CardContent>
          {recurringPatterns.length > 0 ? (
            <div className="space-y-3">
              {recurringPatterns.filter(p => p.isActive).slice(0, 5).map((pattern) => (
                <div
                  key={pattern.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      <Repeat className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm truncate max-w-xs">
                        {pattern.descriptionPattern}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pattern.frequency.charAt(0).toUpperCase() + pattern.frequency.slice(1)} - {t('dashboard.occurrences', { count: pattern.occurrenceCount })}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(pattern.avgAmount)}
                  </span>
                </div>
              ))}
              {recurringPatterns.filter(p => p.isActive).length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  {t('dashboard.morePatterns', { count: recurringPatterns.filter(p => p.isActive).length - 5 })}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('dashboard.noRecurringPatterns')}</p>
              <p className="text-sm mt-1">
                {t('dashboard.clickDetectPatterns')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentTransactions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length > 0 ? (
            <div className="space-y-4">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        tx.isIncome ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {tx.isIncome ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
                    <span
                      className={`font-semibold ${
                        tx.isIncome ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.isIncome ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('dashboard.noTransactionsYet')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
