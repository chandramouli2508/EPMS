// apps/api/src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route or controller as public so JwtAuthGuard skips token validation.
 * Usage: @Public() on a controller method or the whole controller class.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
