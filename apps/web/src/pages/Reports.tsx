import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  PiggyBank,
  DollarSign,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  getReportYears,
  getYearlySummary,
  getCategoryTrends,
  type YearlySummary,
  type CategoryTrend,
} from '@/services/api';
import { formatCurrency, formatMonth } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function Reports() {
  const { t } = useTranslation();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [summary, setSummary] = useState<YearlySummary | null>(null);
  const [trends, setTrends] = useState<CategoryTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadYears() {
      if (!currentWorkspace) return;
      try {
        const yearsData = await getReportYears(currentWorkspace.id);
        setYears(yearsData);
        if (yearsData.length > 0) {
          setSelectedYear(yearsData[0]);
        } else {
          // No years means no data, stop loading
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports data');
        setLoading(false);
      }
    }
    loadYears();
  }, [currentWorkspace]);

  useEffect(() => {
    async function loadData() {
      if (!currentWorkspace || !selectedYear) return;
      setLoading(true);
      setError(null);
      try {
        const [summaryData, trendsData] = await Promise.all([
          getYearlySummary(currentWorkspace.id, selectedYear),
          getCategoryTrends(currentWorkspace.id, 12),
        ]);
        setSummary(summaryData);
        setTrends(trendsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentWorkspace, selectedYear]);

  const translateCat = (name: string) => name === 'Uncategorized' ? t('categories.uncategorized') : name;

  if (workspaceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('common.loadingWorkspace')}</div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('common.selectWorkspace')}</div>
      </div>
    );
  }

  if (years.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <BarChart3 className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('reports.noDataYet')}</p>
          <p className="text-sm text-muted-foreground">
            {t('reports.uploadToSee')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with year selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <Select
          value={selectedYear?.toString() || ''}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          options={years.map((y) => ({ value: y, label: y.toString() }))}
          className="w-32"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('common.loading')}</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{error}</div>
        </div>
      ) : summary ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('reports.totalIncome')}</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalIncome)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('reports.totalExpenses')}</CardTitle>
                <CreditCard className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.totalExpenses)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('reports.netSavings')}</CardTitle>
                <PiggyBank className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    summary.netSavings >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(summary.netSavings)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('reports.savingsRate')}</CardTitle>
                {summary.savingsRate >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    summary.savingsRate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {summary.savingsRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly comparison chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t('reports.monthlyComparison')}</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.monthlyBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={summary.monthlyBreakdown}>
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
                    <Legend />
                    <Bar dataKey="income" name={t('reports.income')} fill="#22c55e" />
                    <Bar dataKey="expenses" name={t('reports.expenses')} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  {t('common.noDataAvailable')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('reports.expensesByCategory')}</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.categoryBreakdown.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('reports.categoryHeader')}</TableHead>
                        <TableHead className="text-right">{t('reports.amountHeader')}</TableHead>
                        <TableHead className="text-right">{t('reports.transactionsHeader')}</TableHead>
                        <TableHead className="text-right">{t('reports.percentHeader')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.categoryBreakdown.map((cat) => (
                        <TableRow key={cat.categoryId ?? 'uncategorized'}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cat.categoryColor || '#a1a1aa' }}
                              />
                              {translateCat(cat.categoryName)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(cat.total)}
                          </TableCell>
                          <TableCell className="text-right">{cat.count}</TableCell>
                          <TableCell className="text-right">{cat.percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t('reports.noExpenseData')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category trends */}
          <Card>
            <CardHeader>
              <CardTitle>{t('reports.categoryTrends')}</CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <div className="space-y-6">
                  {/* Trends chart - top 5 categories */}
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(value) => formatMonth(value)}
                        fontSize={12}
                        allowDuplicatedCategory={false}
                      />
                      <YAxis fontSize={12} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => formatMonth(label)}
                      />
                      <Legend />
                      {trends.slice(0, 5).map((trend, index) => {
                        // Merge all monthly data into the chart
                        const color = trend.categoryColor || `hsl(${index * 60}, 70%, 50%)`;
                        return (
                          <Line
                            key={trend.categoryName}
                            data={trend.monthlyData}
                            type="monotone"
                            dataKey="total"
                            name={translateCat(trend.categoryName)}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Trends summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trends.slice(0, 6).map((trend) => (
                      <div
                        key={trend.categoryName}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: trend.categoryColor || '#a1a1aa' }}
                          />
                          <span className="font-medium text-sm">{translateCat(trend.categoryName)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {t('reports.perMonth', { amount: formatCurrency(trend.avgMonthly) })}
                          </span>
                          {trend.trend === 'up' && (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          )}
                          {trend.trend === 'down' && (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          )}
                          {trend.trend === 'stable' && (
                            <Minus className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t('reports.noTrendData')}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
