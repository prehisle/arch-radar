# Sealos 生产环境部署指南 - arch-radar

## 概述

本指南介绍如何在 Sealos 云平台上部署 arch-radar 智能备考系统。Sealos 是基于 Kubernetes 的云操作系统，提供了应用商店、数据库服务等开箱即用的功能。

## 架构说明

### 服务组件
- **前端服务** (arch-radar-frontend): Nginx + React，2 副本
- **后端服务** (arch-radar-backend): FastAPI + Python，2 副本
- **MySQL 数据库**: 使用 Sealos 应用商店部署
- **Redis 缓存**: 使用 Sealos 应用商店部署
- **持久化存储**: PVC 存储静态图片资源（约 2.7MB）

### 配置文件清单

```
sealos/base/
├── backend-deployment.yaml   # 后端 Deployment 和 Service
├── frontend-deployment.yaml  # 前端 Deployment 和 Service
├── config.yaml               # ConfigMap 和 Secret
├── pvc.yaml                  # 持久化卷声明（图片存储）
├── ingress.yaml              # Ingress 配置（外部访问）
└── init-job.yaml             # 初始化 Job（上传图片资源）
```

---

## 部署步骤

### 步骤 1: 准备 Sealos 环境

1. **登录 Sealos 控制台**
   - 访问 https://cloud.sealos.io（或您的私有部署地址）
   - 注册/登录账号

2. **创建项目（Namespace）**
   - 在 Sealos 控制台创建新项目，例如：`arch-radar-prod`
   - 记录项目名称，后续操作都在此项目下进行

---

### 步骤 2: 部署 MySQL 数据库

1. **在 Sealos 应用商店搜索 "MySQL"**
2. **选择 MySQL 8.0 版本**
3. **配置参数：**
   - 数据库名称：`zhineng_test_sys`
   - 用户名：`archradar`
   - 密码：设置强密码（记录此密码）
   - 存储大小：10Gi（根据需求调整）
   - 副本数：1（生产环境可设置 3 副本高可用）

4. **部署并等待运行**
5. **记录连接信息：**
   - 服务名称（通常是 `mysql-service` 或自定义名称）
   - 端口（默认 3306）
   - 连接字符串格式：`mysql+pymysql://archradar:<密码>@<服务名>:3306/zhineng_test_sys`

---

### 步骤 3: 部署 Redis 缓存

1. **在 Sealos 应用商店搜索 "Redis"**
2. **选择 Redis 7.0 版本**
3. **配置参数：**
   - Redis 密码：设置强密码（记录此密码）
   - 存储大小：5Gi
   - 持久化模式：AOF（推荐）

4. **部署并等待运行**
5. **记录连接信息：**
   - 服务名称（通常是 `redis-service` 或自定义名称）
   - 端口（默认 6379）
   - 连接字符串格式：`redis://:<密码>@<服务名>:6379/0`

---

### 步骤 4: 构建并推送 Docker 镜像

#### 4.1 构建镜像

```bash
# 在项目根目录执行

# 构建后端镜像
docker build -f docker/Dockerfile.backend -t arch-radar-backend:latest .

# 构建前端镜像
docker build -f docker/Dockerfile.frontend -t arch-radar-frontend:latest .
```

#### 4.2 推送到镜像仓库

**选项 A: 使用阿里云容器镜像服务（推荐）**

```bash
# 登录阿里云镜像仓库
docker login --username=<您的阿里云账号> registry.cn-hangzhou.aliyuncs.com

# 创建命名空间（首次使用需要在阿里云控制台创建）
# 例如：registry.cn-hangzhou.aliyuncs.com/your-namespace/

# 标记镜像
docker tag arch-radar-backend:latest registry.cn-hangzhou.aliyuncs.com/your-namespace/arch-radar-backend:latest
docker tag arch-radar-frontend:latest registry.cn-hangzhou.aliyuncs.com/your-namespace/arch-radar-frontend:latest

# 推送镜像
docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/arch-radar-backend:latest
docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/arch-radar-frontend:latest
```

**选项 B: 使用 Docker Hub**

```bash
# 登录 Docker Hub
docker login

# 标记镜像
docker tag arch-radar-backend:latest <your-dockerhub-username>/arch-radar-backend:latest
docker tag arch-radar-frontend:latest <your-dockerhub-username>/arch-radar-frontend:latest

# 推送镜像
docker push <your-dockerhub-username>/arch-radar-backend:latest
docker push <your-dockerhub-username>/arch-radar-frontend:latest
```

#### 4.3 更新 Deployment 配置

修改 `sealos/base/backend-deployment.yaml` 和 `sealos/base/frontend-deployment.yaml` 中的镜像地址：

```yaml
# 将
image: registry.cn-hangzhou.aliyuncs.com/your-namespace/arch-radar-backend:latest

# 替换为您实际的镜像地址
```

---

### 步骤 5: 配置 Secret 和 ConfigMap

1. **编辑 `sealos/base/config.yaml`**

