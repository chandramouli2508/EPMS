import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { TokenPayload } from '../token.service';

describe('JWT session revocation', () => {
  const payload = { sub: 'employee-1', familyId: 'family-1' } as TokenPayload;

  // validate() is called after Passport verifies the signature; exercise its DB checks directly.
  function setup(session: { id: string } | null) {
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    const prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: payload.sub, status: 'ACTIVE' }) },
      refreshToken: { findFirst: jest.fn().mockResolvedValue(session) },
    };
    const permissions = { resolvePermissionsForEmployee: jest.fn().mockResolvedValue({ roles: [], permissions: {} }) };
    Object.assign(strategy, { prisma, permissionResolver: permissions });
    return { strategy, prisma, permissions };
  }

  it('rejects an otherwise valid access token after its session is revoked', async () => {
    const { strategy, permissions } = setup(null);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    expect(permissions.resolvePermissionsForEmployee).not.toHaveBeenCalled();
  });

  it('accepts an active session belonging to the employee', async () => {
    const { strategy, prisma } = setup({ id: 'refresh-1' });
    await expect(strategy.validate(payload)).resolves.toMatchObject({ id: payload.sub, familyId: payload.familyId });
    expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith({
      where: { employeeId: payload.sub, familyId: payload.familyId, revokedAt: null, rotatedAt: null, expiresAt: { gt: expect.any(Date) } },
      select: { id: true },
    });
  });
});
