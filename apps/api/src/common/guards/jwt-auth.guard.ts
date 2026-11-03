// apps/api/src/common/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthorizedException } from '../exceptions/domain.exception';

/**
 * Global JWT guard. Applied in AppModule to every route.
 * Routes decorated with @Public() bypass this guard.
 *
 * Decision: We use a global guard with opt-out rather than per-route opt-in
 * so new endpoints are secure by default — omitting a guard decorator doesn't
 * silently expose an endpoint.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  // Override to return a DomainException instead of Passport's default 401
  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException('INVALID_TOKEN', 'Invalid or missing access token.');
    }
    return user;
  }
}
