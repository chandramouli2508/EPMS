import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global Prisma module — registers PrismaService once and makes it
 * injectable in every module without explicit imports.
 *
 * Marked @Global() so feature modules (AuthModule, IdentityModule, etc.)
 * do not need to import PrismaModule individually.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
