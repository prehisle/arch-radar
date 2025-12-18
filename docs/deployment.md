# arch-radar 部署配置

本目录包含 arch-radar 项目的所有部署配置文件。

## 📁 目录结构

```
.
├── docker/                        # Docker 本地开发/测试配置
│   ├── Dockerfile.backend         # 后端 Dockerfile
│   ├── Dockerfile.frontend        # 前端 Dockerfile
│   ├── nginx.conf                 # Nginx 配置
│   └── mysql-init/
│       └── 01-init.sql            # MySQL 初始化脚本
├── sealos/                        # Sealos 生产环境配置
│   ├── base/                      # 基础 Kubernetes 配置
│   │   ├── backend-deployment.yaml
│   │   ├── frontend-deployment.yaml
│   │   ├── config.yaml
│   │   ├── pvc.yaml
│   │   ├── ingress.yaml
│   │   └── init-job.yaml
│   ├── deploy-sealos.sh           # 快速部署脚本
│   └── DEPLOY.md                  # Sealos 部署详细文档
├── docker-compose.yml             # Docker Compose 配置
├── .dockerignore                  # Docker 构建排除文件
├── .env.production                # 生产环境变量模板
└── backend/requirements-prod.txt  # 生产环境依赖

```

## 🚀 快速开始

### 本地开发/测试（docker-compose）

适用于本地开发和测试环境。

```bash
# 1. 配置环境变量
cp .env.production .env
nano .env  # 修改数据库密码和 API 密钥

# 2. 启动所有服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 访问应用
# 前端: http://localhost:80
# 后端: http://localhost:8000/api/dashboard/stats
```

详细说明请查看根目录的计划文件。

### 生产环境（Sealos）

适用于云端生产环境部署。

```bash
# 1. 构建并推送镜像到镜像仓库
docker build -f docker/Dockerfile.backend -t your-registry/arch-radar-backend:latest .
docker build -f docker/Dockerfile.frontend -t your-registry/arch-radar-frontend:latest .
docker push your-registry/arch-radar-backend:latest
docker push your-registry/arch-radar-frontend:latest

# 2. 修改配置文件
# - 更新 sealos/base/config.yaml 中的数据库连接信息和 API 密钥
# - 更新 sealos/base/*-deployment.yaml 中的镜像地址

# 3. 部署到 Sealos
cd sealos
./deploy-sealos.sh

# 或手动部署
kubectl apply -f base/config.yaml
kubectl apply -f base/pvc.yaml
kubectl apply -f base/backend-deployment.yaml
kubectl apply -f base/frontend-deployment.yaml
kubectl apply -f base/ingress.yaml
```

详细说明请查看 [sealos/DEPLOY.md](../sealos/DEPLOY.md)

## 📊 架构对比

| 特性 | docker-compose | Sealos |
|------|----------------|--------|
| 适用场景 | 本地开发测试 | 生产环境 |
| 高可用 | ❌ | ✅ 多副本 |
| 自动扩缩容 | ❌ | ✅ HPA |
| 负载均衡 | ❌ | ✅ 自动 |
| 滚动更新 | ❌ | ✅ 零停机 |
| 成本 | 免费 | 按需付费 |

## 🔧 主要组件

### Docker Compose 部署
- **MySQL 8.0**: 数据库服务
- **Redis 7.0**: 缓存服务
- **Backend**: FastAPI + gunicorn（4 workers）
- **Frontend**: Nginx + React（生产构建）

### Sealos 部署
- **Backend Deployment**: 2 副本，自动健康检查
- **Frontend Deployment**: 2 副本，Nginx 服务
- **MySQL & Redis**: 使用 Sealos 应用商店部署
- **PVC**: 5Gi 持久化存储（静态图片）
- **Ingress**: HTTPS + 域名访问

## 📝 配置说明

### 环境变量

所有环境变量在以下文件中配置：
- **docker-compose**: `.env.production`
- **Sealos**: `sealos/base/config.yaml`

必需配置：
- `DATABASE_URL`: MySQL 连接字符串
- `REDIS_URL`: Redis 连接字符串
- `QWEN_API_KEY`: 通义千问 API 密钥
- `AI_PROVIDER`: AI 提供商（qwen 或 gemini）

### 镜像仓库

支持以下镜像仓库：
- 阿里云容器镜像服务（推荐国内使用）
- Docker Hub
- 私有 Harbor 仓库

### 资源限制

| 服务 | CPU 请求 | CPU 限制 | 内存请求 | 内存限制 |
|------|----------|----------|----------|----------|
| Backend | 500m | 2000m | 512Mi | 2Gi |
| Frontend | 100m | 500m | 128Mi | 256Mi |
| MySQL | - | 1000m | 512Mi | 1Gi |
| Redis | - | 500m | - | 512Mi |

## 🛠️ 常用命令

### Docker Compose

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose stop

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f backend

# 清理（保留数据）
docker-compose down
```

### Sealos (kubectl)

```bash
# 查看所有资源
kubectl get all

# 查看 Pod 日志
kubectl logs -f deployment/arch-radar-backend

# 扩容
kubectl scale deployment arch-radar-backend --replicas=4

# 滚动更新
kubectl set image deployment/arch-radar-backend backend=new-image:tag

# 回滚
kubectl rollout undo deployment/arch-radar-backend
```

## 📖 文档

- **本地部署**: 查看项目计划文件 `.claude/plans/swirling-drifting-moon.md`
- **Sealos 部署**: [sealos/DEPLOY.md](../sealos/DEPLOY.md)
- **项目文档**: [CLAUDE.md](../CLAUDE.md)
- **API 文档**: 运行后访问 `http://localhost:8000/docs`

## 🔐 安全建议

1. **强密码策略**: 数据库和 Redis 使用 16+ 位强密码
2. **HTTPS 配置**: 生产环境务必启用 HTTPS
3. **Secret 管理**: 不要将 Secret 文件提交到 Git
4. **镜像扫描**: 定期扫描镜像漏洞
5. **访问控制**: 配置 Kubernetes RBAC 和网络策略

## 🐛 故障排查

常见问题和解决方案请查看：
- Docker Compose: 项目计划文件中的"故障排查"章节
- Sealos: [sealos/DEPLOY.md](../sealos/DEPLOY.md) 中的"故障排查"章节

## 📞 技术支持

如遇到问题，请：
1. 查看相关文档
2. 检查服务日志
3. 提交 Issue 到项目仓库

---

**Happy Deploying! 🎉**
