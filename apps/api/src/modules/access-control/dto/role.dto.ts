import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PermissionScope } from '@prisma/client';

export class RolePermissionAssignmentDto {
  @ApiProperty({ example: 'employees.view', description: 'Permission key (module.action)' })
  @IsString()
  @IsNotEmpty()
  permissionKey!: string;

  @ApiProperty({
    enum: PermissionScope,
    example: PermissionScope.OWN,
    description: 'Scope: OWN | TEAM | DEPARTMENT | ASSIGNED | ALL',
  })
  @IsEnum(PermissionScope)
  scope!: PermissionScope;

  @ApiPropertyOptional({ example: 10000.0, description: 'Optional financial approval limit' })
  @IsOptional()
  @IsNumber()
  approvalLimit?: number | null;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'LEAD_DESIGNER', description: 'Unique role code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Lead Systems Designer' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Oversees engineering design packages' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [RolePermissionAssignmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionAssignmentDto)
  permissions?: RolePermissionAssignmentDto[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Lead Systems Designer Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [RolePermissionAssignmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionAssignmentDto)
  permissions?: RolePermissionAssignmentDto[];
}

export class DuplicateRoleDto {
  @ApiProperty({ example: 'CUSTOM_PM', description: 'New unique role code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Custom Project Manager' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
