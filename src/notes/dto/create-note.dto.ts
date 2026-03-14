import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  MaxLength,
} from 'class-validator';

/**
 * 创建笔记 DTO
 * 包含创建笔记所需的全部信息
 */
export class CreateNoteDto {
  @ApiProperty({ description: '笔记标题', example: '我的第一篇笔记' })
  @IsString({ message: '标题必须是字符串' })
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(200, { message: '标题最长 200 字符' })
  title: string;

  @ApiProperty({
    description: '笔记内容',
    example: '今天学习了 NestJS 进阶知识。',
  })
  @IsString({ message: '内容必须是字符串' })
  @IsNotEmpty({ message: '内容不能为空' })
  @MaxLength(50000, { message: '内容最长 50000 字符' })
  content: string;

  @ApiPropertyOptional({
    description: '关联的用户 ID (后台会自动根据 Token 填充，通常无需手动传)',
    example: 1,
  })
  @IsInt({ message: '用户 ID 必须是整数' })
  @IsOptional()
  userId?: number;

  @ApiPropertyOptional({
    description: '标签名称列表',
    example: ['学习', '后端'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: '标签必须是数组' })
  @IsString({ each: true, message: '每个标签名必须是字符串' })
  tags?: string[];
}
