import { fetchApi } from './client';
import type {
  Workspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceMember,
  WorkspaceInvitation,
  InviteUserRequest,
} from '@compasso/shared';

export async function getWorkspaces(): Promise<Workspace[]> {
  return fetchApi<Workspace[]>('/workspaces');
}

export async function getWorkspace(id: number): Promise<Workspace> {
  return fetchApi<Workspace>(`/workspaces/${id}`);
}

export async function createWorkspace(data: CreateWorkspaceRequest): Promise<Workspace> {
  return fetchApi<Workspace>('/workspaces', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWorkspace(id: number, data: UpdateWorkspaceRequest): Promise<void> {
  await fetchApi(`/workspaces/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteWorkspace(id: number): Promise<void> {
  await fetchApi(`/workspaces/${id}`, {
    method: 'DELETE',
  });
}

// Workspace Members & Invitations
export async function getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]> {
  return fetchApi<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
}

export async function inviteUser(workspaceId: number, data: InviteUserRequest): Promise<void> {
  await fetchApi(`/workspaces/${workspaceId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWorkspaceInvitations(workspaceId: number): Promise<WorkspaceInvitation[]> {
  return fetchApi<WorkspaceInvitation[]>(`/workspaces/${workspaceId}/invitations`);
}

export async function removeWorkspaceMember(workspaceId: number, userId: number): Promise<void> {
  await fetchApi(`/workspaces/${workspaceId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateMemberRole(
  workspaceId: number,
  userId: number,
  data: { role: 'editor' | 'viewer' }
): Promise<void> {
  await fetchApi(`/workspaces/${workspaceId}/members/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getMyInvitations(): Promise<WorkspaceInvitation[]> {
  return fetchApi<WorkspaceInvitation[]>('/invitations');
}

export async function acceptInvitation(id: number): Promise<void> {
  await fetchApi(`/invitations/${id}/accept`, {
    method: 'POST',
  });
}

export async function declineInvitation(id: number): Promise<void> {
  await fetchApi(`/invitations/${id}/decline`, {
    method: 'POST',
  });
}
