import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditWriteParams {
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
  outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'APPROVED' | 'REJECTED';
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditWriterService {
  private readonly logger = new Logger(AuditWriterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sanitizes objects recursively to ensure no passwords, hashes, tokens,
   * or temporary credentials ever leak into the audit log.
   */
  public sanitize(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    const sanitized: Record<string, unknown> = {};
    const blacklistedKeys = new Set([
      'password',
      'passwordhash',
      'temppassword',
      'currentpassword',
      'newpassword',
      'token',
      'tokenhash',
      'refreshtoken',
      'secret',
      'jwt',
      'authorization',
      'cookie',
    ]);

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (blacklistedKeys.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Writes an audit log entry. If a Prisma transaction client (tx) is provided,
   * the write runs within that transaction, guaranteeing atomicity with the state change.
   */
  async write(
    params: AuditWriteParams,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    try {
      await client.auditLog.create({
        data: {
          actorId: params.actorId ?? null,
          actorLabel: params.actorLabel ?? null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId ?? null,
          previousValue: params.previousValue
            ? (this.sanitize(params.previousValue) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          newValue: params.newValue
            ? (this.sanitize(params.newValue) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          reason: params.reason ?? null,
          outcome: params.outcome ?? 'SUCCESS',
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          requestId: params.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for action ${params.action}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Re-throw if within a transaction to abort state change on audit failure
      if (tx) {
        throw error;
      }
    }
  }
}
