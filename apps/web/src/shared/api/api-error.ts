// apps/web/src/shared/api/api-error.ts
// Typed error class and normalization utility.
// All components read error.code — they never parse message strings.

import axios from 'axios';
import type { ApiErrorEnvelope } from '@epms/shared';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    /** Field-level validation errors, keyed by field name */
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly path?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    // Maintain correct prototype chain for `instanceof` checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Converts any thrown value into an ApiError.
 *
 * Maps the backend error envelope { statusCode, error, message, timestamp, path, fieldErrors }
 * and distinguishes network failures from server errors.
 */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (axios.isAxiosError(err)) {
    // Timeout
    if (err.code === 'ECONNABORTED') {
      return new ApiError(0, 'TIMEOUT', 'The request timed out. Please try again.');
    }

    // No response — server unreachable
    if (!err.response) {
      return new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
    }

    const d = err.response.data as Partial<ApiErrorEnvelope>;

    return new ApiError(
      err.response.status,
      d?.error ?? 'UNKNOWN_ERROR',
      Array.isArray(d?.message) ? (d.message as string[]).join(', ') : d?.message ?? 'Something went wrong.',
      d?.fieldErrors,
      d?.path,
    );
  }

  if (err instanceof Error) {
    return new ApiError(0, 'UNKNOWN_ERROR', err.message);
  }

  return new ApiError(0, 'UNKNOWN_ERROR', 'An unexpected error occurred.');
}
