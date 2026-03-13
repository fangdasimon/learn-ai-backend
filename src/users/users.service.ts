import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

/**
 * 用户服务
 * 处理与用户相关的业务逻辑
 */
@Injectable()
export class UsersService {
  // 注入 PrismaService
  constructor(private prisma: PrismaService) {}

  /**
   * 创建用户
   * @param createUserDto 用户创建信息
   */
  create(createUserDto: CreateUserDto) {
    // 密码已在 AuthService 中加密，直接存储
    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: createUserDto.password,
        name: createUserDto.name,
      },
    });
  }

  /**
   * 根据邮箱查找用户
   * 用于登录验证
   */
  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 获取所有用户
   */
  findAll() {
    return this.prisma.user.findMany();
  }

  /**
   * 根据 ID 获取用户
   * @param id 用户 ID
   */
  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        notes: true, // 关联查询该用户的笔记
      },
    });
  }

  /**
   * 更新用户
   * @param id 用户 ID
   * @param updateUserDto 用户更新信息
   */
  update(id: number, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  /**
   * 删除用户
   * @param id 用户 ID
   */
  remove(id: number) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
