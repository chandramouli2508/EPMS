import { Controller, Get, Query, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuditReadService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth('JWT')
@Controller({ path: 'audit-logs', version: [VERSION_NEUTRAL, '1'] })
export class AuditController {
  constructor(private readonly auditService: AuditReadService) {}

  @Get()
  @Permissions('audit.view')
  @ApiOperation({ summary: 'Search and filter immutable audit logs' })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getAuditLogs({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      entityType,
      entityId,
      action,
      actorId,
      startDate,
      endDate,
    });
  }
}
