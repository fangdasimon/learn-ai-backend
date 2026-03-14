import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
// PrismaService 已移动到全局的 PrismaModule 中
import { UsersModule } from './users/users.module.js';
import { NotesModule } from './notes/notes.module.js';
import { TagsModule } from './tags/tags.module.js';

import { AuthModule } from './auth/auth.module.js';
import { AiModule } from './ai/ai.module.js';
import { RagModule } from './rag/rag.module.js';
import { PrismaModule } from './prisma.module.js';

/**
 * 应用程序的根模块 (Root Module)
 * NestJS 使用模块来组织代码结构
 */
@Module({
  imports: [
    // 全局速率限制：默认每分钟 100 次请求
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    UsersModule,
    NotesModule,
    TagsModule,
    AuthModule,
    AiModule,
    RagModule,
    PrismaModule, // 导入全局 Prisma 模块
  ],
  controllers: [AppController], // 注册控制器 (处理顶层请求)
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
