import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService], // PrismaService 已移动到全局 PrismaModule 中，此处无需重复注册
  exports: [UsersService], // 导出 UsersService 供 AuthModule 使用
})
export class UsersModule {}
