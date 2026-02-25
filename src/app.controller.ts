import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

/**
 * 控制器 (Controller)
 * 负责处理传入的 HTTP 请求，并将响应返回给客户端
 */
@Controller()
export class AppController {
  // 通过构造函数注入 AppService 依赖
  constructor(private readonly appService: AppService) {}

  /**
   * 处理 HTTP GET 请求
   * 路由路径: / (根路径)
   */
  @Get()
  getHello(): string {
    // 调用服务层的业务逻辑
    return this.appService.getHello();
  }
}
