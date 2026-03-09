#!/bin/bash
# ============================================================
# Smart Note API - 一键部署脚本 (本地运行)
# 用途：在你的 Mac 上运行，自动 SSH 到服务器完成部署
# 使用：bash scripts/deploy.sh
# ============================================================

set -e

# --- 颜色输出 ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# --- 配置区 (修改为你的服务器信息) ---
SERVER_USER="root"
SERVER_HOST=""  # <-- 填写你的服务器公网 IP
PROJECT_DIR="/www/wwwroot/learn-ai-backend"

# ============================================================
# 检查配置
# ============================================================
check_config() {
    if [ -z "$SERVER_HOST" ]; then
        echo ""
        read -p "请输入服务器公网 IP: " SERVER_HOST
        if [ -z "$SERVER_HOST" ]; then
            error "服务器 IP 不能为空"
        fi
    fi
}

# ============================================================
# 第一步：本地代码推送到 GitHub
# ============================================================
push_code() {
    info "推送本地代码到 GitHub..."

    cd "$(dirname "$0")/.."

    # 检查是否有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        warn "检测到未提交的更改："
        git status --short
        echo ""
        read -p "是否自动提交这些更改？(y/n): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            git add -A
            read -p "请输入 commit 信息: " msg
            git commit -m "${msg:-update}"
        else
            error "请先手动提交代码再部署"
        fi
    fi

    git push origin main
    info "代码已推送到 GitHub"
}

# ============================================================
# 第二步：SSH 到服务器执行部署
# ============================================================
remote_deploy() {
    info "连接服务器 ${SERVER_USER}@${SERVER_HOST} 执行部署..."

    ssh "${SERVER_USER}@${SERVER_HOST}" bash --login -s <<REMOTE_SCRIPT
set -e

# 加载系统环境变量 (非交互式 SSH 默认不加载，会导致 git/docker 找不到)
source /etc/profile 2>/dev/null || true

echo ""
echo "[INFO] 进入项目目录..."
cd ${PROJECT_DIR}

echo "[INFO] 拉取最新代码..."
git pull origin main

echo "[INFO] 重新构建并启动服务..."
docker compose up -d --build

echo "[INFO] 清理旧镜像..."
docker image prune -f

echo ""
echo "[INFO] 部署完成！当前运行状态："
docker compose ps

echo ""
echo "[INFO] API 地址: http://\$(hostname -I | awk '{print \$1}'):3000"
echo "[INFO] Swagger:  http://\$(hostname -I | awk '{print \$1}'):3000/api-docs"
REMOTE_SCRIPT

    echo ""
    info "远程部署完成！"
}

# ============================================================
# 主流程
# ============================================================
main() {
    echo ""
    echo "======================================"
    echo "  Smart Note API 一键部署"
    echo "======================================"
    echo ""

    check_config
    push_code
    remote_deploy
}

main
