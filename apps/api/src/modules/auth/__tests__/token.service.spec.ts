import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppErrorCode } from '@epms/shared';
import * as crypto from 'crypto';
import { TokenService } from '../token.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditWriterService } from '../../../infrastructure/audit/audit-writer.service';
import { PermissionResolverService } from '../../access-control/permission-resolver.service';

describe('TokenService', () => {
  let service: TokenService;
  let prismaMock: {
    refreshToken: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    employee: { findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditWriterMock: { write: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      refreshToken: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      employee: {
        findUniqueOrThrow: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    auditWriterMock = {
      write: jest.fn(),
    };

    const configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_MAX_SESSIONS') return 5;
        if (key === 'JWT_REFRESH_EXPIRY_DAYS') return 7;
        return undefined;
      }),
    } as unknown as ConfigService;

    const jwtServiceMock = {
      sign: jest.fn(() => 'mock-jwt-token'),
      verify: jest.fn(() => ({ sub: 'emp-1' })),
    } as unknown as JwtService;

    const permResolverMock = {} as unknown as PermissionResolverService;

    service = new TokenService(
      prismaMock as unknown as PrismaService,
      jwtServiceMock,
      configServiceMock,
      auditWriterMock as unknown as AuditWriterService,
      permResolverMock,
    );
  });

  describe('rotateRefreshToken', () => {
    it('should detect reuse of already rotated token, revoke family and throw AUTH_TOKEN_REUSED', async () => {
      const rawToken = 'test-token-123';
      const tokenHash = service.hashToken(rawToken);

      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        familyId: 'family-100',
        employeeId: 'emp-1',
        tokenHash,
        rotatedAt: new Date(), // Already rotated!
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        employee: { id: 'emp-1', email: 'test@epms.local', status: 'ACTIVE' },
      });

      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify entire family is revoked
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-100', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'REUSE_DETECTED' }),
      });

      // Verify audit event is written
      expect(auditWriterMock.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.token.reuse_detected',
          entityType: 'RefreshTokenFamily',
          entityId: 'family-100',
          outcome: 'FAILURE',
        }),
      );
    });

    it('should successfully rotate an active unrotated token', async () => {
      const rawToken = 'valid-token-123';
      const tokenHash = service.hashToken(rawToken);

      prismaMock.refreshToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        familyId: 'family-100',
        employeeId: 'emp-1',
        tokenHash,
        rotatedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        employee: {
          id: 'emp-1',
          email: 'test@epms.local',
          status: 'ACTIVE',
          fullName: 'Test User',
          employeeCode: 'EMP-0001',
          mustChangePassword: false,
        },
      });

      const res = await service.rotateRefreshToken(rawToken);

      expect(res.accessToken).toBe('mock-jwt-token');
      expect(res.newRawRefreshToken).toBeDefined();
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'tok-1' },
        data: { rotatedAt: expect.any(Date) },
      });
      expect(prismaMock.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('createSession session limits', () => {
    it('should revoke oldest session family when max sessions limit is reached', async () => {
      prismaMock.refreshToken.findMany.mockResolvedValue([
        { familyId: 'fam-oldest', issuedAt: new Date(1000) },
        { familyId: 'fam-2', issuedAt: new Date(2000) },
        { familyId: 'fam-3', issuedAt: new Date(3000) },
        { familyId: 'fam-4', issuedAt: new Date(4000) },
        { familyId: 'fam-5', issuedAt: new Date(5000) },
      ]);

      prismaMock.employee.findUniqueOrThrow.mockResolvedValue({
        id: 'emp-1',
        email: 'test@epms.local',
        fullName: 'Test',
        employeeCode: 'EMP-1',
        mustChangePassword: false,
      });

      await service.createSession('emp-1');

      // Verify oldest family was revoked
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-oldest', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'MAX_SESSIONS' }),
      });
    });
  });
});
