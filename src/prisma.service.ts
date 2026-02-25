import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

/**
 * Prisma 服务
 * 使用 Prisma v7 的 Driver Adapter 模式连接 PostgreSQL 数据库
 * PrismaPg 适配器负责管理数据库连接
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 创建 PostgreSQL 驱动适配器
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    // 传入适配器初始化 PrismaClient
    super({ adapter });

    // --- 软删除 (Soft Delete) 扩展实现 ---
    // 使用 Prisma Client Extensions 功能拦截数据库操作
    /* eslint-disable @typescript-eslint/no-unsafe-return */
    const extended = this.$extends({
      model: {
        user: {
          async delete(args: any) {
            return await this.update({
              ...args,
              data: { deletedAt: new Date() },
            });
          },
          async deleteMany(args: any) {
            return await this.updateMany({
              ...args,
              data: { deletedAt: new Date() },
            });
          },
        },
        note: {
          async delete(args: any) {
            return await this.update({
              ...args,
              data: { deletedAt: new Date() },
            });
          },
          async deleteMany(args: any) {
            return await this.updateMany({
              ...args,
              data: { deletedAt: new Date() },
            });
          },
        },
      },
      query: {
        $allModels: {
          // 拦截查询操作 (findUnique, findMany, etc.)，自动过滤掉已删除的数据
          async $allOperations({ model, operation, args, query }) {
            // 仅处理 User 和 Note 模型的分页、查询和计数
            if (
              ['User', 'Note'].includes(model) &&
              [
                'findMany',
                'findFirst',
                'findFirstOrThrow',
                'findUnique',
                'findUniqueOrThrow',
                'count',
              ].includes(operation)
            ) {
              const queryArgs = (args || {}) as { where?: Record<string, any> };
              // 强制添加 deletedAt: null 过滤条件
              queryArgs.where = { ...queryArgs.where, deletedAt: null };
              return query(queryArgs);
            }
            return query(args);
          },
        },
      },
    });

    return extended as any;
    /* eslint-enable @typescript-eslint/no-unsafe-return */
  }

  /**
   * 模块初始化时连接数据库
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * 模块销毁时断开数据库连接
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
