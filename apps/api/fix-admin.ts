// Explicit administrator recovery: reset to the configured seed credentials.
import * as path from 'path';
import * as dotenv from 'dotenv';
// Docker injects environment variables; local recovery reads the root .env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { validatePasswordPolicy } from './src/common/utils/password-policy';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env');
  }

  const policy = validatePasswordPolicy(password);
  if (!policy.valid) throw new Error(policy.message);
  const now = new Date();
  const validityHours = Number(process.env.AUTH_TEMP_PASSWORD_HOURS ?? 72);
  if (!Number.isFinite(validityHours) || validityHours <= 0) {
    throw new Error('AUTH_TEMP_PASSWORD_HOURS must be a positive number');
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const result = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUniqueOrThrow({ where: { email } });
    const isAdmin = await tx.employeeRole.findFirst({
      where: { employeeId: employee.id, role: { code: 'SYSTEM_ADMIN', isActive: true } },
    });
    if (!isAdmin) throw new Error('Recovery is restricted to existing system administrators');
    const updated = await tx.employee.update({
      where: { id: employee.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        deactivatedAt: null,
        mustChangePassword: true,
        tempPasswordExpiresAt: new Date(now.getTime() + validityHours * 3600000),
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await tx.refreshToken.updateMany({
      where: { employeeId: employee.id, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'ADMIN_PASSWORD_RESET' },
    });
    await tx.accountLockout.updateMany({
      where: { employeeId: employee.id, unlockedAt: null },
      data: { unlockedAt: now, unlockReason: 'Backend administrator recovery' },
    });
    await tx.auditLog.create({
      data: {
        actorLabel: 'backend-admin-recovery',
        action: 'users.password.admin_reset',
        entityType: 'Employee',
        entityId: employee.id,
        reason: 'Explicit backend recovery using configured administrator credentials',
        outcome: 'SUCCESS',
      },
    });
    return updated;
  });

  console.log('✓ Admin password updated.');
  console.log('  Email:', result.email);
  console.log('  Status:', result.status);
  console.log('  mustChangePassword:', result.mustChangePassword);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
