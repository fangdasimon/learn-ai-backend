import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { UpdateTagDto } from './dto/update-tag.dto.js';

/**
 * 标签服务
 * 处理标签的增删改查
 */
@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建标签
   */
  create(createTagDto: CreateTagDto) {
    return this.prisma.tag.create({
      data: {
        name: createTagDto.name,
      },
    });
  }

  /**
   * 获取所有标签
   */
  findAll() {
    return this.prisma.tag.findMany({
      include: {
        _count: {
          select: { notes: true }, // 返回每个标签关联的笔记数量
        },
      },
    });
  }

  /**
   * 获取标签详情
   */
  findOne(id: number) {
    return this.prisma.tag.findUnique({
      where: { id },
      include: {
        notes: true, // 关联查询该标签下的所有笔记
      },
    });
  }

  /**
   * 更新标签
   */
  update(id: number, updateTagDto: UpdateTagDto) {
    return this.prisma.tag.update({
      where: { id },
      data: updateTagDto,
    });
  }

  /**
   * 删除标签
   */
  remove(id: number) {
    return this.prisma.tag.delete({
      where: { id },
    });
  }
}
