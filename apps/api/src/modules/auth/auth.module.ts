import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuditWriterService } from '../../infrastructure/audit/audit-writer.service';
import { PermissionResolverService } from '../access-control/permission-resolver.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    AuditWriterService,
    PermissionResolverService,
  ],
  exports: [AuthService, TokenService, JwtStrategy, PermissionResolverService],
})
export class AuthModule {}
