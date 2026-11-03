import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DepartmentDto, DesignationDto, TeamDto } from '@epms/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';
import {
  CreateDepartmentDto,
  CreateDesignationDto,
  CreateTeamDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
  UpdateTeamDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // ─── DEPARTMENTS ────────────────────────────────────────────────────────────

  async listDepartments(includeInactive = false): Promise<DepartmentDto[]> {
    const list = await this.prisma.department.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        head: true,
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });

    return list.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      headId: d.headId,
      headName: d.head?.fullName ?? null,
      isActive: d.isActive,
      employeeCount: d._count.employees,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async getDepartment(id: string): Promise<DepartmentDto> {
    const d = await this.prisma.department.findUnique({
      where: { id },
      include: {
        head: true,
        _count: { select: { employees: true } },
      },
    });

    if (!d) {
      throw new NotFoundException('Department not found.');
    }

    return {
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      headId: d.headId,
      headName: d.head?.fullName ?? null,
      isActive: d.isActive,
      employeeCount: d._count.employees,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async createDepartment(
    dto: CreateDepartmentDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DepartmentDto> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.department.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Department with code ${code} already exists.`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const dep = await tx.department.create({
        data: {
          code,
          name: dto.name.trim(),
          description: dto.description ?? null,
          headId: dto.headId ?? null,
        },
        include: { head: true },
      });

      await this.auditWriter.write(
        {
          actorId,
          action: 'organization.department.create',
          entityType: 'Department',
          entityId: dep.id,
          newValue: { code: dep.code, name: dep.name },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return dep;
    });

    return {
      id: result.id,
      code: result.code,
      name: result.name,
      description: result.description,
      headId: result.headId,
      headName: result.head?.fullName ?? null,
      isActive: result.isActive,
      employeeCount: 0,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DepartmentDto> {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Department not found.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const dep = await tx.department.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          headId: dto.headId,
          isActive: dto.isActive,
        },
        include: { head: true, _count: { select: { employees: true } } },
      });

      await this.auditWriter.write(
        {
          actorId,
          action: 'organization.department.update',
          entityType: 'Department',
          entityId: dep.id,
          previousValue: { name: existing.name, headId: existing.headId, isActive: existing.isActive },
          newValue: { name: dep.name, headId: dep.headId, isActive: dep.isActive },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return dep;
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      headId: updated.headId,
      headName: updated.head?.fullName ?? null,
      isActive: updated.isActive,
      employeeCount: updated._count.employees,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deactivateDepartment(
    id: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.updateDepartment(id, { isActive: false }, actorId, ipAddress, userAgent);
    return { success: true, message: 'Department deactivated successfully.' };
  }

  // ─── DESIGNATIONS ──────────────────────────────────────────────────────────

  async listDesignations(includeInactive = false): Promise<DesignationDto[]> {
    const list = await this.prisma.designation.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });

    return list.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      isActive: d.isActive,
      employeeCount: d._count.employees,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async getDesignation(id: string): Promise<DesignationDto> {
    const d = await this.prisma.designation.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!d) throw new NotFoundException('Designation not found.');

    return {
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      isActive: d.isActive,
      employeeCount: d._count.employees,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async createDesignation(
    dto: CreateDesignationDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DesignationDto> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.designation.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Designation with code ${code} already exists.`);

    const result = await this.prisma.$transaction(async (tx) => {
      const des = await tx.designation.create({
        data: {
          code,
          name: dto.name.trim(),
          description: dto.description ?? null,
        },
      });

      await this.auditWriter.write(
        {
          actorId,
          action: 'organization.designation.create',
          entityType: 'Designation',
          entityId: des.id,
          newValue: { code: des.code, name: des.name },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return des;
    });

    return {
      id: result.id,
      code: result.code,
      name: result.name,
      description: result.description,
      isActive: result.isActive,
      employeeCount: 0,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  async updateDesignation(
    id: string,
    dto: UpdateDesignationDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DesignationDto> {
    const existing = await this.prisma.designation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Designation not found.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const des = await tx.designation.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          isActive: dto.isActive,
        },
        include: { _count: { select: { employees: true } } },
      });

      await this.auditWriter.write(
        {
          actorId,
          action: 'organization.designation.update',
          entityType: 'Designation',
          entityId: des.id,
          previousValue: { name: existing.name, isActive: existing.isActive },
          newValue: { name: des.name, isActive: des.isActive },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return des;
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      isActive: updated.isActive,
      employeeCount: updated._count.employees,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deactivateDesignation(
    id: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.updateDesignation(id, { isActive: false }, actorId, ipAddress, userAgent);
    return { success: true, message: 'Designation deactivated successfully.' };
  }

  // ─── TEAMS ──────────────────────────────────────────────────────────────────

  async listTeams(departmentId?: string, includeInactive = false): Promise<TeamDto[]> {
    const list = await this.prisma.team.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        department: true,
        lead: true,
        members: {
          include: { employee: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return list.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      departmentId: t.departmentId,
      departmentName: t.department.name,
      leadId: t.leadId,
      leadName: t.lead?.fullName ?? null,
      isActive: t.isActive,
      memberCount: t.members.length,
      members: t.members.map((m) => ({
        employeeId: m.employeeId,
        fullName: m.employee.fullName,
        email: m.employee.email,
        employeeCode: m.employee.employeeCode,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  async getTeam(id: string): Promise<TeamDto> {
    const t = await this.prisma.team.findUnique({
      where: { id },
      include: {
        department: true,
        lead: true,
        members: {
          include: { employee: true },
        },
      },
    });

    if (!t) throw new NotFoundException('Team not found.');

    return {
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      departmentId: t.departmentId,
      departmentName: t.department.name,
      leadId: t.leadId,
      leadName: t.lead?.fullName ?? null,
      isActive: t.isActive,
      memberCount: t.members.length,
      members: t.members.map((m) => ({
        employeeId: m.employeeId,
        fullName: m.employee.fullName,
        email: m.employee.email,
        employeeCode: m.employee.employeeCode,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async createTeam(
    dto: CreateTeamDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TeamDto> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.team.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Team with code ${code} already exists.`);

    const result = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          code,
          name: dto.name.trim(),
          description: dto.description ?? null,
          departmentId: dto.departmentId,
          leadId: dto.leadId ?? null,
        },
        include: { department: true, lead: true },
      });

      if (dto.memberIds && dto.memberIds.length > 0) {
        for (const employeeId of dto.memberIds) {
          await tx.teamMember.create({
            data: {
              teamId: team.id,
              employeeId,
            },
          });
        }
      }

      await this.auditWriter.write(
        {
          actorId,
          action: 'organization.team.create',
          entityType: 'Team',
          entityId: team.id,
          newValue: { code: team.code, name: team.name, departmentId: team.departmentId },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );

      return team;
    });

    return this.getTeam(result.id);
  }

  async updateTeam(
    id: string,
    dto: UpdateTeamDto,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TeamDto> {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Team not found.');

    await this.prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          departmentId: dto.departmentId,
          leadId: dto.leadId,
          isActive: dto.isActive,
        },
      });

      if (dto.memberIds !== undefined) {
        // Replace team members
        await tx.teamMember.deleteMany({ where: { teamId: id } });
        for (const employeeId of dto.memberIds) {
          await tx.teamMember.create({
            data: {
              teamId: id,
              employeeId,
            },
          });
        }
      }

      await this.auditWriter.write(
        {
          actorId,
          action: 'organization.team.update',
          entityType: 'Team',
          entityId: id,
          previousValue: { name: existing.name, leadId: existing.leadId, isActive: existing.isActive },
          newValue: { name: dto.name, leadId: dto.leadId, isActive: dto.isActive },
          outcome: 'SUCCESS',
          ipAddress,
          userAgent,
        },
        tx,
      );
    });

    return this.getTeam(id);
  }

  async deactivateTeam(
    id: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.updateTeam(id, { isActive: false }, actorId, ipAddress, userAgent);
    return { success: true, message: 'Team deactivated successfully.' };
  }
}
