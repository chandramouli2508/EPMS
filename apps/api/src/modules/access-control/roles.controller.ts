import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Req,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto, DuplicateRoleDto, UpdateRoleDto } from './dto/role.dto';

@ApiTags('Roles & Permissions')
@ApiBearerAuth('JWT')
@Controller({ version: [VERSION_NEUTRAL, '1'] })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'List all permission catalog entries' })
  async listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get('roles')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'List all roles with active employee assignment counts' })
  async listRoles(@Query('includeInactive') includeInactive?: string) {
    return this.rolesService.listRoles(includeInactive === 'true');
  }

  @Get('roles/:id')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'Get role details including full permission-scope matrix' })
  async getRole(@Param('id') id: string) {
    return this.rolesService.getRole(id);
  }

  @Post('roles')
  @Permissions('roles.create')
  @ApiOperation({ summary: 'Create custom role' })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.rolesService.createRole(dto, user.id, ip, userAgent);
  }

  @Post('roles/:id/duplicate')
  @Permissions('roles.create')
  @ApiOperation({ summary: 'Duplicate an existing role with its permission-scope matrix' })
  async duplicateRole(
    @Param('id') id: string,
    @Body() dto: DuplicateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.rolesService.duplicateRole(id, dto, user.id, ip, userAgent);
  }

  @Put('roles/:id')
  @Permissions('roles.edit')
  @ApiOperation({ summary: 'Update role permissions and scopes matrix (enforces admin protections)' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.rolesService.updateRole(id, dto, user.id, ip, userAgent);
  }

  @Post('roles/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('roles.deactivate')
  @ApiOperation({ summary: 'Deactivate custom role (blocked if assigned to active employees)' })
  async deactivateRole(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    return this.rolesService.deactivateRole(id, user.id, ip, userAgent);
  }
}
