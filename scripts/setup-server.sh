#!/bin/bash
# ============================================================
# Smart Note API - 腾讯云服务器初始化脚本 (CentOS / AlmaLinux)
# 用途：首次部署时在服务器上运行，一键完成环境搭建
# 使用：ssh root@你的服务器IP，然后运行此脚本
# ============================================================

set -e  # 任何命令失败立即退出

# --- 颜色输出 ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# --- 配置区 (按需修改) ---
PROJECT_DIR="/www/wwwroot/learn-ai-backend"
REPO_URL="https://github.com/fangdasimon/learn-ai-backend.git"

# ============================================================
# 第一步：安装 Docker
# ============================================================
install_docker() {
    if command -v docker &> /dev/null; then
        info "Docker 已安装: $(docker --version)"
        return
    fi

    info "正在安装 Docker..."

    # 卸载旧版本
    yum remove -y docker docker-client docker-client-latest \
        docker-common docker-latest docker-latest-logrotate \
        docker-logrotate docker-engine 2>/dev/null || true

    # 修复 RPM 数据库
    info "修复 RPM 数据库..."
    cd /var/lib/rpm && rm -f __db* && rpm --rebuilddb && yum clean all

    # 安装依赖工具
    yum install -y yum-utils epel-release

    # 检查 CentOS 7 是否还能访问官方源，如果不行使用 vault
    if ! yum repolist | grep -q extras; then
        info "CentOS 7 官方源已停止，切换到 Vault 归档源..."
        mkdir -p /etc/yum.repos.d/backup
        mv /etc/yum.repos.d/CentOS-*.repo /etc/yum.repos.d/backup/ 2>/dev/null || true
        
        cat > /etc/yum.repos.d/CentOS-Vault.repo <<'VAULT_EOF'
[base]
name=CentOS 7.9.2009 - Base
baseurl=http://vault.centos.org/7.9.2009/os/$basearch/
enabled=1
gpgcheck=0

[updates]
name=CentOS 7.9.2009 - Updates
baseurl=http://vault.centos.org/7.9.2009/updates/$basearch/
enabled=1
gpgcheck=0

[extras]
name=CentOS 7.9.2009 - Extras
baseurl=http://vault.centos.org/7.9.2009/extras/$basearch/
enabled=1
gpgcheck=0
VAULT_EOF
        yum clean all
    fi

    # 先安装 Docker 依赖包
    info "安装 Docker 依赖包..."
    yum install -y container-selinux fuse-overlayfs slirp4netns --skip-broken || true

    # 添加 Docker 仓库（使用阿里云镜像）
    yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo  

    # 安装 Docker（使用 --skip-broken 跳过问题包）
    yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin --skip-broken

    # 启动 Docker
    systemctl start docker
    systemctl enable docker

    info "Docker 安装完成: $(docker --version)"
    info "Docker Compose 版本: $(docker compose version)"
}

# ============================================================
# 第二步：配置 Docker 镜像加速 (2026年最新可用源)
# ============================================================
configure_docker_mirror() {
    info "配置 Docker 镜像加速..."

    mkdir -p /etc/docker
    
    # 2026年最新可用的镜像加速源
    cat > /etc/docker/daemon.json <<'EOF'
{
    "registry-mirrors": [
        "https://docker.m.daocloud.io",
        "https://mirror.ccs.tencentyun.com",
        "https://docker.1panel.live",
        "https://hub.rat.dev"
    ],
    "dns": [
        "8.8.8.8",
        "114.114.114.114",
        "223.5.5.5"
    ]
}
EOF

    systemctl daemon-reload
    systemctl restart docker
    
    # 验证配置
    info "验证 Docker 镜像配置..."
    if docker info 2>&1 | grep -q "Registry Mirrors"; then
        info "Docker 镜像加速配置完成"
    else
        warn "Docker 镜像配置可能未生效，请检查 /etc/docker/daemon.json"
    fi
}

