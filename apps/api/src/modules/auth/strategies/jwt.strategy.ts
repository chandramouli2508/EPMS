import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppErrorCode } from '@epms/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { PermissionResolverService } from '../../access-control/permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { TokenPayload } from '../token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissionResolver: PermissionResolverService,
  ) {
    const pubB64 = configService.get<string>('JWT_PUBLIC_KEY_BASE64') ?? '';
    const publicKey = pubB64 ? Buffer.from(pubB64, 'base64').toString('utf8') : '';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: TokenPayload): Promise<AuthenticatedUser> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        employeeCode: true,
        status: true,
        mustChangePassword: true,
        departmentId: true,
        designationId: true,
      },
    });

    if (!employee || employee.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: AppErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Account is inactive or does not exist.',
      });
    }

    // Access tokens must stop working immediately after logout or revocation.
    const session = payload.familyId && await this.prisma.refreshToken.findFirst({
      where: {
        employeeId: employee.id,
        familyId: payload.familyId,
        revokedAt: null,
        rotatedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) {
      throw new UnauthorizedException('Session has expired or been revoked.');
    }

    // Resolve permissions fresh on every request to reflect immediate grants/revocations
    const { roles, permissions } =
      await this.permissionResolver.resolvePermissionsForEmployee(employee.id);

    return {
      id: employee.id,
      email: employee.email,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      mustChangePassword: employee.mustChangePassword,
      departmentId: employee.departmentId,
      designationId: employee.designationId,
      roles,
      permissions,
      familyId: payload.familyId,
    };
  }
}
