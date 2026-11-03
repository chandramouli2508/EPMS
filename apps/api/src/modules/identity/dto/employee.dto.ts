import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiPropertyOptional({ example: 'EMP-0002', description: 'Unique employee code (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiProperty({ example: 'Jane Doe', description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'jane.doe@epms.local', description: 'Work email' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiPropertyOptional({ example: '+1-555-0199', description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '2026-01-15', description: 'Date of joining (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Designation UUID' })
  @IsOptional()
  @IsUUID()
  designationId?: string;

  @ApiPropertyOptional({ description: 'Manager / Reporting line UUID' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ example: ['EMPLOYEE'], description: 'Initial role codes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Jane Doe Updated' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '+1-555-0200' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  designationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}

export class AssignRolesDto {
  @ApiProperty({ example: ['PROJECT_MANAGER', 'EMPLOYEE'], description: 'Role codes to assign' })
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class UnlockAccountDto {
  @ApiPropertyOptional({ example: 'Verified identity via phone' })
  @IsOptional()
  @IsString()
  reason?: string;
}
