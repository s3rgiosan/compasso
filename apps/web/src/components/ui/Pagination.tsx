import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const pages: (number | 'ellipsis')[] = [0];

  if (current > 2) {
    pages.push('ellipsis');
  }

  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  if (current < total - 3) {
    pages.push('ellipsis');
  }

  pages.push(total - 1);

  return pages;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {t('common.showing', { from, to, total })}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
        >
          {t('common.previous')}
        </Button>
        {pageNumbers.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="inline-flex items-center justify-center h-9 px-2 text-sm text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(p)}
              aria-label={t('common.page', { page: p + 1 })}
              aria-current={p === page ? 'page' : undefined}
            >
              {p + 1}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}
