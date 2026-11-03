import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppErrorCode, CurrentUserDto } from '@epms/shared';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';
import { PermissionResolverService } from '../access-control/permission-resolver.service';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  checkPasswordHistory,
  validatePasswordPolicy,
} from '../../common/utils/password-policy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditWriter: AuditWriterService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly configService: ConfigService,
  ) {
    this.maxFailedAttempts = Number(
      this.configService.get<number>('AUTH_MAX_FAILED_ATTEMPTS') ?? 5,
    );
    this.lockoutMinutes = Number(
      this.configService.get<number>('AUTH_LOCKOUT_MINUTES') ?? 15,
    );
  }

  /**
   * Builds the clean CurrentUserDto response.
   */
  private async buildUserContext(employeeId: string): Promise<CurrentUserDto> {
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: {
        department: true,
        designation: true,
      },
    });

    const { roles, permissions } =
      await this.permissionResolver.resolvePermissionsForEmployee(employee.id);

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      mustChangePassword: employee.mustChangePassword,
      departmentId: employee.departmentId,
      designationId: employee.designationId,
      roles,
      permissions,
    };
  }

  /**
   * Authenticates an employee and issues tokens.
   */
  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{
    accessToken: string;
    rawRefreshToken: string;
    expiresAt: Date;
    user: CurrentUserDto;
  }> {
    const now = new Date();
    const email = dto.email.trim().toLowerCase();

    const employee = await this.prisma.employee.findUnique({
      where: { email },
    });

    // Generic error to prevent email enumeration
    if (!employee || employee.status !== 'ACTIVE') {
      await this.auditWriter.write({
        actorLabel: email,
        action: 'auth.login.failed',
        entityType: 'Employee',
        reason: 'Unknown email or inactive account',
        outcome: 'FAILURE',
        ipAddress,
        userAgent,
      });

      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    // ─── Account Lockout Check ────────────────────────────────────────────────
    if (employee.lockedUntil && employee.lockedUntil > now) {
      const remainingMinutes = Math.ceil(
        (employee.lockedUntil.getTime() - now.getTime()) / 60000,
      );

      await this.auditWriter.write({
        actorId: employee.id,
        actorLabel: employee.email,
        action: 'auth.login.blocked_locked',
        entityType: 'Employee',
        entityId: employee.id,
        reason: `Account locked for another ${remainingMinutes} minutes`,
        outcome: 'FAILURE',
        ipAddress,
        userAgent,
      });

      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_ACCOUNT_LOCKED,
        message: `Account is locked. Try again in ${remainingMinutes} minute(s).`,
      });
    }

    // ─── Verify Password ──────────────────────────────────────────────────────
    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(employee.passwordHash, dto.password);
    } catch {
      passwordValid = false;
    }

    if (!passwordValid) {
      const newFailedAttempts = employee.failedLoginAttempts + 1;

      if (newFailedAttempts >= this.maxFailedAttempts) {
        const lockedUntil = new Date(now.getTime() + this.lockoutMinutes * 60000);

        await this.prisma.$transaction(async (tx) => {
          await tx.employee.update({
            where: { id: employee.id },
            data: {
              failedLoginAttempts: newFailedAttempts,
              lockedUntil,
            },
          });

          await tx.accountLockout.create({
            data: {
              employeeId: employee.id,
              lockedAt: now,
              lockedUntil,
              failedAttempts: newFailedAttempts,
              ipAddress,
              reason: 'TOO_MANY_FAILED_ATTEMPTS',
            },
          });

          await this.auditWriter.write(
            {
              actorId: employee.id,
              actorLabel: employee.email,
              action: 'auth.account.locked',
              entityType: 'Employee',
              entityId: employee.id,
              reason: `Consecutive failed login attempts reached limit (${newFailedAttempts}). Locked until ${lockedUntil.toISOString()}`,
              outcome: 'FAILURE',
              ipAddress,
              userAgent,
            },
            tx,
          );
        });

        throw new UnauthorizedException({
          code: AppErrorCode.AUTH_ACCOUNT_LOCKED,
          message: `Account has been locked due to ${newFailedAttempts} consecutive failed login attempts. Try again in ${this.lockoutMinutes} minutes.`,
        });
      } else {
        await this.prisma.employee.update({
          where: { id: employee.id },
          data: { failedLoginAttempts: newFailedAttempts },
        });

        await this.auditWriter.write({
          actorId: employee.id,
          actorLabel: employee.email,
          action: 'auth.login.failed',
          entityType: 'Employee',
          entityId: employee.id,
          reason: `Invalid password attempt (${newFailedAttempts}/${this.maxFailedAttempts})`,
          outcome: 'FAILURE',
          ipAddress,
          userAgent,
        });

        throw new UnauthorizedException({
          code: AppErrorCode.AUTH_INVALID_CREDENTIALS,
          message: 'Invalid email or password.',
        });
      }
    }

    // ─── Temporary Password Expiration Check ─────────────────────────────────
    if (
      employee.mustChangePassword &&
      employee.tempPasswordExpiresAt &&
      employee.tempPasswordExpiresAt < now
    ) {
      await this.auditWriter.write({
        actorId: employee.id,
        actorLabel: employee.email,
        action: 'auth.login.temp_password_expired',
        entityType: 'Employee',
        entityId: employee.id,
        reason: 'Temporary password expired before first login',
        outcome: 'FAILURE',
        ipAddress,
        userAgent,
      });

      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_TEMP_PASSWORD_EXPIRED,
        message: 'Temporary password has expired. Please contact an administrator to reset your password.',
      });
    }

    // ─── Login Success ────────────────────────────────────────────────────────
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    const session = await this.tokenService.createSession(
      employee.id,
      userAgent,
      ipAddress,
    );

    await this.auditWriter.write({
      actorId: employee.id,
      actorLabel: employee.email,
      action: 'auth.login.success',
      entityType: 'Employee',
      entityId: employee.id,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    const user = await this.buildUserContext(employee.id);

    return {
      accessToken: session.accessToken,
      rawRefreshToken: session.rawRefreshToken,
      expiresAt: session.expiresAt,
      user,
    };
  }

  /**
   * Refreshes access token with rotation.
   */
  async refresh(
    rawRefreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{
    accessToken: string;
    newRawRefreshToken: string;
    expiresAt: Date;
    user: CurrentUserDto;
  }> {
    const result = await this.tokenService.rotateRefreshToken(
      rawRefreshToken,
      userAgent,
      ipAddress,
    );

    const user = await this.buildUserContext(result.employeeId);

    return {
      accessToken: result.accessToken,
      newRawRefreshToken: result.newRawRefreshToken,
      expiresAt: result.expiresAt,
      user,
    };
  }

  /**
   * Changes the authenticated employee's password.
   * Validates policy, checks 3-password history, clears mustChangePassword.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string }> {
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id: userId },
      include: {
        passwordHistory: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    });

    // 1. Verify current password
    let validCurrent = false;
    try {
      validCurrent = await argon2.verify(
        employee.passwordHash,
        dto.currentPassword,
      );
    } catch {
      validCurrent = false;
    }

    if (!validCurrent) {
      throw new BadRequestException({
        code: AppErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Current password is incorrect.',
      });
    }

    // 2. Validate password policy
    const policyResult = validatePasswordPolicy(dto.newPassword);
    if (!policyResult.valid) {
      throw new BadRequestException({
        code: AppErrorCode.PASSWORD_POLICY_VIOLATION,
        message: policyResult.message,
      });
    }

    // 3. Check password history (current + last 3)
    const historyHashes = [
      employee.passwordHash,
      ...employee.passwordHistory.map((h) => h.passwordHash),
    ];

    const notReused = await checkPasswordHistory(
      dto.newPassword,
      historyHashes,
    );
    if (!notReused) {
      throw new BadRequestException({
        code: AppErrorCode.PASSWORD_REUSE_FORBIDDEN,
        message: 'You cannot reuse any of your last 3 passwords.',
      });
    }

    // 4. Hash new password & update in transaction
    const newPasswordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
          passwordChangedAt: now,
        },
      });

      await tx.passwordHistory.create({
        data: {
          employeeId: employee.id,
          passwordHash: newPasswordHash,
          createdAt: now,
        },
      });

      await this.auditWriter.write(
        {
          actorId: employee.id,
          actorLabel: employee.email,
          action: 'auth.password.changed',
          entityType: 'Employee',
          entityId: employee.id,
          reason: 'Employee changed password',
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return { success: true, message: 'Password changed successfully.' };
  }

  /**
   * Logs out current device family.
   */
  async logout(
    familyId?: string,
    actorId?: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    if (familyId) {
      await this.tokenService.revokeFamily(familyId, 'LOGOUT');
    }

    await this.auditWriter.write({
      actorId: actorId ?? null,
      action: 'auth.logout',
      entityType: 'Session',
      entityId: familyId ?? null,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
    });
  }

  /**
   * Logs out all devices for the current employee.
   */
  async logoutAll(
    employeeId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.tokenService.revokeAllEmployeeSessions(employeeId, 'LOGOUT_ALL');

    await this.auditWriter.write({
      actorId: employeeId,
      action: 'auth.logout_all',
      entityType: 'Employee',
      entityId: employeeId,
      reason: 'User revoked all sessions across all devices',
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
    });
  }

  /**
   * Retrieves the current user's full context (for GET /auth/me).
   */
  async getMe(userId: string): Promise<CurrentUserDto> {
    return this.buildUserContext(userId);
  }
}
