import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, AlertCircle, Briefcase, User, Building2, Users, ChevronDown, ChevronRight, Download, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createWorkspace, updateWorkspace, deleteWorkspace, exportWorkspaceBackup, importWorkspaceBackup } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import WorkspaceMembers from '@/components/WorkspaceMembers';
import type { Workspace } from '@compasso/shared';

const WORKSPACE_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

interface WorkspaceFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
}

const defaultFormData: WorkspaceFormData = {
  name: '',
  description: '',
  color: WORKSPACE_COLORS[0],
  icon: 'briefcase',
};

export default function WorkspaceSettings() {
  const { t } = useTranslation();
  const { workspaces, currentWorkspace, setCurrentWorkspace, refetchWorkspaces } = useWorkspace();
  const { showToast } = useToast();

  const WORKSPACE_ICONS = [
    { id: 'user', icon: User, label: t('workspaces.iconPersonal') },
    { id: 'briefcase', icon: Briefcase, label: t('workspaces.iconWork') },
    { id: 'building', icon: Building2, label: t('workspaces.iconCompany') },
    { id: 'users', icon: Users, label: t('workspaces.iconFamily') },
  ];

  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<WorkspaceFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<number | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [importing, setImporting] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<number | null>(null);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const newWorkspace = await createWorkspace({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        icon: formData.icon,
      });

      // Update UI immediately
      setShowCreateForm(false);
      setFormData(defaultFormData);
      setSaving(false);

      // Update workspace list and switch (non-blocking)
      refetchWorkspaces().then(() => {
        setCurrentWorkspace(newWorkspace);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingWorkspace) return;
    if (!formData.name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateWorkspace(editingWorkspace.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        icon: formData.icon,
      });

      await refetchWorkspaces();
      setEditingWorkspace(null);
      setFormData(defaultFormData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workspace: Workspace) => {
    if (workspace.isDefault) {
      setError(t('workspaces.cannotDeleteDefault'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteWorkspace(workspace.id);

      // Switch to default workspace if we deleted the current one
      if (currentWorkspace?.id === workspace.id) {
        const defaultWorkspace = workspaces.find((w) => w.isDefault);
        if (defaultWorkspace) {
          setCurrentWorkspace(defaultWorkspace);
        }
      }

      await refetchWorkspaces();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (workspace: Workspace) => {
    setExporting(workspace.id);
    try {
      await exportWorkspaceBackup(workspace.id);
      showToast(t('workspaces.backupExported'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('workspaces.backupExportFailed'), 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleImportClick = (workspaceId: number) => {
    importTargetRef.current = workspaceId;
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const workspaceId = importTargetRef.current;
    if (!file || !workspaceId) return;

    // Reset input so the same file can be selected again
    e.target.value = '';

    setImporting(workspaceId);
    try {
      const stats = await importWorkspaceBackup(workspaceId, file);
      const parts: string[] = [];
      if (stats.categoriesImported > 0) parts.push(`${stats.categoriesImported} categories`);
      if (stats.ledgersImported > 0) parts.push(`${stats.ledgersImported} ledgers`);
      if (stats.transactionsImported > 0) parts.push(`${stats.transactionsImported} transactions`);
      if (stats.patternsImported > 0) parts.push(`${stats.patternsImported} patterns`);
      if (stats.recurringPatternsImported > 0) parts.push(`${stats.recurringPatternsImported} recurring patterns`);

      const skipped = stats.categoriesSkipped + stats.ledgersSkipped + stats.patternsSkipped + stats.recurringPatternsSkipped;
      const msg = parts.length > 0
        ? `Imported ${parts.join(', ')}${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`
        : 'No new data to import (all duplicates skipped)';
      showToast(msg, 'success');
      refetchWorkspaces();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('workspaces.backupImportFailed'), 'error');
    } finally {
      setImporting(null);
    }
  };

  const startEdit = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setFormData({
      name: workspace.name,
      description: workspace.description || '',
      color: workspace.color,
      icon: workspace.icon,
    });
    setShowCreateForm(false);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingWorkspace(null);
    setShowCreateForm(false);
    setFormData(defaultFormData);
    setError(null);
  };

  const startCreate = () => {
    setShowCreateForm(true);
    setEditingWorkspace(null);
    setFormData(defaultFormData);
    setError(null);
  };

  const renderForm = (isEditing: boolean) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{isEditing ? t('workspaces.editWorkspace') : t('workspaces.createWorkspace')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('workspaces.name')}</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t('workspaces.namePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('workspaces.descriptionOptional')}
          </label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t('workspaces.descriptionPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('workspaces.color')}</label>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setFormData({ ...formData, color })}
                className={`w-8 h-8 rounded-lg transition-all ${
                  formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('workspaces.icon')}</label>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_ICONS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setFormData({ ...formData, icon: id })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  formData.icon === id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('workspaces.preview')}</label>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg w-fit">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: formData.color }}
            >
              {(() => {
                const IconComponent = WORKSPACE_ICONS.find((i) => i.id === formData.icon)?.icon || Briefcase;
                return <IconComponent className="w-5 h-5 text-white" />;
              })()}
            </div>
            <div>
              <div className="font-medium">{formData.name || t('workspaces.workspaceName')}</div>
              {formData.description && (
                <div className="text-sm text-gray-500">{formData.description}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={cancelEdit}>
            {t('common.cancel')}
          </Button>
          <Button onClick={isEditing ? handleUpdate : handleCreate} disabled={saving}>
            {saving ? t('common.saving') : isEditing ? t('common.update') : t('common.create')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('workspaces.title')}</h1>
          <p className="text-muted-foreground">
            {t('workspaces.subtitle')}
          </p>
        </div>
        {!showCreateForm && !editingWorkspace && (
          <Button onClick={startCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {t('workspaces.newWorkspace')}
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {showCreateForm && renderForm(false)}
      {editingWorkspace && renderForm(true)}

      <div className="grid gap-4">
        {workspaces.map((workspace) => {
          const IconComponent = WORKSPACE_ICONS.find((i) => i.id === workspace.icon)?.icon || Briefcase;
          const isDeleting = deleteConfirm === workspace.id;

          const isMembersExpanded = expandedMembers === workspace.id;

          return (
            <Card key={workspace.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: workspace.color }}
                    >
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-lg">{workspace.name}</span>
                        {workspace.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                            {t('common.default')}
                          </span>
                        )}
                        {currentWorkspace?.id === workspace.id && (
                          <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                            {t('common.active')}
                          </span>
                        )}
                        {workspace.role && (
                          <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-500 rounded">
                            {t(`members.${workspace.role}`)}
                          </span>
                        )}
                      </div>
                      {workspace.description && (
                        <p className="text-sm text-gray-500">{workspace.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isDeleting ? (
                      <>
                        <span className="text-sm text-red-600 mr-2">{t('workspaces.deleteConfirm')}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(workspace)}
                          disabled={saving}
                        >
                          {t('common.delete')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExpandedMembers(isMembersExpanded ? null : workspace.id)
                          }
                        >
                          <Users className="w-4 h-4 mr-1" />
                          {t('workspaces.members')}
                          {isMembersExpanded ? (
                            <ChevronDown className="w-3 h-3 ml-1" />
                          ) : (
                            <ChevronRight className="w-3 h-3 ml-1" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport(workspace)}
                          disabled={exporting === workspace.id}
                          title="Export backup"
                        >
                          {exporting === workspace.id ? (
                            <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                        {workspace.role !== 'viewer' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImportClick(workspace.id)}
                            disabled={importing === workspace.id}
                            title="Import backup"
                          >
                            {importing === workspace.id ? (
                              <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(workspace)}
                          disabled={editingWorkspace?.id === workspace.id}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {!workspace.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirm(workspace.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expandable members section */}
                {isMembersExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <WorkspaceMembers
                      workspaceId={workspace.id}
                      currentRole={workspace.role ?? null}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
