import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AppErrorCode, EmployeeDto, SessionDto } from '@epms/shared';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';
import { TokenService } from '../auth/token.service';
import {
  AssignRolesDto,
  CreateEmployeeDto,
  UnlockAccountDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';

function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+';

  let pass = '';
  for (let i = 0; i < 3; i++) pass += upper[crypto.randomInt(upper.length)];
  for (let i = 0; i < 4; i++) pass += lower[crypto.randomInt(lower.length)];
  for (let i = 0; i < 3; i++) pass += digits[crypto.randomInt(digits.length)];
  for (let i = 0; i < 3; i++) pass += symbols[crypto.randomInt(symbols.length)];

  return pass
    .split('')
    .sort(() => crypto.randomInt(3) - 1)
    .join('');
}

@Injectable()
export class EmployeesService {
  private readonly tempPasswordHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {
    this.tempPasswordHours = Number(
      this.configService.get<number>('AUTH_TEMP_PASSWORD_HOURS') ?? 72,
    );
  }

  /**
   * Generates a safe concurrent sequential employee code (EMP-0002 onward).
   */
  async generateNextEmployeeCode(tx: Prisma.TransactionClient): Promise<string> {
    // Acquire a transaction-level advisory lock to prevent race conditions during generation
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(42001);`;

    const employees = await tx.employee.findMany({
      select: { employeeCode: true },
      where: { employeeCode: { startsWith: 'EMP-' } },
    });

    let maxNum = 1;
    for (const emp of employees) {
      const match = emp.employeeCode.match(/^EMP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    return `EMP-${nextNum.toString().padStart(4, '0')}`;
  }

  /**
   * Creates a new employee and user account.
   */
  async createEmployee(
    dto: CreateEmployeeDto,
    creatorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ employee: EmployeeDto; tempPassword: string }> {
    const email = dto.email.trim().toLowerCase();

    // Check email uniqueness
    const existingEmail = await this.prisma.employee.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException({
        code: AppErrorCode.EMAIL_ALREADY_EXISTS,
        message: 'An employee with this email already exists.',
      });
    }

    const rawTempPassword = generateTemporaryPassword();
    const passwordHash = await argon2.hash(rawTempPassword, {
      type: argon2.argon2id,
    });
    const now = new Date();
    const tempPasswordExpiresAt = new Date(
      now.getTime() + this.tempPasswordHours * 3600 * 1000,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      let employeeCode = dto.employeeCode?.trim();
      if (employeeCode) {
        const existingCode = await tx.employee.findUnique({
          where: { employeeCode },
        });
        if (existingCode) {
          throw new ConflictException({
            code: AppErrorCode.EMPLOYEE_CODE_ALREADY_EXISTS,
            message: 'Employee code already exists.',
          });
        }
      } else {
        employeeCode = await this.generateNextEmployeeCode(tx);
      }

      const employee = await tx.employee.create({
        data: {
          employeeCode,
          fullName: dto.fullName.trim(),
          email,
          phone: dto.phone ?? null,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
          departmentId: dto.departmentId ?? null,
          designationId: dto.designationId ?? null,
          managerId: dto.managerId ?? null,
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt,
        },
        include: {
          department: true,
          designation: true,
          manager: true,
        },
      });

      // Assign initial roles if provided, or default to EMPLOYEE
      const roleCodes =
        dto.roleCodes && dto.roleCodes.length > 0 ? dto.roleCodes : ['EMPLOYEE'];

      const roles = await tx.role.findMany({
        where: { code: { in: roleCodes }, isActive: true },
      });

      for (const role of roles) {
        await tx.employeeRole.create({
          data: {
            employeeId: employee.id,
            roleId: role.id,
            assignedById: creatorId,
          },
        });
      }

      await this.auditWriter.write(
        {
          actorId: creatorId,
          action: 'employee.create',
          entityType: 'Employee',
          entityId: employee.id,
          newValue: {
            id: employee.id,
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            email: employee.email,
            roles: roles.map((r) => r.code),
          },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return {
        employee: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          email: employee.email,
          phone: employee.phone,
          status: employee.status,
          dateOfJoining: employee.dateOfJoining
            ? employee.dateOfJoining.toISOString().split('T')[0]
            : null,
          departmentId: employee.departmentId,
          departmentName: employee.department?.name ?? null,
          designationId: employee.designationId,
          designationName: employee.designation?.name ?? null,
          managerId: employee.managerId,
          managerName: employee.manager?.fullName ?? null,
          roles: roles.map((r) => r.code),
          mustChangePassword: employee.mustChangePassword,
          failedLoginAttempts: employee.failedLoginAttempts,
          lockedUntil: employee.lockedUntil?.toISOString() ?? null,
          createdAt: employee.createdAt.toISOString(),
          updatedAt: employee.updatedAt.toISOString(),
        },
        tempPassword: rawTempPassword,
      };
    });

    return result;
  }

  /**
   * Retrieves list of employees with search, filters, pagination, and sensitive data masking.
   */
  async getEmployees(params: {
    callerId: string;
    hasViewSensitive: boolean;
    isOwnScopeOnly: boolean;
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    status?: string;
    role?: string;
  }): Promise<{ data: EmployeeDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {};

    // Scope check: If caller only has OWN scope, force filter to callerId
    if (params.isOwnScopeOnly) {
      where.id = params.callerId;
    }

    if (params.status) {
      where.status = params.status as Prisma.EnumEmployeeStatusFilter;
    }

    if (params.departmentId) {
      where.departmentId = params.departmentId;
    }

    if (params.role) {
      where.roles = {
        some: {
          role: { code: params.role },
        },
      };
    }

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employeeCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          designation: true,
          manager: true,
          roles: {
            include: { role: true },
          },
        },
      }),
    ]);

    const data: EmployeeDto[] = records.map((emp) => {
      const isSelf = emp.id === params.callerId;
      const canViewSensitive = isSelf || params.hasViewSensitive;

      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        email: emp.email,
        phone: canViewSensitive ? emp.phone : null,
        status: emp.status,
        dateOfJoining: canViewSensitive && emp.dateOfJoining
          ? emp.dateOfJoining.toISOString().split('T')[0]
          : null,
        departmentId: emp.departmentId,
        departmentName: emp.department?.name ?? null,
        designationId: emp.designationId,
        designationName: emp.designation?.name ?? null,
        managerId: emp.managerId,
        managerName: emp.manager?.fullName ?? null,
        roles: emp.roles.map((r) => r.role.code),
        mustChangePassword: emp.mustChangePassword,
        lastLoginAt: emp.lastLoginAt?.toISOString() ?? null,
        failedLoginAttempts: emp.failedLoginAttempts,
        lockedUntil: emp.lockedUntil?.toISOString() ?? null,
        createdAt: emp.createdAt.toISOString(),
        updatedAt: emp.updatedAt.toISOString(),
      };
    });

    return { data, total, page, limit };
  }

  /**
   * Retrieves single employee details with sensitive data masking.
   */
  async getEmployeeById(
    id: string,
    callerId: string,
    hasViewSensitive: boolean,
    isOwnScopeOnly: boolean,
  ): Promise<EmployeeDto> {
    if (isOwnScopeOnly && callerId !== id) {
      throw new ForbiddenException({
        code: AppErrorCode.PERMISSION_DENIED,
        message: 'You only have permission to view your own employee record.',
      });
    }

    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        designation: true,
        manager: true,
        roles: {
          include: { role: true },
        },
      },
    });

    if (!emp) {
      throw new NotFoundException('Employee not found.');
    }

    const isSelf = emp.id === callerId;
    const canViewSensitive = isSelf || hasViewSensitive;

    return {
      id: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      email: emp.email,
      phone: canViewSensitive ? emp.phone : null,
      status: emp.status,
      dateOfJoining: canViewSensitive && emp.dateOfJoining
        ? emp.dateOfJoining.toISOString().split('T')[0]
        : null,
      departmentId: emp.departmentId,
      departmentName: emp.department?.name ?? null,
      designationId: emp.designationId,
      designationName: emp.designation?.name ?? null,
      managerId: emp.managerId,
      managerName: emp.manager?.fullName ?? null,
      roles: emp.roles.map((r) => r.role.code),
      mustChangePassword: emp.mustChangePassword,
      lastLoginAt: emp.lastLoginAt?.toISOString() ?? null,
      failedLoginAttempts: emp.failedLoginAttempts,
      lockedUntil: emp.lockedUntil?.toISOString() ?? null,
      createdAt: emp.createdAt.toISOString(),
      updatedAt: emp.updatedAt.toISOString(),
    };
  }

  /**
   * Updates employee profile details.
   */
  async updateEmployee(
    id: string,
    dto: UpdateEmployeeDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<EmployeeDto> {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Employee not found.');
    }

    const updateData: Prisma.EmployeeUpdateInput = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.dateOfJoining !== undefined) {
      updateData.dateOfJoining = dto.dateOfJoining ? new Date(dto.dateOfJoining) : null;
    }
    if (dto.departmentId !== undefined) {
      updateData.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }
    if (dto.designationId !== undefined) {
      updateData.designation = dto.designationId
        ? { connect: { id: dto.designationId } }
        : { disconnect: true };
    }
    if (dto.managerId !== undefined) {
      updateData.manager = dto.managerId
        ? { connect: { id: dto.managerId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: updateData,
        include: {
          department: true,
          designation: true,
          manager: true,
          roles: { include: { role: true } },
        },
      });

      await this.auditWriter.write(
        {
          actorId,
          action: 'employee.update',
          entityType: 'Employee',
          entityId: emp.id,
          previousValue: {
            fullName: existing.fullName,
            phone: existing.phone,
            departmentId: existing.departmentId,
            designationId: existing.designationId,
            managerId: existing.managerId,
          },
          newValue: {
            fullName: emp.fullName,
            phone: emp.phone,
            departmentId: emp.departmentId,
            designationId: emp.designationId,
            managerId: emp.managerId,
          },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return emp;
    });

    return {
      id: updated.id,
      employeeCode: updated.employeeCode,
      fullName: updated.fullName,
      email: updated.email,
      phone: updated.phone,
      status: updated.status,
      dateOfJoining: updated.dateOfJoining
        ? updated.dateOfJoining.toISOString().split('T')[0]
        : null,
      departmentId: updated.departmentId,
      departmentName: updated.department?.name ?? null,
      designationId: updated.designationId,
      designationName: updated.designation?.name ?? null,
      managerId: updated.managerId,
      managerName: updated.manager?.fullName ?? null,
      roles: updated.roles.map((r) => r.role.code),
      mustChangePassword: updated.mustChangePassword,
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
      failedLoginAttempts: updated.failedLoginAttempts,
      lockedUntil: updated.lockedUntil?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Deactivates an employee account and revokes all active sessions.
   * Enforces protection: The last active SYSTEM_ADMIN cannot be deactivated!
   */
  async deactivateEmployee(
    id: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    if (employee.status === 'INACTIVE') {
      return { success: true, message: 'Employee is already inactive.' };
    }

    // Protection check: Last active SYSTEM_ADMIN
    const isSystemAdmin = employee.roles.some((r) => r.role.code === 'SYSTEM_ADMIN');
    if (isSystemAdmin) {
      const otherActiveAdminsCount = await this.prisma.employee.count({
        where: {
          id: { not: id },
          status: 'ACTIVE',
          roles: {
            some: {
              role: { code: 'SYSTEM_ADMIN' },
            },
          },
        },
      });

      if (otherActiveAdminsCount === 0) {
        throw new ForbiddenException({
          code: AppErrorCode.LAST_ADMIN_PROTECTED,
          message: 'The last active System Administrator cannot be deactivated.',
        });
      }
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          deactivatedAt: now,
        },
      });

      await this.tokenService.revokeAllEmployeeSessions(id, 'DEACTIVATED');

      await this.auditWriter.write(
        {
          actorId,
          action: 'employee.deactivate',
          entityType: 'Employee',
          entityId: id,
          previousValue: { status: 'ACTIVE' },
          newValue: { status: 'INACTIVE' },
          reason: 'Employee deactivated by administrator',
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return { success: true, message: 'Employee deactivated and all active sessions revoked.' };
  }

  /**
   * Reactivates an employee account.
   */
  async reactivateEmployee(
    id: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    if (employee.status === 'ACTIVE') {
      return { success: true, message: 'Employee is already active.' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          deactivatedAt: null,
        },
      });

      await this.auditWriter.write(
        {
          actorId,
          action: 'employee.reactivate',
          entityType: 'Employee',
          entityId: id,
          previousValue: { status: 'INACTIVE' },
          newValue: { status: 'ACTIVE' },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return { success: true, message: 'Employee reactivated successfully.' };
  }

  /**
   * Assigns roles to an employee.
   * Enforces protection: The last active SYSTEM_ADMIN cannot lose the SYSTEM_ADMIN role!
   */
  async assignRoles(
    id: string,
    dto: AssignRolesDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; roles: string[] }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentRoles = employee.roles.map((r) => r.role.code);
    const hasCurrentAdmin = currentRoles.includes('SYSTEM_ADMIN');
    const willKeepAdmin = dto.roleCodes.includes('SYSTEM_ADMIN');

    if (hasCurrentAdmin && !willKeepAdmin && employee.status === 'ACTIVE') {
      const otherActiveAdminsCount = await this.prisma.employee.count({
        where: {
          id: { not: id },
          status: 'ACTIVE',
          roles: {
            some: {
              role: { code: 'SYSTEM_ADMIN' },
            },
          },
        },
      });

      if (otherActiveAdminsCount === 0) {
        throw new ForbiddenException({
          code: AppErrorCode.LAST_ADMIN_PROTECTED,
          message: 'Cannot remove System Administrator role from the last active admin.',
        });
      }
    }

    const targetRoles = await this.prisma.role.findMany({
      where: { code: { in: dto.roleCodes }, isActive: true },
    });

    if (targetRoles.length !== dto.roleCodes.length) {
      throw new BadRequestException('One or more specified role codes are invalid or inactive.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeRole.deleteMany({
        where: { employeeId: id },
      });

      for (const role of targetRoles) {
        await tx.employeeRole.create({
          data: {
            employeeId: id,
            roleId: role.id,
            assignedById: actorId,
          },
        });
      }

      await this.auditWriter.write(
        {
          actorId,
          action: 'users.roles.assign',
          entityType: 'Employee',
          entityId: id,
          previousValue: { roles: currentRoles },
          newValue: { roles: dto.roleCodes },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return { success: true, roles: dto.roleCodes };
  }

  /**
   * Admin-initiated password reset:
   * Generates a one-time temp password shown once to admin.
   * Revokes all active sessions for this employee.
   */
  async adminResetPassword(
    id: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ tempPassword: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const rawTempPassword = generateTemporaryPassword();
    const newPasswordHash = await argon2.hash(rawTempPassword, {
      type: argon2.argon2id,
    });
    const now = new Date();
    const tempPasswordExpiresAt = new Date(
      now.getTime() + this.tempPasswordHours * 3600 * 1000,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await this.tokenService.revokeAllEmployeeSessions(id, 'ADMIN_PASSWORD_RESET');

      await this.auditWriter.write(
        {
          actorId,
          action: 'users.password.admin_reset',
          entityType: 'Employee',
          entityId: id,
          reason: 'Admin initiated password reset with temporary password',
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return { tempPassword: rawTempPassword };
  }

  /**
   * Unlocks an employee's locked account.
   * Instruction 6: "Do not delete AccountLockout rows. Set unlockedAt, unlockedById and unlockReason,
   * reset failedLoginAttempts and lockedUntil, and write an audit entry."
   */
  async unlockAccount(
    id: string,
    dto: UnlockAccountDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Update active lockouts
      await tx.accountLockout.updateMany({
        where: { employeeId: id, unlockedAt: null },
        data: {
          unlockedAt: now,
          unlockedById: actorId,
          unlockReason: dto.reason ?? 'Admin unlocked account early',
        },
      });

      await this.auditWriter.write(
        {
          actorId,
          action: 'users.account.unlock',
          entityType: 'Employee',
          entityId: id,
          reason: dto.reason ?? 'Admin manual unlock',
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return { success: true, message: 'Account unlocked successfully.' };
  }

  /**
   * Lists active sessions for an employee.
   */
  async getEmployeeSessions(
    id: string,
    currentFamilyId?: string,
  ): Promise<SessionDto[]> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        employeeId: id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { issuedAt: 'desc' },
    });

    // Group by familyId to show one session card per device
    const familyMap = new Map<string, (typeof tokens)[0]>();
    for (const token of tokens) {
      if (!familyMap.has(token.familyId)) {
        familyMap.set(token.familyId, token);
      }
    }

    return Array.from(familyMap.values()).map((t) => ({
      id: t.id,
      familyId: t.familyId,
      issuedAt: t.issuedAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
      lastUsedAt: t.issuedAt.toISOString(),
      userAgent: t.userAgent,
      ipAddress: t.ipAddress,
      isCurrent: t.familyId === currentFamilyId,
    }));
  }

  /**
   * Revokes a specific session family.
   */
  async revokeEmployeeSession(
    employeeId: string,
    familyId: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.tokenService.revokeFamily(familyId, 'ADMIN_REVOKED');

    await this.auditWriter.write({
      actorId,
      action: 'users.sessions.revoke',
      entityType: 'Session',
      entityId: familyId,
      reason: `Admin revoked session family ${familyId} for employee ${employeeId}`,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    return { success: true, message: 'Session revoked successfully.' };
  }
}
