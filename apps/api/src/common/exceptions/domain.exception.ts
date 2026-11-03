// apps/api/src/common/exceptions/domain.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base for all domain-level exceptions.
 * Carries a machine-readable `code` so the frontend can handle specific cases
 * without parsing message strings.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super({ code, message }, statusCode);
  }
}

// Convenience subclasses for common HTTP statuses
export class NotFoundException extends DomainException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictException extends DomainException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.CONFLICT);
  }
}

export class ForbiddenException extends DomainException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.FORBIDDEN);
  }
}

export class BadRequestException extends DomainException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedException extends DomainException {
  constructor(code: string = 'UNAUTHORIZED', message: string = 'Unauthorized') {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}
