import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Upload = lazy(() => import('./pages/Upload'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Categories = lazy(() => import('./pages/Categories'));
const WorkspaceSettings = lazy(() => import('./pages/WorkspaceSettings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Reports = lazy(() => import('./pages/Reports'));
const Recurring = lazy(() => import('./pages/Recurring'));
const Profile = lazy(() => import('./pages/Profile'));
const Invitations = lazy(() => import('./pages/Invitations'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireWorkspace({ children }: { children: React.ReactNode }) {
  const { workspaces, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return <Navigate to="/workspaces" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <Routes>
              {/* Auth routes - no layout */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* App routes - with layout, protected */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <WorkspaceProvider>
                      <Layout>
                        <ErrorBoundary>
                          <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                            <Routes>
                              <Route path="/" element={<RequireWorkspace><Dashboard /></RequireWorkspace>} />
                              <Route path="/upload" element={<RequireWorkspace><Upload /></RequireWorkspace>} />
                              <Route path="/transactions" element={<RequireWorkspace><Transactions /></RequireWorkspace>} />
                              <Route path="/categories" element={<RequireWorkspace><Categories /></RequireWorkspace>} />
                              <Route path="/reports" element={<RequireWorkspace><Reports /></RequireWorkspace>} />
                              <Route path="/recurring" element={<RequireWorkspace><Recurring /></RequireWorkspace>} />
                              <Route path="/workspaces" element={<WorkspaceSettings />} />
                              <Route path="/profile" element={<Profile />} />
                              <Route path="/invitations" element={<Invitations />} />
                            </Routes>
                          </Suspense>
                        </ErrorBoundary>
                      </Layout>
                    </WorkspaceProvider>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
