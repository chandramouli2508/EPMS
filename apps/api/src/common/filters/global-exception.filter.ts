// apps/api/src/common/filters/global-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';

export interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Catches all exceptions and normalises them into the consistent error envelope:
 * { statusCode, error, message, timestamp, path, fieldErrors? }
 *
 * This is the single place that converts both NestJS exceptions (ValidationPipe 400,
 * Passport 401) and domain business exceptions into the shape the frontend expects.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';
    let fieldErrors: Record<string, string[]> | undefined;

    if (exception instanceof DomainException) {
      const res = exception.getResponse() as { code: string; message: string };
      statusCode = exception.getStatus();
      error = res.code;
      message = res.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;

        // NestJS ValidationPipe returns { message: string[], error: string }
        if (Array.isArray(body.message)) {
          error = 'VALIDATION_ERROR';
          message = 'Request validation failed.';
          // Try to map class-validator errors into field-keyed messages
          fieldErrors = parseValidationMessages(body.message as string[]);
        } else {
          error = (body.error as string) ?? 'HTTP_ERROR';
          message = (body.message as string) ?? exception.message;
        }
      } else {
        message = typeof res === 'string' ? res : exception.message;
        error = `HTTP_${statusCode}`;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Non-Error exception thrown', JSON.stringify(exception));
    }

    const requestId = (request.headers['x-request-id'] as string) ?? '';
    if (statusCode >= 500) {
      this.logger.error(`[${requestId}] ${statusCode} ${error}: ${message}`);
    } else {
      this.logger.warn(`[${requestId}] ${statusCode} ${error}: ${message}`);
    }

    const envelope: ErrorEnvelope = {
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(fieldErrors ? { fieldErrors } : {}),
    };

    response.status(statusCode).json(envelope);
  }
}

/**
 * NestJS class-validator errors look like:
 *   ["fieldName must be a string", "fieldName should not be empty"]
 * We group them into { fieldName: [msg1, msg2] }.
 * Falls back to a top-level _root key if the field name cannot be extracted.
 */
function parseValidationMessages(messages: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const msg of messages) {
    // Try to extract the leading identifier (field name)
    const match = msg.match(/^([a-zA-Z0-9_.]+)\s(.+)/);
    const field = match ? match[1] : '_root';
    const text = match ? msg : msg;
    result[field] = [...(result[field] ?? []), text];
  }
  return result;
}
