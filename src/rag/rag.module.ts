import { Module, Global } from '@nestjs/common';
import { RagService } from './rag.service.js';

/**
 * RAG 模块
 * 使用 @Global() 使其全局可用，方便在其它业务模块中直接调用向量同步逻辑
 */
@Global()
@Module({
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
