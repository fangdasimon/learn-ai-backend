# --- 第一阶段：构建阶段 (Build Stage) ---
# 使用 DaoCloud 公开镜像站代理拉取 Node.js 20 镜像 (当前国内较稳的方案)
FROM docker.m.daocloud.io/library/node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 先复制包管理文件，利用 Docker 层缓存优化
COPY package*.json ./
COPY prisma ./prisma/

# 安装所有依赖 (包括开发依赖，以便编译 TypeScript)
# 针对国内环境进行深度优化：
# 1. 使用 npmmirror 镜像源
# 2. 增加重试次数 (fetch-retries=5)
# 3. 延长超时时间 (fetch-timeout=600000) 
# 以对抗频繁的 ECONNRESET 网络重置错误
RUN npm config set registry https://registry.npmmirror.com && \
  npm config set fetch-retries 5 && \
  npm config set fetch-retry-mintimeout 10000 && \
  npm config set fetch-retry-maxtimeout 60000 && \
  npm config set fetch-timeout 600000 && \
  npm install

# 复制项目所有源文件
COPY . .

# 生成 Prisma Client 代码 (必须在 build 之前)
RUN npx prisma generate

# 编译 TypeScript 源代码到 dist 目录
RUN npm run build

# --- 第二阶段：生产运行阶段 (Production Stage) ---
# 使用轻量级的镜像源
FROM docker.m.daocloud.io/library/node:20-alpine

WORKDIR /app

# 从构建阶段复制必要文件
# 1. 编译后的代码
COPY --from=builder /app/dist ./dist
# 2. 生产环境依赖
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
# 3. Prisma 定义文件 (用于容器启动时的数据库同步)
COPY --from=builder /app/prisma ./prisma
# 4. Prisma 配置文件 (Prisma v7 需要 prisma.config.ts)
COPY --from=builder /app/prisma.config.ts ./

# 设置环境变量默认值 (可在运行容器时重写)
ENV NODE_ENV=production
ENV PORT=3000

# 暴露 3000 端口
EXPOSE 3000

# 启动命令：运行编译后的 entrypoint
# 提示：实际生产环境建议通过 docker-compose 或 k8s 运行 prisma db push
CMD ["node", "dist/src/main.js"]
