import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { updateProfile, changePassword } from '@/services/api';

export default function Profile() {
  const { t } = useTranslation();
  const { user, checkAuth } = useAuth();

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [locale, setLocale] = useState(user?.locale || 'en');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setProfileLoading(true);

    try {
      await updateProfile({
        displayName: displayName || null,
        email: email || undefined,
        locale,
      });

      // Refresh auth state to get updated user data
      await checkAuth();
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.newPasswordsNoMatch'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('profile.newPasswordMinLength'));
      return;
    }

    setPasswordLoading(true);

    try {
      await changePassword(currentPassword, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('profile.title')}</h1>
        <p className="text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('profile.profileInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{t('profile.profileUpdated')}</span>
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.username')}
                </label>
                <Input
                  id="username"
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('profile.usernameCannotChange')}</p>
              </div>

              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.displayName')}
                </label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('profile.enterDisplayName')}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {t('profile.email')}
                  </span>
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('profile.enterEmail')}
                  required
                />
              </div>

              <div>
                <label htmlFor="locale" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.locale')}
                </label>
                <select
                  id="locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as 'en' | 'pt')}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="en">{t('auth.localeEn')}</option>
                  <option value="pt">{t('auth.localePt')}</option>
                </select>
              </div>

              <Button type="submit" disabled={profileLoading} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {profileLoading ? t('common.saving') : t('profile.saveChanges')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t('profile.changePassword')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {passwordError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{t('profile.passwordUpdated')}</span>
                </div>
              )}

              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.currentPassword')}
                </label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('profile.enterCurrentPassword')}
                  required
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.newPassword')}
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('profile.enterNewPassword')}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('profile.passwordHint')}</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.confirmNewPassword')}
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('profile.confirmNewPasswordPlaceholder')}
                  required
                />
              </div>

              <Button type="submit" disabled={passwordLoading} className="w-full">
                <Lock className="h-4 w-4 mr-2" />
                {passwordLoading ? t('profile.updatingPassword') : t('profile.updatePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
