import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service.js';
import { AiService } from '../ai/ai.service.js';

/**
 * 检索结果切片接口
 */
export interface RelevantChunk {
  content: string;
  noteId: number;
  noteTitle: string;
  similarity: number;
}

/**
 * RAG (检索增强生成) 服务
 * 负责将长笔记切分成短片 (Chunk)，并将其向量化存入数据库
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly chunkSize = 500; // 每个切片的目标长度 (字符)
  private readonly chunkOverlap = 50; // 切片间的重叠长度，防止语义断层

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  /**
   * 文档切片逻辑 (递归字符分割)
   * 优先按段落分割，不足时按句号分割
   */
  private splitText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + this.chunkSize;

      if (end < text.length) {
        // 尝试找最近的换行符或句号，避免从句子中间切断
        const searchRange = text.substring(end - 100, end + 100);
        const lastBoundary = Math.max(
          searchRange.lastIndexOf('\n'),
          searchRange.lastIndexOf('。'),
          searchRange.lastIndexOf('.'),
        );

        if (lastBoundary !== -1) {
          end = end - 100 + lastBoundary + 1;
        }
      }

      chunks.push(text.substring(start, end).trim());
      start = end - this.chunkOverlap; // 移动指针，保留重叠部分
      if (start < 0) start = 0;
      if (end >= text.length) break;
    }

    return chunks.filter((c) => c.length > 5); // 过滤掉太短的碎片
  }

  /**
   * 同步笔记向量数据
   * 1. 删除既有切片
   * 2. 重新切片
   * 3. 生成 Embedding 并同步至数据库
   */
  async syncNoteVectors(noteId: number, content: string) {
    this.logger.log(`开始同步笔记向量: ID ${noteId}`);

    // 1. 文档切片
    const textChunks = this.splitText(content);

    // 2. 准备数据
    try {
      // 批量生成嵌入（每批最多 10 个，并行请求）
      const batchSize = 10;
      const embeddings: number[][] = [];

      for (let i = 0; i < textChunks.length; i += batchSize) {
        const batch = textChunks.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map((text) => this.aiService.generateEmbedding(text)),
        );
        embeddings.push(...batchEmbeddings);
      }

      // 开启事务：删除旧数据并插入新数据
      await this.prisma.$transaction(async (tx) => {
        // 清理旧切片
        await tx.noteChunk.deleteMany({ where: { noteId } });

        for (let i = 0; i < textChunks.length; i++) {
          const chunkId = randomUUID();
          await tx.$executeRawUnsafe(
            `INSERT INTO "NoteChunk" (id, content, "noteId", embedding)
             VALUES ($1, $2, $3, $4::vector)`,
            chunkId,
            textChunks[i],
            noteId,
            `[${embeddings[i].join(',')}]`,
          );
        }
      });

      this.logger.log(
        `笔记向量同步完成: ID ${noteId}, 切片数: ${textChunks.length}`,
      );
    } catch (error) {
      this.logger.error(
        `向量同步失败: ${error.message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * 检索最相关的笔记切片
   * @param query 查询关键词或长句
   * @param userId 限制在当前用户的笔记范围内
   * @param limit 返回切片的数量限制
   */
  async findRelevantChunks(
    query: string,
    userId: number,
    limit = 5,
  ): Promise<RelevantChunk[]> {
    // 1. 获取查询文本的 Embedding 向量
    const queryEmbedding = await this.aiService.generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // 2. 执行向量余弦相似度搜索
    // pgvector 运算符: <=> 表示余弦距离，距离越小越相似
    // 我们计算相似度为: 1 - distance
    const results = await this.prisma.$queryRawUnsafe<RelevantChunk[]>(
      `
      SELECT 
        c.content, 
        c."noteId", 
        n.title as "noteTitle",
        1 - (c.embedding <=> $1::vector) as similarity
      FROM "NoteChunk" c
      JOIN "Note" n ON c."noteId" = n.id
      WHERE n."userId" = $2 AND n."deletedAt" IS NULL
      ORDER BY similarity DESC
      LIMIT $3
      `,
      vectorString,
      userId,
      limit,
    );

    return results;
  }
}
