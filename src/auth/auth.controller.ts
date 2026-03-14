import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';

/**
 * 认证控制器
 * 提供登录和注册接口
 * 限流：每分钟最多 10 次请求，防止暴力破解
 */
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * 用户登录接口
   * POST /auth/login
   */
  @HttpCode(HttpStatus.OK) // 登录成功返回 200 OK，而不是默认的 201 Created
  @Post('login')
  login(@Body() signInDto: { email: string; password: string }) {
    return this.authService.login(signInDto.email, signInDto.password);
  }

  /**
   * 用户注册接口
   * POST /auth/register
   */
  @Post('register')
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }
}
