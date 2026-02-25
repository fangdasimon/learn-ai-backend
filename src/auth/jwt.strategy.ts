import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * JWT 认证策略
 * 用于解析和验证请求头中的 JWT Token
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // 从请求头的 Authorization: Bearer <token> 中提取 Token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 必须确保 Token 未过期
      ignoreExpiration: false,
      // 使用与签发时相同的密钥进行验证
      secretOrKey: process.env.JWT_SECRET || 'secretKey',
    });
  }

  /**
   * 验证回调
   * 当 Token 验证通过后，Passport 会调用此方法
   * 返回的对象会被注入到 request.user 中
   */
  validate(payload: JwtPayload) {
    // payload 是 Token 中包含的数据 (在 AuthService.login 中设置的)
    // { sub: userId, email: userEmail, iat: ..., exp: ... }
    return { userId: payload.sub, email: payload.email };
  }
}
