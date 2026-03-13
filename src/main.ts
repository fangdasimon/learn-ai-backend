// 加载 .env 环境变量 (必须在所有其他 import 之前)
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

/**
 * 应用程序入口函数
 */
async function bootstrap() {
  // 使用 NestFactory 创建应用实例，传入根模块 AppModule
  const app = await NestFactory.create(AppModule);

  // --- CORS 配置 (允许前端跨域请求) ---
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // --- 全局配置 ---

  // 1. 注册全局验证管道 (ValidationPipe)
  // transform: true 允许在 DTO 中自动将字符串转为数字或布尔值 (如分页参数)
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 2. 注册全局响应拦截器 (TransformInterceptor)
  // 统一包装返回结构为 { code: 200, data: ..., message: "Success" } (对齐阶段二验收标准)
  app.useGlobalInterceptors(new TransformInterceptor());

  // 3. 注册全局异常过滤器 (HttpExceptionFilter)
  // 统一捕获异常并返回 { code: HTTP_STATUS, message: ..., data: null }
  app.useGlobalFilters(new HttpExceptionFilter());

  // --- Swagger 接口文档配置 ---
  const config = new DocumentBuilder()
    .setTitle('AI 智能笔记 API')
    .setDescription(
      '这是 AI 智能笔记项目的后端 API 接口文档，您可以在此进行接口调试。',
    )
    .setVersion('1.0')
    .addBearerAuth() // 启用 JWT Bearer 认证支持
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // 访问路径设定为 /api-docs
  SwaggerModule.setup('api-docs', app, document);

  // 监听端口，环境变量 PORT 或默认 3000
  await app.listen(process.env.PORT ?? 3000);

  console.log(`\n🚀 应用启动成功！`);
  console.log(`🔗 API 基础地址: http://localhost:3000`);
  console.log(`📖 Swagger 文档地址: http://localhost:3000/api-docs\n`);
}

// 执行引导
void bootstrap();
