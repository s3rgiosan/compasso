import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface PatternModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (pattern: string, applyToAll: boolean) => void;
  transaction: {
    description: string;
  } | null;
  categoryName: string;
  allDescriptions: string[];
}

/**
 * Extract a suggested pattern from a transaction description.
 * Removes dates, reference numbers, and other noise.
 */
function suggestPattern(description: string): string {
  return description
    .replace(/\d{2}[/.-]\d{2}[/.-]\d{2,4}/g, '') // Remove dates
    .replace(/\b\d{6,}\b/g, '') // Remove reference numbers (6+ digits)
    .replace(/\b\d{4,5}\b/g, '') // Remove shorter reference numbers
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3) // First 3 words as suggestion
    .join(' ')
    .toUpperCase();
}

/**
 * Count how many descriptions match a given pattern (case-insensitive).
 */
function countMatches(descriptions: string[], pattern: string): number {
  if (!pattern.trim()) return 0;
  const upperPattern = pattern.toUpperCase();
  return descriptions.filter((desc) =>
    desc.toUpperCase().includes(upperPattern)
  ).length;
}

export function PatternModal({
  open,
  onClose,
  onSave,
  transaction,
  categoryName,
  allDescriptions,
}: PatternModalProps) {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState('');
  const [applyToAll, setApplyToAll] = useState(true);

  // Set initial pattern when transaction changes
  useEffect(() => {
    if (transaction) {
      setPattern(suggestPattern(transaction.description));
      setApplyToAll(true);
    }
  }, [transaction]);

  // Count matching transactions (excluding the current one)
  const matchingCount = useMemo(() => {
    if (!transaction || !pattern.trim()) return 0;
    // Count all matches minus 1 for the current transaction
    const total = countMatches(allDescriptions, pattern);
    return Math.max(0, total - 1);
  }, [allDescriptions, pattern, transaction]);

  const handleSave = () => {
    if (pattern.trim()) {
      onSave(pattern.trim(), applyToAll);
    }
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  if (!transaction) return null;

  return (
    <Modal open={open} onClose={onClose} title={t('patterns.title')}>
      <div className="space-y-4">
        {/* Transaction preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transaction
          </label>
          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border truncate">
            {transaction.description}
          </p>
        </div>

        {/* Pattern input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('patterns.pattern')}
          </label>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={t('patterns.patternPlaceholder')}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Transactions containing this text will be auto-categorized
          </p>
        </div>

        {/* Matching count */}
        {matchingCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
            <Zap className="h-4 w-4 flex-shrink-0" />
            <span>
              {t('patterns.matchCount', { count: matchingCount })}
            </span>
          </div>
        )}

        {/* Apply to all checkbox */}
        {matchingCount > 0 && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700">
              {t('patterns.applyToAll', { category: categoryName })}
            </span>
          </label>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleSkip}>
            {t('patterns.skip')}
          </Button>
          <Button onClick={handleSave} disabled={!pattern.trim()}>
            {t('patterns.savePattern')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
