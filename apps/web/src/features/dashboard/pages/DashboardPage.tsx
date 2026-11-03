// apps/web/src/features/dashboard/pages/DashboardPage.tsx
import React from 'react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-surface-500">Engineering projects overview & real-time team metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[
          { label: 'Active Projects', value: '42', change: '+3 this month' },
          { label: 'Billable Hours', value: '1,280 hrs', change: '84% target' },
          { label: 'Active Teams', value: '6 Teams', change: 'HVAC, Elec, Fire, Plumb' },
          { label: 'Open Invoices', value: '$184,200', change: '12 pending review' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-surface-200 shadow-card">
            <div className="text-xs font-semibold uppercase text-surface-400 mb-1">{card.label}</div>
            <div className="text-2xl font-bold text-surface-900 mb-1">{card.value}</div>
            <div className="text-xs text-primary-600 font-medium">{card.change}</div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-card">
        <h2 className="text-base font-semibold text-surface-900 mb-2">Phase 0 Status</h2>
        <p className="text-sm text-surface-600">
          Core web application foundation successfully initialized with React 18, React Router 6, TanStack Query 5, Tailwind CSS, and in-memory JWT authentication transport.
        </p>
      </div>
    </div>
  );
}
