import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse();

    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception?.response?.message ||
      exception.message ||
      'Internal server error';

    console.error(
      JSON.stringify({
        level: 'error',
        event: 'http_exception',
        method: request.method,
        path: request.url,
        statusCode: status,
        message,
        stack: exception?.stack,
        timestamp: new Date().toISOString(),
      }),
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      message,
    });
  }
}
