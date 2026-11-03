import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController, OrganizationController],
  providers: [EmployeesService, OrganizationService, AuditWriterService],
  exports: [EmployeesService, OrganizationService],
})
export class IdentityModule {}
