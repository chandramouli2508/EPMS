// apps/web/src/features/projects/pages/ProjectsListPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function ProjectsListPage() {
  const mockProjects = [
    { id: 'PRJ-2026-001', name: 'Downtown Commercial HVAC Overhaul', client: 'Apex Properties', discipline: 'HVAC', status: 'In Progress' },
    { id: 'PRJ-2026-002', name: 'Westfield Substation Switchgear Upgrade', client: 'Metro Utilities', discipline: 'Electrical', status: 'Planning' },
    { id: 'PRJ-2026-003', name: 'Bayview Medical Fire Sprinkler Retrofit', client: 'HealthCorp', discipline: 'Fire Protection', status: 'Review' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Engineering Projects</h1>
          <p className="text-sm text-surface-500">Manage 500–600 annual multidisciplinary projects</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-surface-200 shadow-card overflow-hidden">
        <table className="min-w-full divide-y divide-surface-200 text-left text-sm">
          <thead className="bg-surface-50 text-surface-500 uppercase text-xs">
            <tr>
              <th className="px-6 py-3 font-semibold">Project Code</th>
              <th className="px-6 py-3 font-semibold">Project Name</th>
              <th className="px-6 py-3 font-semibold">Client</th>
              <th className="px-6 py-3 font-semibold">Discipline</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200">
            {mockProjects.map((p) => (
              <tr key={p.id} className="hover:bg-surface-50/50">
                <td className="px-6 py-4 font-mono font-medium text-primary-600">
                  <Link to={`/projects/${p.id}`} className="hover:underline">
                    {p.id}
                  </Link>
                </td>
                <td className="px-6 py-4 font-medium text-surface-900">{p.name}</td>
                <td className="px-6 py-4 text-surface-600">{p.client}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-surface-100 text-surface-700">
                    {p.discipline}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary/20">
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
