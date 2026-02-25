import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * 用户请求接口扩展
 */
interface UserRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

/**
 * 自定义装饰器：获取当前登录用户
 * 支持获取整个 user 对象或其中的某个字段（如 userId）
 *
 * @example
 * // 获取整个用户对象
 * @CurrentUser() user: any
 *
 * @example
 * // 仅获取用户 ID
 * @CurrentUser('userId') userId: number
 */
export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<UserRequest>();
    const user = request.user;

    // 如果指定了 data 参数且 user 对象存在，则返回指定字段的值
    return data ? user?.[data as keyof typeof user] : user;
  },
);
