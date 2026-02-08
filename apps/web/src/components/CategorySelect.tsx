import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, ChevronDown, Search, Plus, X } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createCategory, addCategoryPattern } from '@/services/api';
import { COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
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

  // Searchable combobox state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const comboRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const sortedCategories = useMemo(
    () => categories
      .filter((c) => c.name.toLowerCase() !== 'uncategorized')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const filteredCategories = useMemo(
    () => searchQuery
      ? sortedCategories.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : sortedCategories,
    [sortedCategories, searchQuery]
  );

  const selectedLabel = useMemo(() => {
    if (!value) return t('categories.noCategory');
    return sortedCategories.find((c) => c.id === value)?.name ?? t('categories.noCategory');
  }, [value, sortedCategories, t]);

  const [dropUp, setDropUp] = useState(false);

  const openDropdown = useCallback(() => {
    // Measure available space below the trigger to decide direction
    if (comboRef.current) {
      const rect = comboRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Dropdown is ~280px tall (search bar + max-h-56 list ≈ 224px + padding)
      setDropUp(spaceBelow < 300);
    }
    setIsOpen(true);
    setSearchQuery('');
    setHighlightedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const selectOption = useCallback((categoryId: number | null) => {
    onChange(categoryId);
    closeDropdown();
  }, [onChange, closeDropdown]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDropdown]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  // totalItems = "no category" + filtered categories + "create new"
  const totalItems = filteredCategories.length + 2;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex === 0) {
          selectOption(null);
        } else if (highlightedIndex <= filteredCategories.length) {
          selectOption(filteredCategories[highlightedIndex - 1].id);
        } else {
          setBankOverride(null);
          setShowModal(true);
          closeDropdown();
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
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
      <div className={cn('relative', className)} ref={comboRef} onKeyDown={handleKeyDown}>
        <button
          type="button"
          onClick={() => isOpen ? closeDropdown() : openDropdown()}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
            'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>

        {isOpen && (
          <div className={cn(
            'absolute left-0 z-50 w-full min-w-[200px] rounded-md border border-gray-200 bg-white shadow-lg',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          )}>
            <div className="flex items-center border-b px-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={t('common.search')}
                className="flex h-9 w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(''); setHighlightedIndex(0); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <ul ref={listRef} className="max-h-56 overflow-y-auto py-1" role="listbox">
              {/* No category option */}
              <li
                role="option"
                aria-selected={value === null}
                className={cn(
                  'cursor-pointer px-3 py-1.5 text-sm',
                  highlightedIndex === 0 ? 'bg-gray-100' : 'hover:bg-gray-50',
                  value === null && 'font-medium',
                )}
                onClick={() => selectOption(null)}
                onMouseEnter={() => setHighlightedIndex(0)}
              >
                {t('categories.noCategory')}
              </li>

              {/* Category options */}
              {filteredCategories.map((cat, i) => (
                <li
                  key={cat.id}
                  role="option"
                  aria-selected={cat.id === value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
                    highlightedIndex === i + 1 ? 'bg-gray-100' : 'hover:bg-gray-50',
                    cat.id === value && 'font-medium',
                  )}
                  onClick={() => selectOption(cat.id)}
                  onMouseEnter={() => setHighlightedIndex(i + 1)}
                >
                  {cat.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  <span className="truncate">{cat.name}</span>
                </li>
              ))}

              {filteredCategories.length === 0 && searchQuery && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {t('common.noResults')}
                </li>
              )}

              {/* Create new option */}
              <li
                role="option"
                aria-selected={false}
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-t px-3 py-1.5 text-sm text-primary',
                  highlightedIndex === filteredCategories.length + 1 ? 'bg-gray-100' : 'hover:bg-gray-50',
                )}
                onClick={() => {
                  setBankOverride(null);
                  setShowModal(true);
                  closeDropdown();
                }}
                onMouseEnter={() => setHighlightedIndex(filteredCategories.length + 1)}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('categories.createNew')}
              </li>
            </ul>
          </div>
        )}
      </div>

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