```bash
nano sealos/base/config.yaml
```

2. **更新以下值：**

```yaml
stringData:
  # 使用步骤 2 中记录的 MySQL 连接信息
  database-url: "mysql+pymysql://archradar:<MySQL密码>@<MySQL服务名>:3306/zhineng_test_sys"

  # 使用步骤 3 中记录的 Redis 连接信息
  redis-url: "redis://:<Redis密码>@<Redis服务名>:6379/0"

  # 您的通义千问 API 密钥
  qwen-api-key: "sk-xxxxxxxxxxxxxxxxxxxxxxxx"

  # 可选：Gemini API 密钥
  gemini-api-key: ""
```

---

### 步骤 6: 部署 Kubernetes 资源

#### 方法 A: 使用 Sealos 控制台（推荐新手）

1. **进入 Sealos 控制台的"应用管理"**
2. **点击"创建应用" → "YAML 部署"**
3. **依次粘贴并部署以下文件：**
   - `sealos/base/config.yaml`（ConfigMap 和 Secret）
   - `sealos/base/pvc.yaml`（持久化卷）
   - `sealos/base/backend-deployment.yaml`（后端服务）
   - `sealos/base/frontend-deployment.yaml`（前端服务）
   - `sealos/base/ingress.yaml`（Ingress，修改域名后部署）

#### 方法 B: 使用 kubectl 命令行

```bash
# 配置 kubectl 访问 Sealos 集群
# （在 Sealos 控制台 → 终端 中获取 kubeconfig）

# 切换到项目命名空间
kubectl config set-context --current --namespace=arch-radar-prod

# 部署配置
kubectl apply -f sealos/base/config.yaml
kubectl apply -f sealos/base/pvc.yaml
kubectl apply -f sealos/base/backend-deployment.yaml
kubectl apply -f sealos/base/frontend-deployment.yaml

# 修改 ingress.yaml 中的域名后部署
kubectl apply -f sealos/base/ingress.yaml
```

---

### 步骤 7: 上传静态图片资源

#### 方法 A: 使用 kubectl cp（推荐）

```bash
# 查找后端 Pod 名称
kubectl get pods -l app=arch-radar-backend

# 上传图片到 PVC（替换 <pod-name> 为实际 Pod 名称）
kubectl cp ziliao/images/ <pod-name>:/app/ziliao/images/

# 验证上传成功
kubectl exec <pod-name> -- ls -la /app/ziliao/images/
```

#### 方法 B: 使用 Sealos 文件管理器

1. 进入 Sealos 控制台 → 文件管理
2. 找到 `arch-radar-images-pvc` 持久化卷
3. 通过 Web 界面上传 `ziliao/images/` 目录中的所有文件

---

### 步骤 8: 配置域名和访问

1. **在 DNS 提供商处添加 A 记录或 CNAME 记录**
   - 指向 Sealos 提供的 Ingress IP 或域名
   - 例如：`arch-radar.example.com` → `<ingress-ip>`

2. **等待 DNS 生效**（通常 5-30 分钟）

3. **访问应用**
   - 前端：`https://arch-radar.example.com/`
   - 后端 API：`https://arch-radar.example.com/api/dashboard/stats`

---

### 步骤 9: 初始化数据

1. **访问管理后台**
   - URL: `https://arch-radar.example.com/admin`

2. **上传初始数据**
   - 上传考试大纲 CSV/文本
   - 上传知识点权重表
   - 上传题目数据

---

## 验证部署

### 检查服务状态

```bash
# 查看所有 Pod 状态
kubectl get pods

# 查看服务状态
kubectl get services

# 查看 Ingress 状态
kubectl get ingress

# 查看 PVC 状态
kubectl get pvc
```

### 查看日志

```bash
# 后端日志
kubectl logs -f deployment/arch-radar-backend

# 前端日志
kubectl logs -f deployment/arch-radar-frontend

# 查看最近 100 行日志
kubectl logs --tail=100 deployment/arch-radar-backend
```

### 测试 API

```bash
# 测试后端健康检查
curl https://arch-radar.example.com/api/dashboard/stats

# 测试前端
curl https://arch-radar.example.com/
```

---

## 更新应用

### 更新代码后重新部署

```bash
# 1. 重新构建镜像（带新标签）
docker build -f docker/Dockerfile.backend -t arch-radar-backend:v1.1.0 .
docker tag arch-radar-backend:v1.1.0 registry.cn-hangzhou.aliyuncs.com/your-namespace/arch-radar-backend:v1.1.0
docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/arch-radar-backend:v1.1.0

# 2. 更新 Deployment
kubectl set image deployment/arch-radar-backend backend=registry.cn-hangzhou.aliyuncs.com/your-namespace/arch-radar-backend:v1.1.0

# 3. 查看滚动更新状态
kubectl rollout status deployment/arch-radar-backend

# 4. 如果更新失败，回滚到上一个版本
kubectl rollout undo deployment/arch-radar-backend
```

---

## 扩容和缩容

