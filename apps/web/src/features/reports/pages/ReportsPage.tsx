// apps/web/src/features/reports/pages/ReportsPage.tsx
import React from 'react';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Engineering Reports</h1>
      <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-card">
        <p className="text-sm text-surface-600">Excel export/import (ExcelJS + BullMQ background jobs) active in Phase 4.</p>
      </div>
    </div>
  );
}
