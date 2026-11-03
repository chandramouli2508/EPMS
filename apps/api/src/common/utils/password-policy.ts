import * as argon2 from 'argon2';

export interface PasswordPolicyResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates a password against EPMS policy:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one symbol / special character
 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (!password || password.length < 12) {
    return {
      valid: false,
      message: 'Password must be at least 12 characters long.',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter.',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter.',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number.',
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one special character or symbol.',
    };
  }

  return { valid: true };
}

/**
 * Checks if the proposed new password matches any of the recent password hashes (max 3).
 * Returns true if valid (not reused), false if reused.
 */
export async function checkPasswordHistory(
  newPassword: string,
  historyHashes: string[],
): Promise<boolean> {
  for (const hash of historyHashes) {
    try {
      const match = await argon2.verify(hash, newPassword);
      if (match) {
        return false; // Reused!
      }
    } catch {
      // Ignore malformed hashes
    }
  }
  return true;
}
