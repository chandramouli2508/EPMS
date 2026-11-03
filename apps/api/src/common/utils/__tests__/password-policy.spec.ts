import * as argon2 from 'argon2';
import {
  checkPasswordHistory,
  validatePasswordPolicy,
} from '../password-policy';

describe('Password Policy & History Utilities', () => {
  describe('validatePasswordPolicy', () => {
    it('should reject passwords shorter than 12 characters', () => {
      const res = validatePasswordPolicy('Short1!Aa');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('at least 12 characters');
    });

    it('should reject passwords without uppercase letter', () => {
      const res = validatePasswordPolicy('lowercase123!@#');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('uppercase');
    });

    it('should reject passwords without lowercase letter', () => {
      const res = validatePasswordPolicy('UPPERCASE123!@#');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('lowercase');
    });

    it('should reject passwords without number', () => {
      const res = validatePasswordPolicy('NoNumbersHere!@#');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('number');
    });

    it('should reject passwords without special character', () => {
      const res = validatePasswordPolicy('NoSpecialChar123');
      expect(res.valid).toBe(false);
      expect(res.message).toContain('special character');
    });

    it('should accept valid passwords meeting all criteria', () => {
      const res = validatePasswordPolicy('StrongPassw0rd!#');
      expect(res.valid).toBe(true);
      expect(res.message).toBeUndefined();
    });
  });

  describe('checkPasswordHistory', () => {
    it('should return false if new password matches any recent password hash', async () => {
      const hash1 = await argon2.hash('OldPassword123!', { type: argon2.argon2id });
      const hash2 = await argon2.hash('AnotherPass123!', { type: argon2.argon2id });

      const notReused = await checkPasswordHistory('OldPassword123!', [hash1, hash2]);
      expect(notReused).toBe(false);
    });

    it('should return true if new password does not match any recent password hash', async () => {
      const hash1 = await argon2.hash('OldPassword123!', { type: argon2.argon2id });
      const hash2 = await argon2.hash('AnotherPass123!', { type: argon2.argon2id });

      const notReused = await checkPasswordHistory('BrandNewPassword123!', [hash1, hash2]);
      expect(notReused).toBe(true);
    });
  });
});
