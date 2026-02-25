import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpStatus,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

/**
 * 统一响应结构接口
 * 对齐阶段二验收标准：{ code: number, data: any, message: string }
 */
export interface Response<T> {
  code: number;
  data: T;
  message: string;
}

/**
 * 全局响应拦截器
 * 用于将所有成功的 API 响应包装成统一的标准格式
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        // 成功响应默认返回 200 (OK) 状态码
        code: HttpStatus.OK,

        data: data || null,

        message: 'Success',
      })),
    );
  }
}
