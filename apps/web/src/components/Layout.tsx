import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, LayoutDashboard, Upload, List, Tag, BarChart3, Repeat, LogIn, LogOut, User, ChevronDown, Mail, MoreHorizontal } from 'lucide-react';
import WorkspaceSelector from './WorkspaceSelector';
import { Button } from './ui/Button';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from './ui/DropdownMenu';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getMyInvitations } from '@/services/api';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, loading, logout } = useAuth();
  const { workspaces, loading: workspaceLoading } = useWorkspace();

  const hasWorkspaces = !workspaceLoading && workspaces.length > 0;

  const primaryNavItems = [
    { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/transactions', label: t('nav.transactions'), icon: List },
    { path: '/upload', label: t('nav.upload'), icon: Upload },
  ];

  const moreNavItems = [
    { path: '/categories', label: t('nav.categories'), icon: Tag },
    { path: '/reports', label: t('nav.reports'), icon: BarChart3 },
    { path: '/recurring', label: t('nav.recurring'), icon: Repeat },
  ];
  const [invitationCount, setInvitationCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchCount = async () => {
      try {
        const invitations = await getMyInvitations();
        setInvitationCount(invitations.length);
      } catch {
        // Silently ignore - notification is non-critical
      }
    };

    fetchCount();
    // Poll every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Workspace Selector */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <Compass className="h-8 w-8 text-primary" />
                <span className="text-xl font-semibold text-gray-900">Compasso</span>
              </Link>
              <div className="hidden sm:block">
                <WorkspaceSelector onManageClick={() => navigate('/workspaces')} />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {hasWorkspaces && (
                <>
                  {primaryNavItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-white'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{item.label}</span>
                      </Link>
                    );
                  })}

                  {/* More dropdown */}
                  <DropdownMenu
                    align="right"
                    trigger={
                      <button
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          moreNavItems.some((item) => location.pathname === item.path)
                            ? 'bg-primary text-white'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('nav.more')}</span>
                      </button>
                    }
                  >
                    {moreNavItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={isActive ? 'bg-gray-100 font-medium' : ''}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenu>
                </>
              )}

              {/* Invitations + User menu */}
              {!loading && (
                <div className="ml-2 pl-2 border-l border-gray-200 flex items-center gap-1">
                  {user && invitationCount > 0 && (
                    <Link
                      to="/invitations"
                      className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                        {invitationCount}
                      </span>
                    </Link>
                  )}
                  {user ? (
                    <DropdownMenu
                      trigger={
                        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                          <User className="h-4 w-4" />
                          <span className="hidden sm:inline">{user.displayName || user.username}</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      }
                    >
                      <DropdownMenuItem onClick={() => navigate('/profile')}>
                        <User className="h-4 w-4" />
                        {t('nav.profile')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/invitations')}>
                        <Mail className="h-4 w-4" />
                        {t('nav.invitations')}
                        {invitationCount > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {invitationCount}
                          </span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} destructive>
                        <LogOut className="h-4 w-4" />
                        {t('nav.logout')}
                      </DropdownMenuItem>
                    </DropdownMenu>
                  ) : (
                    <Link to="/login">
                      <Button variant="ghost" size="sm" className="flex items-center gap-1">
                        <LogIn className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('nav.login')}</span>
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
