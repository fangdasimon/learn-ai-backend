import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

/**
 * AI 对话请求 DTO
 * 升级版：由后端自动通过 conversationId 管理上下文记忆
 */
export class ChatDto {
  @ApiProperty({
    description: '当前用户提出的问题',
    example: 'Vue3 的核心优势是什么？',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    description: '会话 ID (若不传则系统会自动创建新会话)',
    example: 1001,
    required: false,
  })
  @IsOptional()
  @IsInt()
  conversationId?: number;
}
