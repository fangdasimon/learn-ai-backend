// 这是一个 Prisma 配置文件 (Prisma v7 新增)
// 确保安装了相关依赖: npm install --save-dev prisma dotenv
import 'dotenv/config'; // 加载 .env 文件中的环境变量
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // 指定 Prisma Schema 文件的位置
  schema: 'prisma/schema.prisma',
  // 配置迁移文件的存储路径
  migrations: {
    path: 'prisma/migrations',
  },
  // 配置数据源
  datasource: {
    // 从环境变量中获取数据库连接字符串
    // 这样做可以避免将敏感信息硬编码在代码中
    url: process.env['DATABASE_URL'],
  },
});
