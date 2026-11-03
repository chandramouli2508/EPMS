import {
  Body,
  Controller,
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
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { OrganizationService } from './organization.service';
import {
  CreateDepartmentDto,
  CreateDesignationDto,
  CreateTeamDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
  UpdateTeamDto,
} from './dto/organization.dto';

@ApiTags('Organization')
@ApiBearerAuth('JWT')
@Controller({ path: 'organization', version: [VERSION_NEUTRAL, '1'] })
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // ─── DEPARTMENTS ────────────────────────────────────────────────────────────

  @Get('departments')
  @Permissions('organization.view')
  @ApiOperation({ summary: 'List departments' })
  async listDepartments(@Query('includeInactive') includeInactive?: string) {
    return this.orgService.listDepartments(includeInactive === 'true');
  }

  @Get('departments/:id')
  @Permissions('organization.view')
  @ApiOperation({ summary: 'Get department by ID' })
  async getDepartment(@Param('id') id: string) {
    return this.orgService.getDepartment(id);
  }

  @Post('departments')
  @Permissions('organization.create')
  @ApiOperation({ summary: 'Create department' })
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.createDepartment(dto, user.id, ip, userAgent);
  }

  @Patch('departments/:id')
  @Permissions('organization.edit')
  @ApiOperation({ summary: 'Update department' })
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.updateDepartment(id, dto, user.id, ip, userAgent);
  }

  @Post('departments/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('organization.deactivate')
  @ApiOperation({ summary: 'Deactivate department' })
  async deactivateDepartment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.deactivateDepartment(id, user.id, ip, userAgent);
  }

  // ─── DESIGNATIONS ──────────────────────────────────────────────────────────

  @Get('designations')
  @Permissions('organization.view')
  @ApiOperation({ summary: 'List designations' })
  async listDesignations(@Query('includeInactive') includeInactive?: string) {
    return this.orgService.listDesignations(includeInactive === 'true');
  }

  @Get('designations/:id')
  @Permissions('organization.view')
  @ApiOperation({ summary: 'Get designation by ID' })
  async getDesignation(@Param('id') id: string) {
    return this.orgService.getDesignation(id);
  }

  @Post('designations')
  @Permissions('organization.create')
  @ApiOperation({ summary: 'Create designation' })
  async createDesignation(
    @Body() dto: CreateDesignationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.createDesignation(dto, user.id, ip, userAgent);
  }

  @Patch('designations/:id')
  @Permissions('organization.edit')
  @ApiOperation({ summary: 'Update designation' })
  async updateDesignation(
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.updateDesignation(id, dto, user.id, ip, userAgent);
  }

  @Post('designations/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('organization.deactivate')
  @ApiOperation({ summary: 'Deactivate designation' })
  async deactivateDesignation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.deactivateDesignation(id, user.id, ip, userAgent);
  }

  // ─── TEAMS ──────────────────────────────────────────────────────────────────

  @Get('teams')
  @Permissions('organization.view')
  @ApiOperation({ summary: 'List teams (optional filter by department)' })
  async listTeams(
    @Query('departmentId') departmentId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.orgService.listTeams(departmentId, includeInactive === 'true');
  }

  @Get('teams/:id')
  @Permissions('organization.view')
  @ApiOperation({ summary: 'Get team details including members and lead' })
  async getTeam(@Param('id') id: string) {
    return this.orgService.getTeam(id);
  }

  @Post('teams')
  @Permissions('organization.create')
  @ApiOperation({ summary: 'Create team with members and lead' })
  async createTeam(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.createTeam(dto, user.id, ip, userAgent);
  }

  @Patch('teams/:id')
  @Permissions('organization.edit')
  @ApiOperation({ summary: 'Update team details and members' })
  async updateTeam(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.updateTeam(id, dto, user.id, ip, userAgent);
  }

  @Post('teams/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('organization.deactivate')
  @ApiOperation({ summary: 'Deactivate team' })
  async deactivateTeam(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.orgService.deactivateTeam(id, user.id, ip, userAgent);
  }
}
