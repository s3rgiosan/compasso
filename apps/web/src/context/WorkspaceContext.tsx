import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Workspace, WorkspaceRole } from '@compasso/shared';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'compasso-workspace-id';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentRole: WorkspaceRole | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  loading: boolean;
  error: string | null;
  refetchWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const response = await fetch('/api/workspaces', {
        credentials: 'include',
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch workspaces');
      }

      const fetchedWorkspaces: Workspace[] = data.data;
      setWorkspaces(fetchedWorkspaces);

      // Get storage key based on user
      const storageKey = user ? `${STORAGE_KEY}-${user.id}` : STORAGE_KEY;

      // Restore selected workspace from localStorage or use default
      const storedId = localStorage.getItem(storageKey);
      let selectedWorkspace: Workspace | undefined;

      if (storedId) {
        selectedWorkspace = fetchedWorkspaces.find((w) => w.id === parseInt(storedId));
      }

      // Fall back to default workspace if stored one doesn't exist
      if (!selectedWorkspace) {
        selectedWorkspace = fetchedWorkspaces.find((w) => w.isDefault) || fetchedWorkspaces[0];
      }

      if (selectedWorkspace) {
        setCurrentWorkspaceState(selectedWorkspace);
        localStorage.setItem(storageKey, selectedWorkspace.id.toString());
      } else {
        setCurrentWorkspaceState(null);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch workspaces');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Refetch workspaces when auth state changes
  useEffect(() => {
    if (!authLoading) {
      setLoading(true);
      fetchWorkspaces();
    }
  }, [authLoading, user?.id, fetchWorkspaces]);

  const setCurrentWorkspace = useCallback(
    (workspace: Workspace) => {
      setCurrentWorkspaceState(workspace);
      const storageKey = user ? `${STORAGE_KEY}-${user.id}` : STORAGE_KEY;
      localStorage.setItem(storageKey, workspace.id.toString());
    },
    [user]
  );

  const value: WorkspaceContextValue = {
    workspaces,
    currentWorkspace,
    currentRole: currentWorkspace?.role ?? null,
    setCurrentWorkspace,
    loading: loading || authLoading,
    error,
    refetchWorkspaces: fetchWorkspaces,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }

  return context;
}

// Helper hook to get current workspace ID (throws if not available)
export function useWorkspaceId(): number {
  const { currentWorkspace, loading } = useWorkspace();

  if (loading) {
    throw new Error('Workspace is still loading');
  }

  if (!currentWorkspace) {
    throw new Error('No workspace selected');
  }

  return currentWorkspace.id;
}
