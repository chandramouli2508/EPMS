// apps/web/src/app/pages/NotFoundPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-surface-200 text-surface-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
          404
        </div>
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Page not found</h1>
        <p className="text-surface-500 text-sm mb-6">
          The requested page does not exist or has been relocated.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
