import { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Mail, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getMyInvitations, acceptInvitation, declineInvitation } from '@/services/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { WorkspaceInvitation } from '@compasso/shared';

export default function Invitations() {
  const { t } = useTranslation();
  const { refetchWorkspaces } = useWorkspace();
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);

  const loadInvitations = async () => {
    try {
      setError(null);
      const data = await getMyInvitations();
      setInvitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const handleAccept = async (id: number) => {
    setProcessing(id);
    try {
      await acceptInvitation(id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      await refetchWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (id: number) => {
    setProcessing(id);
    try {
      await declineInvitation(id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline invitation');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('invitations.title')}</h1>
        <p className="text-muted-foreground">
          {t('invitations.subtitle')}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Mail className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('invitations.noPending')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: inv.workspaceColor || '#6366f1' }}
                    >
                      {inv.workspaceName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-lg">{inv.workspaceName}</div>
                      <div className="text-sm text-muted-foreground">
                        <Trans i18nKey="invitations.invitedBy" values={{ name: inv.invitedBy.displayName || inv.invitedBy.username, role: t(`members.${inv.role}`) }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecline(inv.id)}
                      disabled={processing === inv.id}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('invitations.decline')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(inv.id)}
                      disabled={processing === inv.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t('invitations.accept')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
