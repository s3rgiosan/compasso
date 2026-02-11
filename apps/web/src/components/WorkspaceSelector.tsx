import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Settings, Plus, Briefcase, User, Building2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Workspace } from '@compasso/shared';

// Icon mapping for workspace icons
const iconMap: Record<string, typeof Briefcase> = {
  briefcase: Briefcase,
  user: User,
  building: Building2,
  users: Users,
};

function getWorkspaceIcon(iconName: string) {
  return iconMap[iconName] || Briefcase;
}

interface WorkspaceSelectorProps {
  onManageClick?: () => void;
}

export default function WorkspaceSelector({ onManageClick }: WorkspaceSelectorProps) {
  const { t } = useTranslation();
  const { workspaces, currentWorkspace, setCurrentWorkspace, loading } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, []);

  const handleSelect = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setIsOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg animate-pulse">
        <div className="w-5 h-5 bg-gray-200 rounded" />
        <div className="w-20 h-4 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <button
        onClick={onManageClick}
        className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        {t('workspaces.createWorkspace')}
      </button>
    );
  }

  const CurrentIcon = getWorkspaceIcon(currentWorkspace.icon);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center"
          style={{ backgroundColor: currentWorkspace.color }}
        >
          <CurrentIcon className="w-3 h-3 text-white" />
        </div>
        <span className="font-medium text-gray-700 max-w-[120px] truncate">
          {currentWorkspace.name}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
            {t('workspaces.title')}
          </div>

          {workspaces.map((workspace) => {
            const Icon = getWorkspaceIcon(workspace.icon);
            const isSelected = workspace.id === currentWorkspace.id;

            return (
              <button
                key={workspace.id}
                onClick={() => handleSelect(workspace)}
                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-primary/5' : ''
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: workspace.color }}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-gray-900 truncate">{workspace.name}</div>
                  {workspace.description && (
                    <div className="text-xs text-gray-500 truncate">{workspace.description}</div>
                  )}
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            );
          })}

          <div className="border-t border-gray-200 mt-1 pt-1">
            {onManageClick && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onManageClick();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                  <Settings className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-sm">{t('workspaces.manageWorkspaces')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
