// apps/web/src/features/settings/pages/SettingsPage.tsx
import React from 'react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900 tracking-tight">System Settings</h1>
      <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-card">
        <p className="text-sm text-surface-600">Company parameters, rate cards, and RBAC permission tables.</p>
      </div>
    </div>
  );
}
