import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  addCategoryPattern,
  deleteCategoryPattern,
} from '@/services/api';
import type { CategoryWithPatterns, CategoryPattern, BankId } from '@compasso/shared';

interface CategoryPatternsProps {
  categoryDetails: CategoryWithPatterns;
  banks: Array<{ id: string; name: string }>;
  workspaceId: number;
  onPatternChanged: () => void;
}

export function CategoryPatterns({
  categoryDetails,
  banks,
  workspaceId,
  onPatternChanged,
}: CategoryPatternsProps) {
  const { showToast } = useToast();
  const [newPatternBank, setNewPatternBank] = useState<BankId>('novo_banco');
  const [newPatternText, setNewPatternText] = useState('');

  const handleAddPattern = async () => {
    if (!newPatternText.trim()) return;

    try {
      await addCategoryPattern(categoryDetails.id, workspaceId, {
        bankId: newPatternBank,
        pattern: newPatternText.trim(),
      });
      setNewPatternText('');
      onPatternChanged();
      showToast('Pattern added successfully', 'success');
    } catch (err) {
      console.error('Failed to add pattern:', err);
      showToast(err instanceof Error ? err.message : 'Failed to add pattern', 'error');
    }
  };

  const handleDeletePattern = async (patternId: number) => {
    try {
      await deleteCategoryPattern(categoryDetails.id, patternId, workspaceId);
      onPatternChanged();
    } catch (err) {
      console.error('Failed to delete pattern:', err);
    }
  };

  // Group patterns by bank
  const patternsByBank = categoryDetails.patterns.reduce(
    (acc, pattern) => {
      if (!acc[pattern.bankId]) {
        acc[pattern.bankId] = [];
      }
      acc[pattern.bankId].push(pattern);
      return acc;
    },
    {} as Record<string, CategoryPattern[]>
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Auto-Match Patterns
      </label>
      <p className="text-xs text-muted-foreground mb-3">
        Transactions containing these keywords will be automatically suggested for this
        category
      </p>

      {/* Existing patterns grouped by bank */}
      {Object.keys(patternsByBank).length > 0 ? (
        <div className="space-y-3 mb-4">
          {Object.entries(patternsByBank).map(([bankId, patterns]) => {
            const bank = banks.find((b) => b.id === bankId);
            return (
              <div key={bankId}>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {bank?.name || bankId}
                </p>
                <div className="flex flex-wrap gap-2">
                  {patterns.map((pattern) => (
                    <Badge
                      key={pattern.id}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {pattern.pattern}
                      <button
                        onClick={() => handleDeletePattern(pattern.id)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-4">No patterns defined yet</p>
      )}

      {/* Add new pattern */}
      <div className="flex gap-2">
        <Select
          value={newPatternBank}
          onChange={(e) => setNewPatternBank(e.target.value as BankId)}
          options={banks.map((b) => ({ value: b.id, label: b.name }))}
          className="w-40"
        />
        <Input
          placeholder="Enter keyword pattern"
          value={newPatternText}
          onChange={(e) => setNewPatternText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
          className="flex-1"
        />
        <Button onClick={handleAddPattern} disabled={!newPatternText.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
