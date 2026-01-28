import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { forgotPassword } from '@/services/api';

export default function ForgotPassword() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Compasso</h1>
          <p className="mt-2 text-muted-foreground">{t('auth.forgotPasswordSubtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t('auth.forgotPasswordTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{t('auth.resetLinkSent')}</span>
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
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('profile.email')}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.enterEmail')}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary hover:underline">
                    {t('auth.backToLogin')}
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
