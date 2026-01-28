import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { resetPassword } from '@/services/api';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token!, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Compasso</h1>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{t('auth.invalidResetLink')}</span>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/forgot-password" className="text-primary hover:underline">
                    {t('auth.requestNewLink')}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Compasso</h1>
          <p className="mt-2 text-muted-foreground">{t('auth.resetPasswordSubtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {t('auth.resetPassword')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{t('auth.passwordResetSuccess')}</span>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary hover:underline">
                    {t('auth.backToLogin')}
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('auth.newPasswordLabel')}
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('auth.enterPassword')}
                    required
                    autoComplete="new-password"
                    autoFocus
                    minLength={8}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('auth.passwordHint')}
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('auth.confirmNewPasswordLabel')}
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirmPassword')}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('auth.resettingPassword') : t('auth.resetPasswordSubmit')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
