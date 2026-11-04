// apps/web/src/app/layouts/AppLayout.tsx
import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { usePermissions } from '@/shared/permissions';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', permission: 'reports.view' },
  { name: 'Projects', path: '/projects', permission: 'projects.view' },
  { name: 'Timesheets', path: '/timesheets', permission: 'timesheets.view' },
  { name: 'Team', path: '/team', permission: 'organization.view' },
  { name: 'Reports', path: '/reports', permission: 'reports.view' },
  { name: 'Roles & Permissions', path: '/settings', permission: 'roles.view' },
];

export function AppLayout() {
  const { logout } = useAuth();
  const permissions = usePermissions();
  const canViewEmployees = permissions.can('employees.view');
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError('');
    try {
      await logout();
    } catch {
      setLogoutError('Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-50">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-900 text-white flex flex-col border-r border-surface-800 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-surface-800 space-x-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
            E
          </div>
          <span className="font-bold text-lg tracking-tight text-white">EPMS</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {canViewEmployees && (
            <NavLink
              to="/employees"
              className={({ isActive }) =>
                `flex items-center rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-primary-600 text-white' : 'text-surface-300 hover:bg-surface-800'}`
              }
            >
              Employees
            </NavLink>
          )}
          {NAV_ITEMS.filter((item) =>
            item.path === '/settings' ? permissions.isAdmin : permissions.can(item.permission),
          ).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-800">
          <button
            onClick={() => void handleLogout()}
            disabled={signingOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-surface-400 hover:text-danger hover:bg-surface-800 transition-colors"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
          {logoutError && (
            <p role="alert" className="px-3 text-sm text-red-300">
              {logoutError}
            </p>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-8 shadow-sm">
          <div className="text-sm font-medium text-surface-500">
            Engineering Project Management System
          </div>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-600 border border-success/20">
              Session Active
            </span>
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center text-xs">
              EP
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
