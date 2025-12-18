# Sealos UI 部署指南 - arch-radar

本指南提供通过 Sealos Web UI 部署 arch-radar 智能备考系统的详细步骤，无需编写 Kubernetes YAML 配置。

## 📋 目录

- [前置准备](#前置准备)
- [步骤 1: 部署 MySQL 数据库](#步骤-1-部署-mysql-数据库)
- [步骤 2: 部署 Redis 缓存](#步骤-2-部署-redis-缓存)
- [步骤 3: 部署后端服务](#步骤-3-部署后端服务)
- [步骤 4: 部署前端服务](#步骤-4-部署前端服务)
- [步骤 5: 配置域名和 HTTPS](#步骤-5-配置域名和-https)
- [步骤 6: 初始化数据](#步骤-6-初始化数据)
- [步骤 7: 验证和测试](#步骤-7-验证和测试)
- [常见问题](#常见问题)
- [后续维护](#后续维护)

---

## 前置准备

### 1. 注册 Sealos 账号

访问 [https://cloud.sealos.io](https://cloud.sealos.io) 注册并登录账号。

### 2. 了解项目架构

**服务组件：**
- **MySQL 8.0**：主数据库（存储题目、用户数据、考试记录）
- **Redis 7.0**：缓存和会话管理
- **Backend**：FastAPI + Python 后端（API 服务）
- **Frontend**：Nginx + React 前端（Web 界面）

**镜像地址（GitHub Actions 自动构建）：**
- 后端：`ghcr.io/<your-github-username>/arch-radar-backend:latest`
- 前端：`ghcr.io/<your-github-username>/arch-radar-frontend:latest`

### 3. 准备环境变量

需要准备以下信息：
- **通义千问 API 密钥**（必需）：从 [阿里云百炼平台](https://bailian.console.aliyun.com/) 获取
- 或 **Gemini API 密钥**（可选）：从 Google AI Studio 获取
- **HTTP 代理**（可选）：如果需要代理访问 AI API

---

## 步骤 1: 部署 MySQL 数据库

### 1.1 进入应用商店

1. 登录 Sealos 控制台
2. 点击左侧菜单 **"应用商店"** 或 **"App Store"**
3. 在搜索框中输入 **"MySQL"**

### 1.2 配置 MySQL 参数

选择 **MySQL 8.0** 版本，填写以下配置：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| **应用名称** | `arch-radar-mysql` | 便于识别 |
| **数据库名称** | `zhineng_test_sys` | 应用数据库名 |
| **用户名** | `archradar` | 数据库用户 |
| **密码** | 自定义强密码 | ⚠️ **请记录此密码** |
| **Root 密码** | 自定义强密码 | 管理员密码 |
| **存储大小** | `10Gi` | 根据需求调整 |
| **副本数** | `1` | 测试环境 1 个，生产环境可选 3 个（高可用） |
| **CPU** | `1 核` | 根据负载调整 |
| **内存** | `2Gi` | 根据负载调整 |

### 1.3 部署并记录连接信息

1. 点击 **"部署"** 或 **"Deploy"**
2. 等待状态变为 **"Running"**（约 1-2 分钟）
3. 点击应用详情，记录以下信息：
   - **服务名称（Host）**：通常是 `arch-radar-mysql` 或 `<namespace>-arch-radar-mysql.svc.cluster.local`
   - **端口（Port）**：`3306`
   - **用户名（User）**：`archradar`
   - **密码（Password）**：你设置的密码
   - **数据库名（Database）**：`zhineng_test_sys`

**连接字符串格式：**
```
mysql+pymysql://archradar:<密码>@<服务名>:3306/zhineng_test_sys
```

**示例：**
```
mysql+pymysql://archradar:MySecurePass123@arch-radar-mysql:3306/zhineng_test_sys
```

---

## 步骤 2: 部署 Redis 缓存

### 2.1 进入应用商店

1. 在 Sealos 应用商店搜索 **"Redis"**
2. 选择 **Redis 7.0** 版本

### 2.2 配置 Redis 参数

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| **应用名称** | `arch-radar-redis` | 便于识别 |
| **密码** | 自定义强密码 | ⚠️ **请记录此密码** |
| **存储大小** | `5Gi` | 缓存数据 |
| **持久化模式** | `AOF` | 数据持久化（推荐） |
| **副本数** | `1` | 单节点即可 |
| **CPU** | `0.5 核` | 根据负载调整 |
| **内存** | `1Gi` | 根据负载调整 |

### 2.3 部署并记录连接信息

1. 点击 **"部署"**
2. 等待状态变为 **"Running"**
3. 记录以下信息：
   - **服务名称（Host）**：通常是 `arch-radar-redis`
   - **端口（Port）**：`6379`
   - **密码（Password）**：你设置的密码

**连接字符串格式：**
```
redis://:<密码>@<服务名>:6379/0
```

**示例：**
```
redis://:MyRedisPass456@arch-radar-redis:6379/0
```

---

## 步骤 3: 部署后端服务

### 3.1 创建应用

1. 在 Sealos 控制台，点击左侧菜单 **"应用管理"** 或 **"Apps"**
2. 点击 **"创建应用"** 或 **"Create App"**
3. 选择 **"镜像部署"** 或 **"Deploy from Image"**

### 3.2 配置基本信息

| 参数 | 值 | 说明 |
|------|-----|------|
| **应用名称** | `arch-radar-backend` | 便于识别 |
| **镜像地址** | `ghcr.io/<your-github-username>/arch-radar-backend:latest` | 替换 `<your-github-username>` |
| **副本数** | `2` | 高可用（至少 2 个） |
| **CPU 请求** | `500m` | 0.5 核 |
| **CPU 限制** | `2000m` | 2 核 |
| **内存请求** | `512Mi` | 512 MB |
| **内存限制** | `2Gi` | 2 GB |

### 3.3 配置环境变量

点击 **"环境变量"** 或 **"Environment Variables"**，添加以下变量：

#### 普通环境变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `AI_PROVIDER` | `qwen` | AI 提供商（qwen 或 gemini） |
| `PROXY_URL` | `http://proxy.example.com:8080` | HTTP 代理（可选，留空则不使用） |

#### 敏感环境变量（Secret）

⚠️ **重要：以下变量请选择"密文"或"Secret"类型**

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `mysql+pymysql://archradar:<密码>@arch-radar-mysql:3306/zhineng_test_sys` | 使用步骤 1 记录的信息 |
| `REDIS_URL` | `redis://:<密码>@arch-radar-redis:6379/0` | 使用步骤 2 记录的信息 |
| `QWEN_API_KEY` | `sk-xxxxxxxxxx` | 通义千问 API 密钥 |
| `GEMINI_API_KEY` | `AIxxxxxxxxxxxx` | Gemini API 密钥（可选，留空） |

### 3.4 配置端口

| 参数 | 值 | 说明 |
|------|-----|------|
| **容器端口** | `8000` | 后端监听端口 |
| **协议** | `HTTP` | 协议类型 |

### 3.5 健康检查（可选但推荐）

| 参数 | 值 |
|------|-----|
| **探测路径** | `/api/dashboard/stats` |
| **初始延迟** | `60` 秒 |
| **探测间隔** | `30` 秒 |
| **超时时间** | `10` 秒 |
| **失败阈值** | `3` 次 |

### 3.6 部署

点击 **"部署"**，等待状态变为 **"Running"**（约 2-3 分钟，包括镜像拉取和数据库初始化）。

---

## 步骤 4: 部署前端服务

### 4.1 创建应用

1. 再次点击 **"创建应用"** → **"镜像部署"**

### 4.2 配置基本信息

| 参数 | 值 | 说明 |
|------|-----|------|
| **应用名称** | `arch-radar-frontend` | 便于识别 |
| **镜像地址** | `ghcr.io/<your-github-username>/arch-radar-frontend:latest` | 替换 `<your-github-username>` |
| **副本数** | `2` | 高可用 |
| **CPU 请求** | `100m` | 0.1 核 |
| **CPU 限制** | `500m` | 0.5 核 |
| **内存请求** | `128Mi` | 128 MB |
| **内存限制** | `256Mi` | 256 MB |

### 4.3 配置端口

| 参数 | 值 | 说明 |
|------|-----|------|
| **容器端口** | `80` | Nginx 监听端口 |
| **协议** | `HTTP` | 协议类型 |

### 4.4 部署

点击 **"部署"**，等待状态变为 **"Running"**（约 1-2 分钟）。

---

## 步骤 5: 配置域名和 HTTPS

### 5.1 配置域名绑定

1. 在 **"应用管理"** 中，点击 `arch-radar-frontend` 应用
2. 点击 **"网络"** 或 **"Network"** 标签
3. 点击 **"添加自定义域名"** 或 **"Add Custom Domain"**

### 5.2 配置路由规则

添加以下路由规则（按优先级顺序）：

| 路径 | 目标服务 | 目标端口 | 说明 |
|------|----------|---------|------|
| `/api` | `arch-radar-backend` | `8000` | 后端 API |
| `/images` | `arch-radar-backend` | `8000` | 静态图片 |
| `/` | `arch-radar-frontend` | `80` | 前端页面 |

### 5.3 配置 DNS

1. 在 Sealos 控制台获取分配的外部地址或 Ingress IP
2. 在您的域名提供商处添加 DNS 记录：
   - **类型**：A 记录 或 CNAME 记录
   - **名称**：`arch-radar`（或您希望的子域名）
   - **值**：Sealos 提供的 IP 地址或域名

**示例：**
```
arch-radar.yourdomain.com  →  <sealos-ingress-ip>
```

### 5.4 启用 HTTPS

1. 在域名配置中，勾选 **"启用 HTTPS"** 或 **"Enable HTTPS"**
2. 选择 **"Let's Encrypt"** 自动证书
3. 等待证书签发（约 1-2 分钟）
4. 验证 HTTPS 访问：`https://arch-radar.yourdomain.com`

---

## 步骤 6: 初始化数据

### 6.1 访问管理后台

在浏览器中访问：
```
https://arch-radar.yourdomain.com/admin
```

### 6.2 上传初始数据

按照以下顺序上传数据：

1. **上传考试大纲（Syllabus）**
   - 格式：CSV 或文本文件
   - 包含知识点层次结构

2. **上传知识点权重表（Weights）**
   - 格式：CSV 文件
   - 包含知识点重要性等级

3. **上传题目数据（Questions）**
   - 格式：CSV 文件
   - 包含题目、选项、答案、解析

### 6.3 验证数据导入

1. 在管理后台查看知识点列表
2. 查看题目列表
3. 确认数据导入成功

---

## 步骤 7: 验证和测试

### 7.1 测试前端访问

访问首页：
```
https://arch-radar.yourdomain.com/
```

应该能看到智能备考系统的首页。

### 7.2 测试 API 端点

访问后端健康检查端点：
```
https://arch-radar.yourdomain.com/api/dashboard/stats
```

应该返回 JSON 格式的统计数据。

### 7.3 测试完整考试流程

1. 点击 **"开始考试"**
2. 系统应自动生成 30 道题目
3. 作答并提交
4. 查看 AI 生成的成绩报告
5. 下载 PDF 报告
6. 测试分享功能

---

## 常见问题

### 问题 1: 后端无法连接数据库

**症状：** 后端 Pod 一直重启，日志显示数据库连接失败

**排查步骤：**
1. 检查 MySQL 服务是否运行正常
2. 确认 `DATABASE_URL` 环境变量配置正确：
   - 用户名、密码是否正确
   - 服务名是否正确（应该是 `arch-radar-mysql` 而不是 `localhost`）
   - 数据库名是否正确
3. 在后端 Pod 中测试连接：
   ```bash
   # 进入 Pod 终端
   kubectl exec -it <backend-pod-name> -- bash
   # 测试 MySQL 连接
   mysql -h arch-radar-mysql -u archradar -p
   ```

**解决方法：**
- 更新 `DATABASE_URL` 环境变量
- 重启后端应用

---

### 问题 2: 前端无法访问后端 API

**症状：** 前端页面加载正常，但调用 API 时报错 404 或 502

**排查步骤：**
1. 检查域名路由配置是否正确
2. 确认 `/api` 路径是否指向后端服务
3. 查看 Ingress 或网关日志

**解决方法：**
- 重新配置路由规则（步骤 5.2）
- 确保 `/api` 优先级高于 `/`

---

### 问题 3: HTTPS 证书签发失败

**症状：** 域名无法使用 HTTPS 访问

**排查步骤：**
1. 确认 DNS 记录已生效（使用 `nslookup` 或 `dig` 检查）
2. 查看 cert-manager 日志
3. 确认域名可以通过 80 端口访问（HTTP）

**解决方法：**
- 等待 DNS 传播完成（通常 5-30 分钟）
- 删除证书重新申请
- 检查域名是否在 Let's Encrypt 限速名单中

---

### 问题 4: AI 报告生成失败

**症状：** 考试提交后，AI 报告显示错误

**排查步骤：**
1. 检查 `QWEN_API_KEY` 是否正确
2. 查看后端日志，确认 API 调用状态
3. 测试 API 密钥是否有效：
   ```bash
   curl -H "Authorization: Bearer sk-xxx" \
        https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
   ```

**解决方法：**
- 更新 API 密钥
- 配置 `PROXY_URL`（如果需要代理访问）
- 确认 API 账户余额充足

---

### 问题 5: PDF 生成中文乱码

**症状：** 下载的 PDF 报告中中文显示为方块

**原因：** 后端镜像中缺少中文字体（不应该发生，Dockerfile 已包含字体安装）

**解决方法：**
1. 检查后端镜像是否为最新版本
2. 重新构建镜像（确保 Dockerfile 中有 `fonts-wqy-zenhei`）
3. 在 Pod 中验证字体：
   ```bash
   kubectl exec -it <backend-pod-name> -- fc-list | grep -i wqy
   ```

---

## 后续维护

### 更新应用

当代码更新并自动构建新镜像后：

1. 在 Sealos **"应用管理"** 中找到对应应用
2. 点击 **"更新"** 或 **"Update"**
3. 修改镜像标签（如果使用版本号）：
   - 原来：`ghcr.io/<user>/arch-radar-backend:latest`
   - 更新为：`ghcr.io/<user>/arch-radar-backend:v1.1.0`
4. 点击 **"应用"**，系统会自动滚动更新（零停机）

### 扩容/缩容

根据负载调整副本数：

1. 进入应用详情
2. 修改 **"副本数"** 参数
3. 保存并应用

### 查看日志

1. 在应用列表中点击应用名称
2. 点击 **"日志"** 或 **"Logs"** 标签
3. 选择 Pod 和时间范围查看日志

### 监控资源使用

1. 在应用详情中查看 **"监控"** 标签
2. 查看 CPU、内存、网络使用情况
3. 根据实际负载调整资源配置

### 数据备份

**MySQL 备份：**
1. 进入 MySQL 应用
2. 使用 Sealos 提供的备份功能（如有）
3. 或手动导出：
   ```bash
   kubectl exec -it <mysql-pod> -- mysqldump -u archradar -p zhineng_test_sys > backup.sql
   ```

**Redis 备份：**
1. Redis 使用 AOF 持久化，数据自动保存
2. 可以通过 Sealos 存储卷快照备份

---

## 总结

通过以上步骤，您已经成功在 Sealos 上部署了 arch-radar 智能备考系统。关键要点：

✅ **MySQL 和 Redis** 通过应用商店一键部署
✅ **后端和前端** 使用 GitHub Actions 自动构建的镜像
✅ **环境变量** 通过 UI 配置，敏感信息使用 Secret 类型
✅ **域名和 HTTPS** 通过 Sealos 自动管理
✅ **零停机更新** 通过滚动发布实现

如有问题，请查看 [常见问题](#常见问题) 章节或联系技术支持。

---

**Happy Deploying! 🎉**
