import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionScope } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { EmployeesService } from './employees.service';
import {
  AssignRolesDto,
  CreateEmployeeDto,
  UnlockAccountDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';

@ApiTags('Employees')
@ApiBearerAuth('JWT')
@Controller({ path: 'employees', version: [VERSION_NEUTRAL, '1'] })
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Permissions('employees.view')
  @ApiOperation({ summary: 'List employees with pagination, search, filters, and scope rules' })
  async getEmployees(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    const userScope = user.permissions['employees.view'];
    const isOwnScopeOnly = userScope === PermissionScope.OWN;
    const hasViewSensitive = Boolean(user.permissions['employees.view_sensitive']);

    return this.employeesService.getEmployees({
      callerId: user.id,
      hasViewSensitive,
      isOwnScopeOnly,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      departmentId,
      status,
      role,
    });
  }

  @Post()
  @Permissions('employees.create')
  @ApiOperation({ summary: 'Create a new employee and user account with temporary password' })
  @ApiResponse({ status: 201, description: 'Employee created' })
  async createEmployee(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.employeesService.createEmployee(dto, user.id, ip, userAgent);
  }

  @Get(':id')
  @Permissions('employees.view')
  @ApiOperation({ summary: 'Get employee details by ID' })
  async getEmployeeById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const userScope = user.permissions['employees.view'];
    const isOwnScopeOnly = userScope === PermissionScope.OWN;
    const hasViewSensitive = Boolean(user.permissions['employees.view_sensitive']);

    return this.employeesService.getEmployeeById(
      id,
      user.id,
      hasViewSensitive,
      isOwnScopeOnly,
    );
  }

  @Patch(':id')
  @Permissions('employees.edit')
  @ApiOperation({ summary: 'Update employee profile' })
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.employeesService.updateEmployee(id, dto, user.id, ip, userAgent);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('employees.deactivate')
  @ApiOperation({ summary: 'Deactivate employee and revoke all active sessions' })
  async deactivateEmployee(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.employeesService.deactivateEmployee(id, user.id, ip, userAgent);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('employees.deactivate')
  @ApiOperation({ summary: 'Reactivate an inactive employee' })
  async reactivateEmployee(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.employeesService.reactivateEmployee(id, user.id, ip, userAgent);
  }

  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  @Permissions('users.assign_roles')
  @ApiOperation({ summary: 'Assign roles to employee (enforces last active admin protection)' })
  async assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.employeesService.assignRoles(id, dto, user.id, ip, userAgent);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Permissions('users.reset_password')
  @ApiOperation({ summary: 'Admin reset password: returns temporary one-time password' })
  async adminResetPassword(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.employeesService.adminResetPassword(id, user.id, ip, userAgent);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @Permissions('users.unlock')
  @ApiOperation({ summary: 'Unlock a locked employee account early' })
  async unlockAccount(
    @Param('id') id: string,
    @Body() dto: UnlockAccountDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.employeesService.unlockAccount(id, dto, user.id, ip, userAgent);
  }

  @Get(':id/sessions')
  @Permissions('users.view')
  @ApiOperation({ summary: 'List active sessions for employee' })
  async getEmployeeSessions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employeesService.getEmployeeSessions(id, user.familyId);
  }

  @Delete(':id/sessions/:familyId')
  @Permissions('users.revoke_sessions')
  @ApiOperation({ summary: 'Revoke a specific active session' })
  async revokeEmployeeSession(
    @Param('id') id: string,
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.employeesService.revokeEmployeeSession(
      id,
      familyId,
      user.id,
      ip,
      userAgent,
    );
  }
}
