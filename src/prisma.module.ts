import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * 全局 Prisma 模块
 * 使用 @Global() 装饰器使其在整个应用中可用，无需在每个功能模块中重复导入
 * 同时也确保了 PrismaService 的单例性，避免创建多个数据库连接池
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 导出服务，供其它模块注入
})
export class PrismaModule {}
