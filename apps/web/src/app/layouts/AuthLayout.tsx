// apps/web/src/app/layouts/AuthLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white font-bold text-xl shadow-card">
            E
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-surface-900">EPMS</h1>
            <p className="text-xs text-surface-500 font-medium">Engineering Consultancy Suite</p>
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-card rounded-2xl sm:px-10 border border-surface-200">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
