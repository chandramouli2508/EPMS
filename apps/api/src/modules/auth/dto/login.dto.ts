import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@epms.local', description: 'Work email' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiProperty({ example: 'TempPassword123!@#', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
