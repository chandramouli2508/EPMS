// apps/web/src/features/auth/pages/ChangePasswordPage.tsx
import React, { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { http, ApiError } from '@/shared/api';

interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 12) {
      setError('New password must be at least 12 characters.');
      return;
    }

    setLoading(true);

    try {
      await http.post<ChangePasswordResponse>('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      // Password changed — force re-login so a fresh token (mustChangePassword=false) is issued
      await logout();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const strength = (() => {
    let score = 0;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[a-z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();

  const strengthLabel = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][strength];
  const strengthColor = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-emerald-500'][strength];

  return (
    <div>
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold mb-4">
          <span>⚠</span> Password change required
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-1">Set your new password</h2>
        <p className="text-sm text-surface-500">
          Your account requires a new password before you can continue.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 rounded-lg bg-danger-50 border border-danger/20 text-sm text-red-700 font-medium"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="cp-current"
            className="block text-xs font-semibold uppercase text-surface-700 mb-1"
          >
            Current / Temporary password
          </label>
          <input
            id="cp-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            required
            autoComplete="current-password"
            disabled={loading}
            className="w-full px-3.5 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="cp-new"
            className="block text-xs font-semibold uppercase text-surface-700 mb-1"
          >
            New password
          </label>
          <input
            id="cp-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 12 chars — uppercase, lowercase, number, symbol"
            required
            autoComplete="new-password"
            disabled={loading}
            className="w-full px-3.5 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          />
          {/* Strength bar */}
          {newPassword.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 h-1 mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-colors ${
                      i <= strength ? strengthColor : 'bg-surface-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-surface-500">{strengthLabel}</p>
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="cp-confirm"
            className="block text-xs font-semibold uppercase text-surface-700 mb-1"
          >
            Confirm new password
          </label>
          <input
            id="cp-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            required
            autoComplete="new-password"
            disabled={loading}
            className={`w-full px-3.5 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 ${
              confirmPassword && confirmPassword !== newPassword
                ? 'border-red-400'
                : 'border-surface-300'
            }`}
          />
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>

        <div className="bg-surface-50 rounded-lg p-3 text-xs text-surface-500 space-y-1">
          <p className="font-semibold text-surface-700 mb-1">Password requirements:</p>
          {[
            { label: 'At least 12 characters', ok: newPassword.length >= 12 },
            { label: 'One uppercase letter (A–Z)', ok: /[A-Z]/.test(newPassword) },
            { label: 'One lowercase letter (a–z)', ok: /[a-z]/.test(newPassword) },
            { label: 'One number (0–9)', ok: /[0-9]/.test(newPassword) },
            { label: 'One symbol (!@#$%…)', ok: /[^A-Za-z0-9]/.test(newPassword) },
          ].map((req) => (
            <p key={req.label} className={req.ok ? 'text-green-600' : 'text-surface-400'}>
              {req.ok ? '✓' : '○'} {req.label}
            </p>
          ))}
        </div>

        <button
          id="cp-submit"
          type="submit"
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Updating password…
            </>
          ) : (
            'Set new password'
          )}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void logout().catch(() => setError('Could not sign out. Please try again.'))
              .finally(() => setLoading(false));
          }}
          className="w-full text-xs text-surface-400 hover:text-surface-600 py-2 transition-colors"
        >
          Sign out and log in with a different account
        </button>
      </form>
    </div>
  );
}
