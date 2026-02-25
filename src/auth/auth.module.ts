/* eslint-disable @typescript-eslint/no-unused-vars */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './jwt.strategy.js';

/**
 * 认证模块
 * 负责处理用户登录、注册和 JWT 认证
 */
@Module({
  imports: [
    UsersModule, // 导入用户模块以访问用户服务
    PassportModule, // 导入 Passport 模块处理认证策略
    // 配置 JWT 模块
    JwtModule.register({
      global: true, // 设置为全局模块，无需在每个模块中重复导入
      secret: process.env.JWT_SECRET || 'secretKey', // JWT 签名密钥 (生产环境应从环境变量获取)
      signOptions: { expiresIn: '7d' }, // Token 过期时间设置为 7 天
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // 注册全局守卫，保护所有路由
    // 如果某个路由不需要认证，可以使用 @Public() 装饰器 (稍后实现)
    //目前暂不开启全局守卫，先手动在 Controller 中使用 @UseGuards(JwtAuthGuard)
    // {
    //   provide: APP_GUARD,
    //   useClass: JwtAuthGuard,
    // },
  ],
  exports: [AuthService], // 导出 AuthService 供其他模块使用
})
export class AuthModule {}
