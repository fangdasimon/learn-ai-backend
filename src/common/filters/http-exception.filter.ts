import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * 全局 HTTP 异常过滤器
 * 用于捕获所有业务代码或框架抛出的异常，并统一返回标准 JSON 结构
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 如果是预期的 HttpException，则获取其状态码及响应内容
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 获取具体的错误消息
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      // 处理 class-validator 抛出的数组形式错误或对象错误
      const resMsg = (exceptionResponse as any).message;
      message = Array.isArray(resMsg) ? resMsg.join(', ') : resMsg || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 统一返回格式：{ code, message, data }
    response.status(status).json({
      code: status,
      message: message,
      data: null,
    });
  }
}
