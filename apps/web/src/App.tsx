// apps/web/src/App.tsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { ToastProvider, ToastBridge } from '@/shared/ui';
import { AppRoutes } from '@/app/router';

export function App() {
  return (
    <QueryProvider>
      <ToastProvider>
        <ToastBridge />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryProvider>
  );
}

export default App;
