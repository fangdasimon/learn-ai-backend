import { Type } from 'class-transformer';

/**
 * 分页请求参数 DTO
 * 用于标准化分页接口的输入
 */
export class PageOptionsDto {
  /**
   * 当前页码
   * @default 1
   */
  @Type(() => Number)
  page?: number = 1;

  /**
   * 每页条数
   * @default 10
   */
  @Type(() => Number)
  limit?: number = 10;

  /**
   * 排序字段
   * @default createdAt
   */
  orderBy?: string = 'createdAt';

  /**
   * 排序方向
   * @default desc
   */
  order?: 'asc' | 'desc' = 'desc';

  /**
   * 搜索关键词 (可选)
   */
  keyword?: string;
}

/**
 * 分页响应元数据
 * 包含总条数、总页数等信息
 */
export interface PageMetaDto {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * 通用的分包装响应接口
 * @template T 列表数据的类型
 */
export class PageDto<T> {
  data: T[];
  meta: PageMetaDto;

  constructor(data: T[], total: number, pageOptions: PageOptionsDto) {
    this.data = data;
    const limit = Number(pageOptions.limit) || 10;
    const page = Number(pageOptions.page) || 1;

    this.meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }
}
