import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createCategory, addCategoryPattern } from '@/services/api';
import { COLORS } from '@/lib/constants';
import type { Category, BankId } from '@compasso/shared';

interface CategorySelectProps {
  value: number | null;
  categories: Category[];
  workspaceId: number;
  onChange: (categoryId: number | null) => void;
  onCategoryCreated?: (category: Category) => void;
  className?: string;
  transactionDescription?: string;
  banks?: Array<{ id: string; name: string }>;
  defaultBankId?: BankId;
  allDescriptions?: string[];
  onPatternApply?: (categoryId: number, matchingIndices: number[]) => void;
}

function findMatches(descriptions: string[], pattern: string): number[] {
  if (!pattern.trim()) return [];
  const upperPattern = pattern.toUpperCase();
  const indices: number[] = [];
  descriptions.forEach((desc, i) => {
    if (desc.toUpperCase().includes(upperPattern)) {
      indices.push(i);
    }
  });
  return indices;
}

export function CategorySelect({
  value,
  categories,
  workspaceId,
  onChange,
  onCategoryCreated,
  className,
  transactionDescription,
  banks,
  defaultBankId,
  allDescriptions,
  onPatternApply,
}: CategorySelectProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(COLORS[0].value);
  const [newCategoryPattern, setNewCategoryPattern] = useState('');
  const [bankOverride, setBankOverride] = useState<BankId | null>(null);
  const selectedBankId = bankOverride ?? defaultBankId ?? '';
  const [creating, setCreating] = useState(false);

  // Confirmation dialog state (for batch-apply in Upload view)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null);
  const [pendingMatchingIndices, setPendingMatchingIndices] = useState<number[]>([]);

  const showPatternInput = Boolean(banks && banks.length > 0);
  const hasBatchApply = Boolean(allDescriptions && onPatternApply);

  // Calculate matching count for pattern preview (Upload view only)
  const matchingCount = useMemo(() => {
    if (!allDescriptions || !newCategoryPattern.trim()) return 0;
    return findMatches(allDescriptions, newCategoryPattern).length;
  }, [allDescriptions, newCategoryPattern]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (selectedValue === '__create__') {
      setBankOverride(null);
      setShowModal(true);
    } else {
      onChange(selectedValue ? parseInt(selectedValue) : null);
    }
  };

  const handleCreate = async () => {
    if (!newCategoryName.trim()) return;

    setCreating(true);
    try {
      const newCategory = await createCategory({
        name: newCategoryName.trim(),
        color: newCategoryColor,
        workspaceId,
      });

      // Persist pattern to backend if provided
      if (newCategoryPattern.trim() && banks && banks.length > 0) {
        try {
          await addCategoryPattern(newCategory.id, workspaceId, {
            bankId: selectedBankId,
            pattern: newCategoryPattern.trim(),
          });
        } catch (err) {
          console.error('Failed to save pattern:', err);
          // Don't block category creation if pattern save fails
        }
      }

      onCategoryCreated?.(newCategory);
      onChange(newCategory.id);

      // Check if we should show the confirmation dialog for batch application
      if (hasBatchApply && newCategoryPattern.trim() && allDescriptions) {
        const matchingIndices = findMatches(allDescriptions, newCategoryPattern);
        if (matchingIndices.length > 0) {
          setPendingCategory(newCategory);
          setPendingMatchingIndices(matchingIndices);
          setShowConfirmDialog(true);
          handleClose();
          return;
        }
      }

      showToast('Category created successfully', 'success');
      handleClose();
    } catch (err) {
      console.error('Failed to create category:', err);
      showToast(err instanceof Error ? err.message : 'Failed to create category', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmApply = () => {
    if (pendingCategory && pendingMatchingIndices.length > 0) {
      onPatternApply?.(pendingCategory.id, pendingMatchingIndices);
      showToast(
        `Category created and applied to ${pendingMatchingIndices.length} transaction${pendingMatchingIndices.length !== 1 ? 's' : ''}`,
        'success'
      );
    }
    setShowConfirmDialog(false);
    setPendingCategory(null);
    setPendingMatchingIndices([]);
  };

  const handleCancelApply = () => {
    showToast('Category created successfully', 'success');
    setShowConfirmDialog(false);
    setPendingCategory(null);
    setPendingMatchingIndices([]);
  };

  const handleClose = () => {
    setShowModal(false);
    setNewCategoryName('');
    setNewCategoryColor(COLORS[0].value);
    setNewCategoryPattern('');
    setBankOverride(null);
  };

  return (
    <>
      <Select
        value={value?.toString() || ''}
        onChange={handleSelectChange}
        options={[
          { value: '', label: t('categories.noCategory') },
          ...categories
            .filter((c) => c.name.toLowerCase() !== 'uncategorized')
            .map((c) => ({ value: c.id, label: c.name })),
          { value: '__create__', label: t('categories.createNew') },
        ]}
        className={className}
      />

      <Modal open={showModal} onClose={handleClose} title={t('categories.createCategory')}>
        <div className="space-y-4">
          {transactionDescription && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction
              </label>
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border truncate">
                {transactionDescription}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('categories.name')}
            </label>
            <Input
              placeholder={t('categories.namePlaceholder')}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCategoryName.trim()) handleCreate();
              }}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('categories.color')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setNewCategoryColor(color.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    newCategoryColor === color.value
                      ? 'border-gray-900 scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                  type="button"
                />
              ))}
            </div>
          </div>

          {showPatternInput && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pattern (optional)
              </label>
              <div className="flex gap-2">
                {banks && banks.length > 1 && !defaultBankId && (
                  <Select
                    value={selectedBankId}
                    onChange={(e) => setBankOverride(e.target.value as BankId)}
                    options={banks.map((b) => ({ value: b.id, label: b.name }))}
                    className="w-36"
                  />
                )}
                <Input
                  placeholder="e.g., UBER, AMAZON, NETFLIX"
                  value={newCategoryPattern}
                  onChange={(e) => setNewCategoryPattern(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Transactions containing this text will be auto-categorized
              </p>
              {matchingCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded mt-2">
                  <Zap className="h-4 w-4 flex-shrink-0" />
                  <span>
                    <strong>{matchingCount}</strong> transaction
                    {matchingCount !== 1 ? 's' : ''} match this pattern
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={creating}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newCategoryName.trim()}
              className="flex-1"
            >
              {creating ? t('common.creating') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pattern apply confirmation dialog */}
      <Modal
        open={showConfirmDialog}
        onClose={handleCancelApply}
        title="Apply to Matching Transactions?"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>{pendingMatchingIndices.length}</strong> transaction
            {pendingMatchingIndices.length !== 1 ? 's' : ''} match this pattern.
            Apply "<strong>{pendingCategory?.name}</strong>" to all of them?
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCancelApply}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmApply} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
