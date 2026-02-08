import { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { UserPlus, Crown, Pencil, Eye, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  getWorkspaceMembers,
  getWorkspaceInvitations,
  inviteUser,
  removeWorkspaceMember,
  updateMemberRole,
} from '@/services/api';
import type { WorkspaceMember, WorkspaceInvitation, WorkspaceRole } from '@compasso/shared';

interface WorkspaceMembersProps {
  workspaceId: number;
  currentRole: WorkspaceRole | null;
}

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    owner: 'bg-amber-100 text-amber-800',
    editor: 'bg-blue-100 text-blue-800',
    viewer: 'bg-gray-100 text-gray-600',
  };

  const icons: Record<string, React.ReactNode> = {
    owner: <Crown className="h-3 w-3" />,
    editor: <Pencil className="h-3 w-3" />,
    viewer: <Eye className="h-3 w-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${styles[role] || styles.viewer}`}>
      {icons[role]}
      {t(`members.${role}`)}
    </span>
  );
}

export default function WorkspaceMembers({ workspaceId, currentRole }: WorkspaceMembersProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Remove confirmation
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);

  const isOwner = currentRole === 'owner';
  const canInvite = currentRole === 'owner' || currentRole === 'editor';

  const ROLE_OPTIONS = [
    { value: 'editor', label: t('members.editor') },
    { value: 'viewer', label: t('members.viewer') },
  ];

  const loadData = async () => {
    try {
      setError(null);
      const [membersData, invitationsData] = await Promise.all([
        getWorkspaceMembers(workspaceId),
        canInvite ? getWorkspaceInvitations(workspaceId) : Promise.resolve([]),
      ]);
      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [workspaceId]);

  const handleInvite = async () => {
    if (!inviteInput.trim()) {
      setInviteError('Username or email is required');
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      await inviteUser(workspaceId, {
        usernameOrEmail: inviteInput.trim(),
        role: inviteRole,
      });
      setInviteInput('');
      setShowInviteForm(false);
      await loadData();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: number) => {
    try {
      await removeWorkspaceMember(workspaceId, userId);
      setRemoveConfirm(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleRoleChange = async (userId: number, newRole: 'editor' | 'viewer') => {
    try {
      await updateMemberRole(workspaceId, userId, { role: newRole });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            Members ({members.length})
          </h4>
          {canInvite && !showInviteForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowInviteForm(true);
                setInviteError(null);
              }}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              {t('members.invite')}
            </Button>
          )}
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <div className="p-3 bg-gray-50 rounded-lg space-y-3">
            {inviteError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder={t('members.usernamePlaceholder')}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInvite();
                }}
              />
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                options={ROLE_OPTIONS}
                className="w-28"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteInput('');
                  setInviteError(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleInvite} disabled={inviting}>
                {inviting ? t('members.inviting') : t('members.inviteMember')}
              </Button>
            </div>
          </div>
        )}

        {/* Members */}
        <div className="divide-y divide-gray-100">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                  {(member.displayName || member.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {member.displayName || member.username}
                  </div>
                  {member.displayName && (
                    <div className="text-xs text-muted-foreground">@{member.username}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && member.role !== 'owner' ? (
                  <>
                    <Select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.userId, e.target.value as 'editor' | 'viewer')
                      }
                      options={ROLE_OPTIONS}
                      className="w-24 text-xs"
                    />
                    {removeConfirm === member.userId ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRemoveConfirm(null)}
                        >
                          No
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemove(member.userId)}
                        >
                          Yes
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRemoveConfirm(member.userId)}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    )}
                  </>
                ) : (
                  <RoleBadge role={member.role} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending invitations */}
      {canInvite && invitations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {t('members.pending')} ({invitations.length})
          </h4>
          <div className="divide-y divide-gray-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-sm font-medium text-yellow-700">
                    ?
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {inv.invitedUser?.displayName || inv.invitedUser?.username || 'Invited user'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <Trans i18nKey="invitations.invitedBy" values={{ name: inv.invitedBy.displayName || inv.invitedBy.username, role: t(`members.${inv.role}`) }} />
                    </div>
                  </div>
                </div>
                <RoleBadge role={inv.role} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
