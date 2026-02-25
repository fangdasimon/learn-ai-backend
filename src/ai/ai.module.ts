import { Module, Global } from '@nestjs/common';
import { AiService } from './ai.service.js';

/**
 * AI 模块
 * 使用 @Global() 装饰器使其成为全局模块，方便其他业务模块直接注入 AiService
 */
@Global()
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
