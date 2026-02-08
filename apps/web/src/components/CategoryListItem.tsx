import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryPatterns } from '@/components/CategoryPatterns';
import { ColorPicker } from '@/components/ui/ColorPicker';
import type { Category, CategoryWithPatterns } from '@compasso/shared';

interface CategoryListItemProps {
  category: Category;
  isExpanded: boolean;
  categoryDetails: CategoryWithPatterns | null;
  banks: Array<{ id: string; name: string }>;
  workspaceId: number;
  onToggleExpand: () => void;
  onDelete: (id: number, name: string) => void;
  onUpdateColor: (categoryId: number, color: string) => void;
  onRename: (categoryId: number, newName: string) => Promise<boolean>;
  onPatternChanged: () => void;
}

export function CategoryListItem({
  category,
  isExpanded,
  categoryDetails,
  banks,
  workspaceId,
  onToggleExpand,
  onDelete,
  onUpdateColor,
  onRename,
  onPatternChanged,
}: CategoryListItemProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(category.name);
    setEditing(true);
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(false);
    setEditName(category.name);
  };

  const handleSaveEdit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === category.name) {
      handleCancelEdit();
      return;
    }
    setSaving(true);
    const success = await onRename(category.id, trimmed);
    setSaving(false);
    if (success) {
      setEditing(false);
    }
  };

  return (
    <Card>
      <div
        className="group flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: category.color || '#a1a1aa' }}
          />
          {editing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="h-7 w-48 text-sm"
                disabled={saving}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveEdit}
                disabled={saving || !editName.trim()}
                className="h-7 w-7"
              >
                <Check className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelEdit}
                disabled={saving}
                className="h-7 w-7"
              >
                <X className="h-3.5 w-3.5 text-red-600" />
              </Button>
            </div>
          ) : (
            <>
              <span className="font-medium">{category.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStartEdit}
                className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(category.id, category.name);
            }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && categoryDetails && (
        <div className="border-t p-4 bg-gray-50">
          {/* Color picker */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('categories.color')}</label>
            <ColorPicker
              value={categoryDetails.color || '#a1a1aa'}
              onChange={(color) => onUpdateColor(category.id, color)}
            />
          </div>

          {/* Patterns */}
          <CategoryPatterns
            categoryDetails={categoryDetails}
            banks={banks}
            workspaceId={workspaceId}
            onPatternChanged={onPatternChanged}
          />
        </div>
      )}
    </Card>
  );
}
