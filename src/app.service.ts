import { Injectable } from '@nestjs/common';

/**
 * 服务 (Service) / 提供者 (Provider)
 * 负责处理复杂的业务逻辑，可以被注入到控制器或其他服务中
 */
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World12!';
  }
}
