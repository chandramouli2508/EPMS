// apps/web/src/app/router.tsx
import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { AuthLayout } from './layouts/AuthLayout';
import { AppLayout } from './layouts/AppLayout';
import { usePermissions } from '@/shared/permissions';

// ─── Lazy Loaded Feature Pages ───────────────────────────────────────────────
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const ChangePasswordPage = lazy(() => import('@/features/auth/pages/ChangePasswordPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const ProjectsListPage = lazy(() => import('@/features/projects/pages/ProjectsListPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/pages/ProjectDetailPage'));
const TimesheetsPage = lazy(() => import('@/features/timesheets/pages/TimesheetsPage'));
const TeamPage = lazy(() => import('@/features/team/pages/TeamPage'));
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const EmployeeListPage = lazy(() =>
  import('@/features/employees').then((module) => ({ default: module.EmployeeListPage })),
);
const AddEmployeePage = lazy(() =>
  import('@/features/employees').then((module) => ({ default: module.AddEmployeePage })),
);

/**
 * Loading fallback while lazy-loaded chunks resolve
 */
function PageLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-surface-400">Loading module...</span>
      </div>
    </div>
  );
}

/**
 * Route guard that validates authentication status:
 * - 'loading': waits for initial refresh-cookie verification
 * - 'unauthenticated': redirects to /login preserving current location
 * - 'authenticated': renders protected child routes
 */
export function ProtectedRoute({
  children,
  permission,
  adminOnly = false,
}: {
  children?: React.ReactNode;
  permission?: string;
  adminOnly?: boolean;
}) {
  const { status } = useAuth();
  const location = useLocation();
  const permissions = usePermissions();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (permission || adminOnly) {
    if (permissions.isPending)
      return (
        <p role="status" className="p-8">
          Checking permissions...
        </p>
      );
    if (permissions.error)
      return (
        <div role="alert" className="p-8">
          Could not check access. <button onClick={() => void permissions.refetch()}>Retry</button>
        </div>
      );
    if ((adminOnly && !permissions.isAdmin) || (permission && !permissions.can(permission)))
      return (
        <p role="alert" className="p-8">
          You do not have permission to access this page.
        </p>
      );
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Change-password — requires JWT but no other permission (mustChangePassword gate) */}
        <Route
          element={
            <ProtectedRoute>
              <AuthLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>

        {/* Protected application routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRoute />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute permission="reports.view">
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute permission="projects.view">
                <ProjectsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute permission="projects.view">
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timesheets"
            element={
              <ProtectedRoute permission="timesheets.view">
                <TimesheetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute permission="organization.view">
                <TeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute permission="reports.view">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute adminOnly>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute permission="employees.view">
                <EmployeeListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/new"
            element={
              <ProtectedRoute permission="employees.create">
                <AddEmployeePage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function HomeRoute() {
  const permissions = usePermissions();
  if (permissions.isPending) return <p role="status">Checking access...</p>;
  if (permissions.error)
    return (
      <div role="alert">
        Could not check access. <button onClick={() => void permissions.refetch()}>Retry</button>
      </div>
    );
  const pages = [
    ['reports.view', '/dashboard'],
    ['projects.view', '/projects'],
    ['timesheets.view', '/timesheets'],
    ['employees.view', '/employees'],
    ['organization.view', '/team'],
  ];
  const target = permissions.isAdmin
    ? '/dashboard'
    : pages.find(([key]) => permissions.can(key))?.[1];
  return target ? (
    <Navigate to={target} replace />
  ) : (
    <p role="status">
      No application access has been assigned. Contact your administrator to assign a role.
    </p>
  );
}
