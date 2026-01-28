import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingPlaceholder } from '@/components/ui/LoadingPlaceholder';
import { CategoryCreateForm } from '@/components/CategoryCreateForm';
import { CategoryListItem } from '@/components/CategoryListItem';
import {
  getCategories,
  getCategory,
  deleteCategory,
  updateCategory,
  getSupportedBanks,
} from '@/services/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Category, CategoryWithPatterns, PaginatedResponse } from '@compasso/shared';

const PAGE_SIZE = 50;

export default function Categories() {
  const { t } = useTranslation();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { showToast } = useToast();
  const [categoriesData, setCategoriesData] = useState<PaginatedResponse<Category> | null>(null);
  const [banks, setBanks] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [categoryDetails, setCategoryDetails] = useState<CategoryWithPatterns | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (currentWorkspace) {
      loadBanks();
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (currentWorkspace) {
      loadCategories();
    }
  }, [currentWorkspace, page]);

  async function loadBanks() {
    try {
      const banksData = await getSupportedBanks();
      setBanks(banksData);
    } catch (err) {
      console.error('Failed to load banks:', err);
    }
  }

  async function loadCategories() {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const data = await getCategories(currentWorkspace.id, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setCategoriesData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategoryDetails(categoryId: number) {
    if (!currentWorkspace) return;
    try {
      const details = await getCategory(categoryId, currentWorkspace.id);
      setCategoryDetails(details);
    } catch (err) {
      console.error('Failed to load category details:', err);
    }
  }

  const handleExpand = async (categoryId: number) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setCategoryDetails(null);
    } else {
      setExpandedCategory(categoryId);
      await loadCategoryDetails(categoryId);
    }
  };

  const handleDeleteCategory = async () => {
    if (!currentWorkspace || !deleteConfirm) return;

    setDeleting(true);
    try {
      await deleteCategory(deleteConfirm.id, currentWorkspace.id);
      if (expandedCategory === deleteConfirm.id) {
        setExpandedCategory(null);
        setCategoryDetails(null);
      }
      showToast(t('categories.categoryDeleted'), 'success');
      setDeleteConfirm(null);
      await loadCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      showToast(err instanceof Error ? err.message : t('categories.categoryDeleteFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateColor = async (categoryId: number, color: string) => {
    if (!currentWorkspace) return;
    try {
      await updateCategory(categoryId, currentWorkspace.id, { color });
      await loadCategories();
      if (categoryDetails?.id === categoryId) {
        setCategoryDetails({ ...categoryDetails, color });
      }
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const handleRename = async (categoryId: number, newName: string): Promise<boolean> => {
    if (!currentWorkspace) return false;
    try {
      await updateCategory(categoryId, currentWorkspace.id, { name: newName });
      await loadCategories();
      if (categoryDetails?.id === categoryId) {
        setCategoryDetails({ ...categoryDetails, name: newName });
      }
      showToast(t('categories.categoryRenamed'), 'success');
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('categories.categoryRenameFailed'), 'error');
      return false;
    }
  };

  const categories = categoriesData?.items ?? [];
  const totalPages = categoriesData ? Math.ceil(categoriesData.total / PAGE_SIZE) : 0;

  if (workspaceLoading || !currentWorkspace || loading) {
    return <LoadingPlaceholder text={t('common.loadingWorkspace')} />;
  }

  return (
    <div className="space-y-6">
      {error && <ErrorAlert message={error} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('categories.title')}</h1>
          <p className="text-muted-foreground">
            {t('categories.subtitle')}
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('categories.addCategory')}
        </Button>
      </div>

      {showCreateForm && (
        <CategoryCreateForm
          workspaceId={currentWorkspace.id}
          banks={banks}
          showToast={showToast}
          onCreated={() => {
            setShowCreateForm(false);
            setPage(0);
            loadCategories();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Categories list */}
      <div className="space-y-2">
        {categories.map((category) => (
          <CategoryListItem
            key={category.id}
            category={category}
            isExpanded={expandedCategory === category.id}
            categoryDetails={expandedCategory === category.id ? categoryDetails : null}
            banks={banks}
            workspaceId={currentWorkspace.id}
            onToggleExpand={() => handleExpand(category.id)}
            onDelete={(id, name) => setDeleteConfirm({ id, name })}
            onUpdateColor={handleUpdateColor}
            onRename={handleRename}
            onPatternChanged={() => loadCategoryDetails(category.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1} to{' '}
            {Math.min((page + 1) * PAGE_SIZE, categoriesData?.total ?? 0)} of {categoriesData?.total ?? 0}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteCategory}
        title={t('categories.deleteCategory')}
        message={t('categories.deleteCategoryConfirm', { name: deleteConfirm?.name })}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
