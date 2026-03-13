import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { UpdateNoteDto } from './dto/update-note.dto.js';
import { PageDto, PageOptionsDto } from '../common/dto/pagination.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { AiService } from '../ai/ai.service.js';
import { RagService } from '../rag/rag.service.js';
import { ChatDto } from './dto/chat.dto.js';

/**
 * 笔记服务
 * 处理笔记的增删改查及分页逻辑
 * 核心：确保所有操作都严格进行用户越权校验 (userId 校验)
 */
@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService, // 注入 AI 服务
    private ragService: RagService, // 注入 RAG 服务 (处理分片与向量同步)
  ) {}

  /**
   * AI 摘要生成并保存
   * @param id 笔记 ID
   * @param userId 当前用户 ID (鉴权用)
   */
  async generateAndSaveSummary(id: number, userId: number) {
    // 1. 确保笔记存在且属于该用户
    const note = await this.findOne(id, userId);

    // 2. 调用 AI 生成摘要
    const summary = await this.aiService.generateSummary(note.content);

    // 3. 更新数据库中的 summary 字段
    return await this.prisma.note.update({
      where: { id },
      data: { summary },
    });
  }

  /**
   * 创建笔记
   * 将笔记与指定用户关联，并支持标签同步创建
   */
  async create(createNoteDto: CreateNoteDto) {
    const { title, content, userId, tags } = createNoteDto;

    // 构建标签关联：如果不存在则创建，如果存在则直接关联
    const tagsConnect = tags?.map((tagName) => ({
      where: { name: tagName },
      create: { name: tagName },
    }));

    const note = await this.prisma.note.create({
      data: {
        title,
        content,
        userId: userId!, // userId 在 Controller 中已从 JWT 提取并注入，此处可安全使用非空断言
        tags: tagsConnect ? { connectOrCreate: tagsConnect } : undefined,
      },
      include: {
        tags: true,
      },
    });

    // 4. 创建笔记成功后，异步触发向量同步 (用于 RAG)
    // 使用 .catch 捕获异步错误，防止后台任务失败影响主流程，同时记录日志
    void this.ragService
      .syncNoteVectors(note.id, note.content)
      .catch((err: Error) =>
        this.logger.error(`创建笔记后自动同步向量失败: ${err.message}`),
      );

    return note;
  }

  /**
   * 获取当前用户的笔记列表
   * 严格限制 where userId 为当前登录用户
   */
  async findAll(userId: number, pageOptions: PageOptionsDto) {
    const {
      page: rawPage = 1,
      limit: rawLimit = 10,
      orderBy = 'createdAt',
      order = 'desc',
      keyword,
    } = pageOptions;

    // 确保分页参数为整数（query string 传入可能是字符串）
    const page = Number(rawPage);
    const limit = Number(rawLimit);
    const skip = (page - 1) * limit;

    // 强制限制 userId，确保用户只能看到自己的笔记
    const where: Prisma.NoteWhereInput = {
      userId: userId,
    };

    // 如果有关键字，进行模糊搜索 (标题或内容)
    if (keyword) {
      where.AND = [
        {
          OR: [
            { title: { contains: keyword, mode: 'insensitive' } },
            { content: { contains: keyword, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: order },
        include: {
          tags: true,
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.note.count({ where }),
    ]);

    return new PageDto(data, total, pageOptions);
  }

  /**
   * 获取笔记详情
   * 需校验笔记是否存在且属于该用户
   */
  async findOne(id: number, userId: number) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        tags: true,
      },
    });

    if (!note) {
      throw new NotFoundException(`未找到 ID 为 ${id} 的笔记`);
    }

    if (note.userId !== userId) {
      throw new ForbiddenException('您没有权限查看此笔记');
    }

    return note;
  }

  /**
   * 更新笔记
   * 需校验所有权，并处理标签的全量更新策略
   */
  async update(id: number, userId: number, updateNoteDto: UpdateNoteDto) {
    // 1. 权限与存在性校验
    await this.findOne(id, userId);

    const { title, content, tags } = updateNoteDto;

    // 2. 如果没有标签更新要求，仅更新基础字段
    if (!tags) {
      const updatedNote = await this.prisma.note.update({
        where: { id },
        data: { title, content },
      });

      // 异步触发向量同步，并捕获异常记录日志
      void this.ragService
        .syncNoteVectors(updatedNote.id, updatedNote.content)
        .catch((err: Error) =>
          this.logger.error(
            `更新笔记(无标签)后自动同步向量失败: ${err.message}`,
          ),
        );
      return updatedNote;
    }

    // 3. 处理标签更新：使用事务确保原子性
    const updatedNote = await this.prisma.$transaction(async (tx) => {
      // 先解绑该笔记的所有旧标签
      await tx.note.update({
        where: { id },
        data: {
          tags: { set: [] },
        },
      });

      // 构建新标签关联
      const tagsConnect = tags.map((tagName) => ({
        where: { name: tagName },
        create: { name: tagName },
      }));

      // 更新内容并重新关联标签
      return tx.note.update({
        where: { id },
        data: {
          title,
          content,
          tags: {
            connectOrCreate: tagsConnect,
          },
        },
        include: {
          tags: true,
        },
      });
    });

    // 4. 更新成功后，异步刷新向量数据
    void this.ragService
      .syncNoteVectors(updatedNote.id, updatedNote.content)
      .catch((err: Error) =>
        this.logger.error(`更新笔记(带标签)后自动同步向量失败: ${err.message}`),
      );

    return updatedNote;
  }

  /**
   * 物理/逻辑删除笔记
   * 需校验所有权
   */
  async remove(id: number, userId: number) {
    // 权限校验
    await this.findOne(id, userId);

    return this.prisma.note.delete({
      where: { id },
    });
  }

  /**
   * 语义搜索笔记
   * 基于向量相似度检索最相关的片段
   */
  async semanticSearch(query: string, userId: number) {
    return this.ragService.findRelevantChunks(query, userId);
  }

  /**
   * 基于笔记的 AI 对话 (RAG)
   * 1. 寻找相关背景
   * 2. 让 AI 结合背景回答
   */
  async chatWithNotes(question: string, userId: number) {
    // 1. 检索 top 5 相关切片
    const chunks = await this.ragService.findRelevantChunks(
      question,
      userId,
      5,
    );

    if (chunks.length === 0) {
      return '抱歉，在您的笔记库中没有找到与此问题相关的内容。';
    }

    // 2. 拼接上下文背景
    const context = chunks
      .map(
        (c) =>
          `[来源笔记: ${c.noteTitle}]\n内容片段: ${c.content}\n(相关度: ${(c.similarity * 100).toFixed(1)}%)`,
      )
      .join('\n\n---\n\n');

    // 3. 通过 AI 生成回答
    return this.aiService.chatWithContext(question, context);
  }

  /**
   * 基于笔记的 AI 流式对话 (升级版：服务端自动管理记忆)
   * 1. 自动处理会话创建与历史加载
   * 2. 自动保存问答记录
   * 3. 支持 RAG 知识库引用
   */
  async *chatStreamWithNotes(chatDto: ChatDto, userId: number) {
    const { question, conversationId } = chatDto;
    let currentConversationId = conversationId;

    // 1. 查找或创建会话
    if (currentConversationId) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: currentConversationId },
      });
      if (!conv || conv.userId !== userId) {
        throw new Error('会话不存在或无权访问');
      }
    } else {
      // 创建新会话，取提问的前 40 字作为默认标题
      const newConv = await this.prisma.conversation.create({
        data: {
          title: question.substring(0, 40) || '新对话',
          userId,
        },
      });
      currentConversationId = newConv.id;
    }

    // 2. 加载历史上下文 (最近 10 条消息)
    const historyMessages = await this.prisma.chatMessage.findMany({
      where: { conversationId: currentConversationId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const history: {
      role: 'user' | 'assistant' | 'system';
      content: string;
    }[] = historyMessages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // 3. 将当前用户消息入库（先保存，确保 createdAt 早于 AI 回复）
    await this.prisma.chatMessage.create({
      data: {
        role: 'user',
        content: question,
        conversationId: currentConversationId,
      },
    });

    // 4. 语义检索 (RAG)
    const chunks = await this.ragService.findRelevantChunks(
      question,
      userId,
      5,
    );
    let context = '目前用户的笔记库中没有找到直接相关的背景资料。';
    if (chunks.length > 0) {
      context = chunks
        .map(
          (c) =>
            `[来源笔记: ${c.noteTitle}]\n内容片段: ${c.content}\n(相关度: ${(c.similarity * 100).toFixed(1)}%)`,
        )
        .join('\n\n---\n\n');
    }

    // 5. 发送元数据（告诉前端当前的会话 ID）
    yield JSON.stringify({
      conversationId: currentConversationId,
      isFirst: true,
    });

    // 6. 调用 AI 流式输出并聚合结果用于存盘
    let fullResponse = '';
    const stream = this.aiService.chatStreamWithContext(
      question,
      context,
      history,
    );

    for await (const chunk of stream) {
      fullResponse += chunk;
      yield chunk;
    }

    // 7. 回复结束后，保存 AI 消息及更新会话活跃时间
    if (fullResponse) {
      await Promise.all([
        this.prisma.chatMessage.create({
          data: {
            role: 'assistant',
            content: fullResponse,
            conversationId: currentConversationId,
          },
        }),
        this.prisma.conversation.update({
          where: { id: currentConversationId },
          data: { updatedAt: new Date() },
        }),
      ]);
    }

    // 8. 发送结束标记，通知前端流已完成
    yield '[DONE]';
  }

  /**
   * 获取当前用户的对话列表
   */
  async getConversations(userId: number): Promise<any> {
    return await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 获取指定会话的历史消息
   */
  async getConversationMessages(id: number, userId: number): Promise<any> {
    // 权限校验
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
    });
    if (!conv || conv.userId !== userId) {
      throw new Error('会话不存在或无权访问');
    }

    return this.prisma.chatMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 删除会话
   */
  async deleteConversation(id: number, userId: number): Promise<any> {
    // 权限校验
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
    });
    if (!conv || conv.userId !== userId) {
      throw new Error('会话不存在或无权访问');
    }

    return this.prisma.conversation.delete({
      where: { id },
    });
  }
}
