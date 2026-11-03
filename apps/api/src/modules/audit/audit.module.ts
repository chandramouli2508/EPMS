import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditReadService } from './audit.service';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';

@Module({
  controllers: [AuditController],
  providers: [AuditReadService, AuditWriterService],
  exports: [AuditReadService, AuditWriterService],
})
export class AuditModule {}
