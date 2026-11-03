import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogDto } from '@epms/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class AuditReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogs(params: AuditLogQueryParams): Promise<{
    data: AuditLogDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (params.entityType) {
      where.entityType = params.entityType;
    }
    if (params.entityId) {
      where.entityId = params.entityId;
    }
    if (params.action) {
      where.action = { contains: params.action, mode: 'insensitive' };
    }
    if (params.actorId) {
      where.actorId = params.actorId;
    }
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.createdAt.lte = new Date(params.endDate);
      }
    }

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const data: AuditLogDto[] = records.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorId: r.actorId,
      actorLabel: r.actorLabel,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      previousValue: r.previousValue as Record<string, unknown> | null,
      newValue: r.newValue as Record<string, unknown> | null,
      reason: r.reason,
      outcome: r.outcome,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      requestId: r.requestId,
    }));

    return { data, total, page, limit };
  }
}
