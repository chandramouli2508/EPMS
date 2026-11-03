import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppErrorCode } from '@epms/shared';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';
import { PermissionResolverService } from '../access-control/permission-resolver.service';

export interface TokenPayload {
  sub: string; // employeeId
  email: string;
  fullName: string;
  employeeCode: string;
  mustChangePassword: boolean;
  departmentId?: string | null;
  familyId: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly accessExpiry: string;
  private readonly refreshExpiryDays: number;
  private readonly maxSessions: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditWriter: AuditWriterService,
    private readonly permissionResolver: PermissionResolverService,
  ) {
    const privB64 = this.configService.get<string>('JWT_PRIVATE_KEY_BASE64') ?? '';
    const pubB64 = this.configService.get<string>('JWT_PUBLIC_KEY_BASE64') ?? '';

    this.privateKey = privB64 ? Buffer.from(privB64, 'base64').toString('utf8') : '';
    this.publicKey = pubB64 ? Buffer.from(pubB64, 'base64').toString('utf8') : '';
    this.accessExpiry = this.configService.get<string>('JWT_ACCESS_EXPIRY') ?? '15m';
    this.refreshExpiryDays = Number(this.configService.get<number>('JWT_REFRESH_EXPIRY_DAYS') ?? 7);
    this.maxSessions = Number(this.configService.get<number>('AUTH_MAX_SESSIONS') ?? 5);
  }

  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates an RS256 access token with employee claims.
   */
  public generateAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign(payload, {
      algorithm: 'RS256',
      expiresIn: this.accessExpiry,
      privateKey: this.privateKey,
    });
  }

  /**
   * Verifies an RS256 access token.
   */
  public verifyAccessToken(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token, {
      algorithms: ['RS256'],
      publicKey: this.publicKey,
    });
  }

  /**
   * Creates a new session family upon login.
   * Enforces AUTH_MAX_SESSIONS by revoking the oldest active family when limit is reached.
   */
  async createSession(
    employeeId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; rawRefreshToken: string; expiresAt: Date; familyId: string }> {
    const now = new Date();

    // 1. Check active session families count
    const activeFamilies = await this.prisma.refreshToken.findMany({
      where: {
        employeeId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { issuedAt: 'asc' },
      select: { familyId: true, issuedAt: true },
    });

    // Unique familyIds
    const distinctFamilyIds = Array.from(new Set(activeFamilies.map((f) => f.familyId)));

    if (distinctFamilyIds.length >= this.maxSessions) {
      // Revoke the oldest family
      const oldestFamilyId = distinctFamilyIds[0];
      await this.prisma.refreshToken.updateMany({
        where: { familyId: oldestFamilyId, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: 'MAX_SESSIONS',
        },
      });

      await this.auditWriter.write({
        actorId: employeeId,
        action: 'auth.session.max_limit_revoked',
        entityType: 'RefreshTokenFamily',
        entityId: oldestFamilyId,
        reason: `Exceeded max allowed sessions (${this.maxSessions}). Oldest session revoked.`,
        outcome: 'SUCCESS',
        ipAddress,
        userAgent,
      });
    }

    // 2. Create new family
    const familyId = uuidv4();
    const rawRefreshToken = `${uuidv4()}.${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(now.getTime() + this.refreshExpiryDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        employeeId,
        familyId,
        tokenHash,
        issuedAt: now,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
    });

    const accessToken = this.generateAccessToken({
      sub: employee.id,
      email: employee.email,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      mustChangePassword: employee.mustChangePassword,
      departmentId: employee.departmentId,
      familyId,
    });

    return { accessToken, rawRefreshToken, expiresAt, familyId };
  }

  /**
   * Rotates a refresh token with strict reuse detection.
   * If a rotated or revoked token is presented, revokes the ENTIRE family immediately.
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; newRawRefreshToken: string; expiresAt: Date; employeeId: string }> {
    const now = new Date();
    const tokenHash = this.hashToken(rawRefreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { employee: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid refresh token.',
      });
    }

    // Reuse detection: already rotated or revoked!
    if (tokenRecord.rotatedAt !== null || tokenRecord.revokedAt !== null) {
      this.logger.warn(
        `Security Alert: Refresh token reuse detected for employee ${tokenRecord.employeeId}, family ${tokenRecord.familyId}`,
      );

      // Revoke the entire family
      await this.prisma.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: 'REUSE_DETECTED',
        },
      });

      await this.auditWriter.write({
        actorId: tokenRecord.employeeId,
        actorLabel: tokenRecord.employee.email,
        action: 'auth.token.reuse_detected',
        entityType: 'RefreshTokenFamily',
        entityId: tokenRecord.familyId,
        reason: 'Rotated or revoked token presented again. Entire session family revoked.',
        outcome: 'FAILURE',
        ipAddress,
        userAgent,
      });

      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_TOKEN_REUSED,
        message: 'Security violation: Refresh token reuse detected. All sessions on this device revoked.',
      });
    }

    // Expiration check
    if (tokenRecord.expiresAt < now) {
      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Refresh token has expired.',
      });
    }

    // Employee active status check
    if (tokenRecord.employee.status !== 'ACTIVE') {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { revokedAt: now, revokedReason: 'DEACTIVATED' },
      });

      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Account is inactive.',
      });
    }

    // ─── Valid rotation ─────────────────────────────────────────────────────
    const newRawRefreshToken = `${uuidv4()}.${crypto.randomBytes(32).toString('hex')}`;
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const expiresAt = new Date(now.getTime() + this.refreshExpiryDays * 24 * 60 * 60 * 1000);

    // Atomically mark old token as rotated and insert new token
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { rotatedAt: now },
      });

      await tx.refreshToken.create({
        data: {
          employeeId: tokenRecord.employeeId,
          familyId: tokenRecord.familyId,
          tokenHash: newTokenHash,
          issuedAt: now,
          expiresAt,
          userAgent: userAgent ?? tokenRecord.userAgent,
          ipAddress: ipAddress ?? tokenRecord.ipAddress,
        },
      });
    });

    const accessToken = this.generateAccessToken({
      sub: tokenRecord.employee.id,
      email: tokenRecord.employee.email,
      fullName: tokenRecord.employee.fullName,
      employeeCode: tokenRecord.employee.employeeCode,
      mustChangePassword: tokenRecord.employee.mustChangePassword,
      departmentId: tokenRecord.employee.departmentId,
      familyId: tokenRecord.familyId,
    });

    return {
      accessToken,
      newRawRefreshToken,
      expiresAt,
      employeeId: tokenRecord.employeeId,
    };
  }

  /**
   * Revokes a specific session family (e.g. on user logout).
   */
  async revokeFamily(familyId: string, reason = 'LOGOUT'): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  /**
   * Revokes all session families for an employee (e.g. on logout-all, deactivation, password reset).
   */
  async revokeAllEmployeeSessions(employeeId: string, reason = 'LOGOUT_ALL'): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { employeeId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }
}
