import { Module } from '@nestjs/common';
import { TagsService } from './tags.service.js';
import { TagsController } from './tags.controller.js';

@Module({
  controllers: [TagsController],
  providers: [TagsService], // PrismaService 已移动到全局 PrismaModule 中，此处无需重复注册
})
export class TagsModule {}
