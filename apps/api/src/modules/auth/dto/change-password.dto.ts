import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'TempPassword123!@#', description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    example: 'NewSecurePassword123!@#',
    description: 'New password adhering to EPMS policy (min 12 chars, upper/lower/number/symbol)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  newPassword!: string;
}
