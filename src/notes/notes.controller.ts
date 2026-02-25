import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, from, map } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { NotesService } from './notes.service.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { UpdateNoteDto } from './dto/update-note.dto.js';
import { ChatDto } from './dto/chat.dto.js';
import { PageOptionsDto } from '../common/dto/pagination.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AiService } from '../ai/ai.service.js';

/**
 * 笔记控制器
 * 定义笔记相关的 RESTful 接口，并集成 Swagger 文档与 JWT 安全守卫
 */
@ApiTags('笔记模块') // Swagger 分组标签
@ApiBearerAuth() // Swagger 声明该模块需要授权
@UseGuards(JwtAuthGuard) // 全局应用 JWT 认证守卫
@Controller('notes')
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly aiService: AiService, // 注入 AI 服务
  ) {}

  // --- AI 增强功能接口 ---

  /**
   * AI 生成并保存笔记摘要
   */
  @Post(':id/summary')
  @ApiOperation({
    summary: 'AI 生成笔记摘要',
    description: '调用 AI 为指定笔记生成摘要并保存到数据库',
  })
  generateSummary(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    return this.notesService.generateAndSaveSummary(id, userId);
  }

  /**
   * AI 推荐标签 (实时)
   */
  @Get('ai/recommend-tags')
  @ApiOperation({
    summary: 'AI 推荐标签',
    description: '根据提供的文本内容，实时返回 AI 建议的标签列表',
  })
  recommendTags(@Query('content') content: string) {
    return this.aiService.recommendTags(content);
  }

  /**
   * AI 内容润色 (实时)
   * @param content 待润色的文本内容
   * @returns 润色后的文本
   */
  @Post('ai/polish')
  @ApiOperation({
    summary: 'AI 内容润色',
    description: '对输入的文本进行优化排版和措辞润色',
  })
  polishContent(@Body('content') content: string) {
    return this.aiService.polishContent(content);
  }

  /**
   * 语义搜索
   * 根据自然语言描述检索最相关的笔记片段
   * @param query 搜索查询字符串
   * @param userId 当前用户ID
   * @returns 匹配的笔记片段列表
   */
  @Get('search')
  @ApiOperation({
    summary: '语义搜索笔记',
    description: '使用向量相似度在个人笔记库中进行深层语义检索',
  })
  search(@Query('q') query: string, @CurrentUser('userId') userId: number) {
    return this.notesService.semanticSearch(query, userId);
  }

  /**
   * AI 知识库问答 (RAG) - SSE 流式输出
   * 基于个人笔记内容逐字推送回答，支持多轮上下文
   * @param chatDto 包含对话历史和当前问题的DTO
   * @param userId 当前用户ID
   * @returns SSE 消息流
   */
  @Post('chat')
  @Sse()
  @ApiOperation({
    summary: '笔记知识库流式对话',
    description:
      '采用 POST 协议传输历史上下文，并以 SSE 逐字渲染返回。支持引用追溯。',
  })
  chat(
    @Body() chatDto: ChatDto,
    @CurrentUser('userId') userId: number,
  ): Observable<MessageEvent> {
    // 将 异步生成器 (AsyncGenerator) 转换为 RxJS Observable
    return from(this.notesService.chatStreamWithNotes(chatDto, userId)).pipe(
      map((data) => ({ data }) as MessageEvent),
    );
  }

  // --- 对话会话管理接口 ---

  /**
   * 获取会话记录列表
   * @param userId 当前用户ID
   * @returns 用户的对话会话列表
   */
  @Get('conversations')
  @ApiOperation({
    summary: '获取 AI 对话列表',
    description: '返回当前用户的所有历史会话，按活跃时间倒序排列',
  })
  async getConversations(@CurrentUser('userId') userId: number): Promise<any> {
    return await this.notesService.getConversations(userId);
  }

  /**
   * 获取指定会话的历史消息
   * @param id 会话ID
   * @param userId 当前用户ID
   * @returns 指定会话的所有消息记录
   */
  @Get('conversations/:id')
  @ApiOperation({
    summary: '获取会话历史消息',
    description: '拉取指定会话下的完整问答记录，用于构建对话界面',
  })
  async getConversationMessages(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ): Promise<any> {
    return await this.notesService.getConversationMessages(id, userId);
  }

  /**
   * 删除对话会话
   * @param id 会话ID
   * @param userId 当前用户ID
   * @returns 删除操作结果
   */
  @Delete('conversations/:id')
  @ApiOperation({
    summary: '删除对话会话',
    description: '彻底删除该会话及其关联的所有消息记录',
  })
  async deleteConversation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ): Promise<any> {
    return await this.notesService.deleteConversation(id, userId);
  }

  // --- 基础 CRUD 接口 ---

  /**
   * 创建笔记
   * 自动从 Token 中获取当前用户 ID 并关联
   */
  @Post()
  @ApiOperation({
    summary: '创建新笔记',
    description: '创建一条属于当前登录用户的笔记',
  })
  @ApiOkResponse({ description: '笔记创建成功' })
  create(
    @Body() createNoteDto: CreateNoteDto,
    @CurrentUser('userId') userId: number,
  ) {
    // 强制使用当前登录用户的 ID，防止伪造其他人的 userId
    createNoteDto.userId = userId;
    return this.notesService.create(createNoteDto);
  }

  /**
   * 获取笔记列表 (支持高级分页、排序和搜索)
   * 仅返回当前登录用户自己的笔记
   */
  @Get()
  @ApiOperation({
    summary: '获取笔记列表',
    description: '获取当前用户的笔记列表，支持分页、排序和关键字搜索',
  })
  findAll(
    @CurrentUser('userId') userId: number,
    @Query() pageOptions: PageOptionsDto,
  ) {
    return this.notesService.findAll(userId, pageOptions);
  }

  /**
   * 获取笔记详情
   * 会校验笔记是否存在以及是否属于当前用户
   */
  @Get(':id')
  @ApiOperation({
    summary: '获取笔记详情',
    description: '根据 ID 获取笔记详情，需确保笔记属于当前用户',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    return this.notesService.findOne(id, userId);
  }

  /**
   * 更新笔记
   * 包含权限校验逻辑
   */
  @Patch(':id')
  @ApiOperation({
    summary: '更新笔记',
    description: '更新指定 ID 的笔记内容或标签，需确保笔记属于当前用户',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
    @Body() updateNoteDto: UpdateNoteDto,
  ) {
    return this.notesService.update(id, userId, updateNoteDto);
  }

  /**
   * 删除笔记 (软删除)
   * 包含权限校验逻辑
   */
  @Delete(':id')
  @ApiOperation({
    summary: '删除笔记',
    description: '根据 ID 删除指定笔记，需确保笔记属于当前用户',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    return this.notesService.remove(id, userId);
  }
}