# ============================================================
# 第三步：安装 Git (如未安装)
# ============================================================
install_git() {
    if command -v git &> /dev/null; then
        info "Git 已安装: $(git --version)"
        return
    fi

    info "正在安装 Git..."
    yum install -y git
    info "Git 安装完成"
}

# ============================================================
# 第四步：克隆项目代码
# ============================================================
clone_project() {
    if [ -d "$PROJECT_DIR/.git" ]; then
        info "项目已存在，正在拉取最新代码..."
        cd "$PROJECT_DIR"
        git pull origin main
        return
    fi

    info "正在克隆项目..."
    mkdir -p "$(dirname "$PROJECT_DIR")"
    git clone "$REPO_URL" "$PROJECT_DIR"
    info "项目克隆完成"
}

# ============================================================
# 第五步：配置环境变量
# ============================================================
configure_env() {
    local ENV_FILE="$PROJECT_DIR/.env"

    if [ -f "$ENV_FILE" ]; then
        warn ".env 文件已存在，跳过创建。如需修改请手动编辑: $ENV_FILE"
        return
    fi

    info "配置环境变量..."

    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -base64 32)

    # 交互式输入 API Key
    echo ""
    read -p "请输入你的硅基流动 API Key (SILICONFLOW_API_KEY): " SILICONFLOW_KEY
    echo ""

    cat > "$ENV_FILE" <<EOF
# --- 数据库配置 (Docker Compose 内部网络，使用服务名 'db') ---
DATABASE_URL="postgresql://postgres:postgres@db:5432/smart_note_db?schema=public"

# --- JWT 密钥 ---
JWT_SECRET="${JWT_SECRET}"

# --- 硅基流动 API 配置 ---
SILICONFLOW_BASE_URL="https://api.siliconflow.cn/v1"
SILICONFLOW_API_KEY="${SILICONFLOW_KEY}"
EOF

    chmod 600 "$ENV_FILE"
    info ".env 文件创建完成 (权限已设为 600)"
}

# ============================================================
# 第六步：开放防火墙端口
# ============================================================
configure_firewall() {
    info "配置防火墙..."

    # 检查 firewalld 是否运行
    if systemctl is-active --quiet firewalld; then
        firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
        info "防火墙已放行 3000 端口"
    else
        warn "firewalld 未运行，请确认腾讯云控制台的安全组已放行 3000 端口"
    fi

    echo ""
    warn "重要提醒：请登录腾讯云控制台 -> 轻量应用服务器 -> 防火墙"
    warn "添加规则：协议 TCP，端口 3000，来源 0.0.0.0/0"
    echo ""
}

# ============================================================
# 第七步：首次构建并启动服务
# ============================================================
start_services() {
    info "正在构建并启动服务 (首次构建可能需要几分钟)..."

    cd "$PROJECT_DIR"

    # 先测试 Docker 能否正常拉取镜像
    info "测试 Docker 连接..."
    if ! docker pull hello-world:latest; then
        error "Docker 拉取镜像失败，请检查网络连接和镜像源配置"
    fi

    # 构建并启动
    docker compose up -d --build

    echo ""
    info "============================================"
    info "  部署完成！"
    info "============================================"
    info "  API 地址:     http://$(hostname -I | awk '{print $1}'):3000"
    info "  Swagger 文档: http://$(hostname -I | awk '{print $1}'):3000/api-docs"
    info "  查看日志:     cd $PROJECT_DIR && docker compose logs -f"
    info "============================================"
    echo ""
}

# ============================================================
# 主流程
# ============================================================
main() {
    echo ""
    echo "======================================"
    echo "  Smart Note API 服务器初始化脚本"
    echo "======================================"
    echo ""

    # 检查是否 root 用户
    if [ "$EUID" -ne 0 ]; then
        error "请使用 root 用户运行此脚本: sudo bash setup-server.sh"
    fi

    install_docker
    configure_docker_mirror
    install_git
    clone_project
    configure_env
    configure_firewall
    start_services
}

main