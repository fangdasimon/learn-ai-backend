import { Module } from '@nestjs/common';
import { NotesService } from './notes.service.js';
import { NotesController } from './notes.controller.js';

@Module({
  controllers: [NotesController],
  providers: [NotesService], // PrismaService 已移动到全局 PrismaModule 中，此处无需重复注册
})
export class NotesModule {}