```bash
# 扩容后端到 4 个副本
kubectl scale deployment arch-radar-backend --replicas=4

# 缩容前端到 1 个副本
kubectl scale deployment arch-radar-frontend --replicas=1

# 查看当前副本数
kubectl get deployment
```

---

## 监控和告警

### 使用 Sealos 内置监控

1. 进入 Sealos 控制台 → 监控
2. 选择 `arch-radar-prod` 项目
3. 查看 CPU、内存、网络等指标

### 查看资源使用情况

```bash
# 查看 Pod 资源使用
kubectl top pods

# 查看节点资源使用
kubectl top nodes
```

---

## 备份和恢复

### 数据库备份

```bash
# 进入 MySQL Pod
kubectl exec -it <mysql-pod-name> -- bash

# 备份数据库
mysqldump -u archradar -p zhineng_test_sys > /tmp/backup_$(date +%Y%m%d).sql

# 退出 Pod 并复制备份文件到本地
kubectl cp <mysql-pod-name>:/tmp/backup_20250617.sql ./backup_20250617.sql
```

### Redis 备份

```bash
# 进入 Redis Pod
kubectl exec -it <redis-pod-name> -- redis-cli -a <redis-password> SAVE

# 复制 RDB 文件到本地
kubectl cp <redis-pod-name>:/data/dump.rdb ./redis_backup.rdb
```

---

## 故障排查

### 常见问题

**1. Pod 无法启动**

```bash
# 查看 Pod 详细信息
kubectl describe pod <pod-name>

# 查看 Pod 事件
kubectl get events --sort-by=.metadata.creationTimestamp

# 查看 Pod 日志
kubectl logs <pod-name>
```

**2. 后端无法连接数据库**

```bash
# 检查 Secret 配置是否正确
kubectl get secret arch-radar-secrets -o yaml

# 测试数据库连接
kubectl exec -it <backend-pod-name> -- python -c "
from sqlmodel import create_engine
import os
engine = create_engine(os.getenv('DATABASE_URL'))
print('Connection successful!')
"
```

**3. 前端无法访问后端 API**

```bash
# 检查 Service 是否正常
kubectl get svc arch-radar-backend

# 测试 Service 连通性
kubectl run test-pod --image=busybox --rm -it -- wget -O- http://arch-radar-backend:8000/api/dashboard/stats
```

**4. Ingress 无法访问**

```bash
# 检查 Ingress 配置
kubectl describe ingress arch-radar-ingress

# 查看 Ingress 控制器日志
kubectl logs -n ingress-nginx deployment/nginx-ingress-controller
```

**5. 静态图片无法加载**

```bash
# 检查 PVC 是否正常挂载
kubectl describe pvc arch-radar-images-pvc

# 进入 Pod 检查文件是否存在
kubectl exec -it <backend-pod-name> -- ls -la /app/ziliao/images/
```

---

## 成本优化建议

1. **合理设置资源限制**：避免过度分配资源
2. **使用自动扩缩容**：根据负载自动调整副本数（HPA）
3. **选择合适的存储类型**：SSD vs HDD
4. **启用资源配额**：限制项目总资源使用量
5. **定期清理未使用的资源**：旧镜像、日志文件等

---

## 安全加固

1. **使用 HTTPS**：配置 TLS 证书（Let's Encrypt）
2. **网络策略**：限制 Pod 之间的网络访问
3. **密钥管理**：使用 Sealos Secrets 或外部密钥管理服务
4. **镜像扫描**：定期扫描镜像漏洞
5. **RBAC 配置**：限制用户权限

---

## 与本地 docker-compose 的对比

| 特性 | docker-compose（本地测试） | Sealos（生产环境） |
|------|---------------------------|-------------------|
| 部署方式 | 单机 Docker | Kubernetes 集群 |
| 高可用 | ❌ 不支持 | ✅ 支持多副本 |
| 自动扩缩容 | ❌ 不支持 | ✅ 支持 HPA |
| 负载均衡 | ❌ 单实例 | ✅ Service 自动负载均衡 |
| 数据持久化 | 本地卷 | 云端 PVC（高可用存储） |
| 监控告警 | 需手动配置 | 内置监控面板 |
| 滚动更新 | ❌ 需手动重启 | ✅ 零停机滚动更新 |
| 成本 | 免费（自有服务器） | 按需付费（弹性计费） |
| 适用场景 | 开发测试 | 生产环境 |

---

## 下一步

1. **配置 CI/CD 流程**：自动化构建和部署
2. **集成日志聚合**：ELK Stack 或 Loki
3. **配置监控告警**：Prometheus + Grafana
4. **实施灾难恢复计划**：定期备份和演练
5. **性能优化**：CDN、缓存策略、数据库索引

---

## 参考链接

- **Sealos 官方文档**: https://sealos.io/docs
- **Kubernetes 官方文档**: https://kubernetes.io/docs
- **项目 GitHub 仓库**: (您的仓库地址)

---

**部署完成！** 如有任何问题，请查看故障排查章节或联系技术支持。
