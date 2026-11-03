// apps/web/src/features/projects/pages/ProjectDetailPage.tsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-surface-500">
        <Link to="/projects" className="hover:text-primary-600">Projects</Link>
        <span>/</span>
        <span className="font-mono text-surface-900 font-medium">{projectId}</span>
      </div>

      <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-card">
        <h1 className="text-xl font-bold text-surface-900 mb-2">Project Details: {projectId}</h1>
        <p className="text-sm text-surface-600">
          Full project workspace (WBS, task assignments, deliverables, budget tracking) will be implemented in Phase 2.
        </p>
      </div>
    </div>
  );
}
