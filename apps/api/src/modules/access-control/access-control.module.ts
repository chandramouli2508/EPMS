import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PermissionResolverService } from './permission-resolver.service';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';

@Module({
  controllers: [RolesController],
  providers: [RolesService, PermissionResolverService, AuditWriterService],
  exports: [RolesService, PermissionResolverService],
})
export class AccessControlModule {}
