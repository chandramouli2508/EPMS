// apps/web/src/features/auth/pages/ForgotPasswordPage.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-surface-900 mb-1">Reset your password</h2>
      <p className="text-sm text-surface-500 mb-6">We will send a reset link to your email</p>

      {submitted ? (
        <div className="bg-success-50 text-success-600 p-4 rounded-lg text-sm border border-success/20 mb-4">
          If an account exists for {email}, a password reset link has been dispatched.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-surface-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="engineer@consultancy.com"
              required
              className="w-full px-3.5 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm"
          >
            Send reset link
          </button>
        </form>
      )}

      <div className="mt-4 text-center">
        <Link to="/login" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
