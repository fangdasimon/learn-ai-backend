import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

/**
 * AI 服务提供者
 * 基于 OpenAI SDK 对接硅基流动 (SiliconFlow) API
 * 提供笔记摘要、标签推荐及文本润色功能
 */
@Injectable()
export class AiService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(AiService.name);
  private readonly model = 'Qwen/Qwen2.5-7B-Instruct'; // 默认生成模型
  private readonly embeddingModel = 'BAAI/bge-large-zh-v1.5'; // 默认向量生成模型 (1024 维)

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: process.env.SILICONFLOW_BASE_URL,
      timeout: 60 * 1000, // 增加客户端超时至 60 秒，应对向量服务波动
    });
  }

  /**
   * 生成文本向量 (Embedding)
   * 增加重试逻辑：针对由于网络波动导致的超时进行最多 3 次重试
   * @param text 待向量化的文本
   * @returns 1024 维度的浮点数数组
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      try {
        const response = await this.client.embeddings.create({
          model: this.embeddingModel,
          input: text,
        });

        const duration = Date.now() - startTime;
        if (attempt > 1) {
          this.logger.log(
            `Embedding 重试成功 (第 ${attempt} 次)，耗时: ${duration}ms`,
          );
        }
        const embedding = response.data[0].embedding;

        // 校验嵌入向量维度
        if (!Array.isArray(embedding) || embedding.length !== 1024) {
          throw new Error(
            `嵌入维度不匹配: 期望 1024 维，实际 ${Array.isArray(embedding) ? embedding.length : 'N/A'}`,
          );
        }

        // 校验向量值为有效浮点数
        if (embedding.some((v) => typeof v !== 'number' || !isFinite(v))) {
          throw new Error('嵌入向量包含无效浮点数');
        }

        return embedding;
      } catch (error: any) {
        lastError = error;
        const duration = Date.now() - startTime;

        // 如果是超时或其他网络暂时性错误，且未达到最大重试次数，则重试
        if (
          attempt < maxRetries &&
          (error.message.includes('timeout') ||
            error.status === 429 ||
            error.status >= 500)
        ) {
          this.logger.warn(
            `Embedding 生成尝试失败 (第 ${attempt}/${maxRetries}), 耗时: ${duration}ms, 错误: ${error.message}. 正在重试...`,
          );
          // 指数退避 + 抖动，上限 5 秒
          const baseDelay = attempt * 500;
          const jitter = Math.random() * 300;
          const delay = Math.min(baseDelay + jitter, 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        this.logger.error(
          `Embedding 生成最终失败 (第 ${attempt} 次): ${error.message}`,
          error.stack,
          'AiService.generateEmbedding',
        );
        break;
      }
    }

    throw new Error(
      `AI 向量化服务异常 (已重试 ${maxRetries} 次): ${lastError?.message || '未知错误'}`,
    );
  }

  /**
   * 生成笔记摘要
   * @param content 笔记正文
   * @returns 50字以内的核心摘要
   */
  async generateSummary(content: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的笔记助理。请将输入的笔记内容总结成一段简洁的摘要，字数控制在50字以内。',
          },
          {
            role: 'user',
            content: content,
          },
        ],
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content?.trim() || '无法生成摘要';
    } catch (error: any) {
      // 增强日志记录，将具体的 API 报错详情打印出来
      this.logger.error(
        `AI 摘要生成失败: ${error.message}`,
        error.stack,
        'AiService.generateSummary',
      );
      throw new Error(`AI 服务异常: ${error.message || '未知错误'}`);
    }
  }

  /**
   * 智能标签推荐
   * @param content 笔记内容
   * @returns 3-5个字符串标签组成的数组
   */
  async recommendTags(content: string): Promise<string[]> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              '你是一个笔记分类专家。请根据提供的笔记内容，提取出3-5个核心关键词标签。' +
              '请直接返回 JSON 格式的字符串数组，例如: ["科技", "后端", "NestJS"]。不要有任何多余的解释。',
          },
          {
            role: 'user',
            content: content,
          },
        ],
        // 尝试启用 JSON Mode (部分模型支持)
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0]?.message?.content || '[]';
      let tags: string[];

      // 解析 JSON 数组
      try {
        const parsed = JSON.parse(rawContent) as unknown;
        if (Array.isArray(parsed)) {
          tags = parsed.map(String);
        } else if (typeof parsed === 'object' && parsed !== null) {
          tags = Object.values(parsed).flat().map(String);
        } else {
          tags = [];
        }
      } catch {
        // 兜底方案：正则提取或简单分割 (去除非法字符)
        tags = rawContent.replace(/[[\]"]/g, '').split(/[,，]/);
      }

      // 校验标签名：只允许字母数字、中文、连字符、下划线，限制长度 50
      return tags
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 50)
        .filter((t) => /^[\w\u4e00-\u9fff\-]+$/u.test(t))
        .slice(0, 10);
    } catch (error: any) {
      this.logger.error(
        `AI 标签推荐失败: ${error.message}`,
        error.stack,
        'AiService.recommendTags',
      );
      return [];
    }
  }

  /**
   * 文本润色
   * @param content 原始文本
   * @returns 润色后的版本 (优化排版和措辞)
   */
  async polishContent(content: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              '你是一个擅长写作的助手。请将输入的文字进行润色，修正错别字，优化排版（使用 Markdown），并使措辞更专业、通顺，但不要改变原意。',
          },
          {
            role: 'user',
            content: content,
          },
        ],
      });

      return response.choices[0]?.message?.content?.trim() || content;
    } catch (error: any) {
      this.logger.error(
        `AI 润色失败: ${error.message}`,
        error.stack,
        'AiService.polishContent',
      );
      return content;
    }
  }

  /**
   * 语义搜索检索最相关的笔记切片 (同步调用，供 internal 使用)
   * 也可以在这里定义 Message 接口以解耦
   */

  /**
   * 基于上下文的智能对话 (RAG 核心 - 非流式)
   * @param query 用户提问
   * @param context 检索到的背景知识
   * @returns 结合知识库生成的完整回答
   */
  async chatWithContext(query: string, context: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              '你是一个基于个人笔记库的问答助手。' +
              '请严格根据我提供的[背景资料]来回答用户的问题。如果资料中没有相关信息，请委婉地告知用户。' +
              '【重要】只要你的回答参考了资料内容，必须在相关段落末尾或回答结束处显式地注明来源，格式为：“（引用自笔记:《笔记标题》）”。' +
              '回答要客观、中肯，保持专业语气。' +
              `\n\n[背景资料]:\n${context}`,
          },
          { role: 'user', content: query },
        ],
      });

      return (
        response.choices[0]?.message?.content?.trim() ||
        '无法根据现有笔记回答此问题'
      );
    } catch (error: any) {
      this.logger.error(
        `RAG 对话失败: ${error.message}`,
        error.stack,
        'AiService.chatWithContext',
      );
      throw new Error(`AI 服务异常: ${error.message}`);
    }
  }

  /**
   * 支持流式输出的智能对话 (RAG + SSE 核心)
   * @param query 用户当前提问
   * @param context 检索到的背景知识
   * @param history 历史对话记录
   */
  async *chatStreamWithContext(
    query: string,
    context: string,
    history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [],
  ) {
    try {
      const messages: any[] = [
        {
          role: 'system',
          content:
            '你是一个基于个人笔记库的问答助手。' +
            '请严格根据我提供的[背景资料]来回答用户的问题。如果资料中没有相关信息，请委婉地告知用户。' +
            '【重要】只要你的回答参考了资料内容，必须在相关段落末尾或回答结束处显式地注明来源，格式为：“（引用自笔记:《笔记标题》）”。' +
            '回答要客观、中肯，保持专业语气。' +
            `\n\n[背景资料]:\n${context}`,
        },
        ...history, // 注入历史上下文
        { role: 'user', content: query }, // 注入当前问题
      ];

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        stream: true, // 开启流式输出
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content; // 逐块推送内容
        }
      }
    } catch (error: any) {
      this.logger.error(
        `RAG 流式对话失败: ${error.message}`,
        error.stack,
        'AiService.chatStreamWithContext',
      );
      throw new Error(`AI 服务流式输出异常: ${error.message}`);
    }
  }
}
