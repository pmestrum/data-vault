import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Log validation errors from POST /records
    if (request.method === 'POST' && request.path === '/records') {
      const errors = this.extractValidationErrors(exceptionResponse);
      this.logger.warn(
        `CREATE validation failed | database: ${request.databaseId || 'unknown'} | errors: ${errors}`,
      );
    }

    response.status(status).json(exceptionResponse);
  }

  private extractValidationErrors(response: any): string {
    if (!response.message) return String(response);

    const messages = Array.isArray(response.message)
      ? response.message
      : [response.message];

    return messages.join(' | ');
  }
}

