import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';

/**
 * 认证服务
 * 处理登录验证、Token 生成和用户注册
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * 用户登录
   * 验证邮箱和密码，成功后返回 JWT Token
   */
  async login(email: string, pass: string) {
    // 1. 查找用户
    // 注意：这里需要 UsersService 提供一个 findByEmail 方法
    // 由于 UsersService 目前只有 findOne(id)，我们需要去添加 findByEmail
    // 暂时先用 prisma 直接查询，或者修改 UsersService
    // 为了保持分层清晰，我们稍后在 UsersService 添加 findByEmail
    const user = await this.usersService.findByEmail(email);

    // 2. 验证用户是否存在且密码匹配
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 3. 生成 JWT Token
    // payload 中包含用户 ID 和邮箱
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
      },
    };
  }

  /**
   * 用户注册
   * 对密码进行加密后创建用户
   */
  async register(createUserDto: CreateUserDto) {
    // 1. 对密码进行哈希加密
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    // 2. 创建用户 (调用 UsersService)
    // 注意：我们需要修改 UsersService.create 或在此处构造数据
    // 最好的方式是让 UsersService.create 接收数据，我们在这里处理好哈希
    return this.usersService.create({
      ...createUserDto,
      password: hashedPassword, // 使用加密后的密码
    });
  }
}
