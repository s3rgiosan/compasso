import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  createCategory,
  addCategoryPattern,
  checkPatternExists,
} from '@/services/api';
import { COLORS } from '@/lib/constants';
import type { BankId } from '@compasso/shared';

interface CategoryCreateFormProps {
  workspaceId: number;
  banks: Array<{ id: string; name: string }>;
  onCreated: () => void;
  onCancel: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export function CategoryCreateForm({
  workspaceId,
  banks,
  onCreated,
  onCancel,
  showToast,
}: CategoryCreateFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [patterns, setPatterns] = useState<Array<{ bankId: BankId; pattern: string }>>([]);
  const [patternBank, setPatternBank] = useState<BankId>('novo_banco');
  const [patternText, setPatternText] = useState('');
  const [creating, setCreating] = useState(false);

  const handleAddPattern = async () => {
    const pattern = patternText.trim();
    if (!pattern) return;

    // Check for duplicate in local list
    const isDuplicateLocal = patterns.some(
      (p) => p.pattern === pattern && p.bankId === patternBank
    );

    if (isDuplicateLocal) {
      showToast('This pattern is already added', 'error');
      return;
    }

    // Check for duplicate in workspace
    try {
      const result = await checkPatternExists(workspaceId, patternBank, pattern);

      if (result.exists) {
        showToast(`This pattern already exists in category "${result.categoryName}"`, 'error');
        return;
      }

      setPatterns((prev) => [...prev, { bankId: patternBank, pattern }]);
      setPatternText('');
    } catch (err) {
      console.error('Failed to check pattern:', err);
      showToast('Failed to validate pattern', 'error');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    setCreating(true);
    try {
      const newCategory = await createCategory({
        name: name.trim(),
        color,
        workspaceId,
      });

      // Add patterns if any were defined
      for (const p of patterns) {
        await addCategoryPattern(newCategory.id, workspaceId, {
          bankId: p.bankId,
          pattern: p.pattern,
        });
      }

      showToast('Category created successfully', 'success');
      onCreated();
    } catch (err) {
      console.error('Failed to create category:', err);
      showToast(err instanceof Error ? err.message : 'Failed to create category', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('categories.createCategory')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('categories.name')}</label>
            <Input
              placeholder={t('categories.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('categories.color')}</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c.value
                      ? 'border-gray-900 scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  type="button"
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto-Match Patterns
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Transactions containing these keywords will be automatically suggested for this category
            </p>
            {patterns.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {patterns.map((p, index) => {
                  const bank = banks.find((b) => b.id === p.bankId);
                  return (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{bank?.name}:</span>
                      {p.pattern}
                      <button
                        onClick={() => setPatterns((prev) => prev.filter((_, i) => i !== index))}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <Select
                value={patternBank}
                onChange={(e) => setPatternBank(e.target.value as BankId)}
                options={banks.map((b) => ({ value: b.id, label: b.name }))}
                className="w-40"
              />
              <Input
                placeholder="Enter keyword pattern"
                value={patternText}
                onChange={(e) => setPatternText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPattern();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddPattern}
                disabled={!patternText.trim()}
              >
                Add
              </Button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? t('common.creating') : t('common.create')}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={creating}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
