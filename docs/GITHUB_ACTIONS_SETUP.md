# GitHub Actions 配置说明

## 概述

本项目的 GitHub Actions 工作流已配置为自动构建和推送 Docker 镜像到 GitHub Container Registry (GHCR)。前端镜像构建时会注入管理后台路径配置。

## 配置 GitHub Secrets

### 1. 添加 ADMIN_PATH Secret

为了保护管理后台路径，需要在 GitHub 仓库中配置 Secret：

**步骤：**

1. 打开仓库页面：`https://github.com/YOUR_USERNAME/arch-radar`
2. 点击 **Settings** (设置)
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret** (新建仓库密钥)
5. 配置如下：
   - **Name (名称)**：`ADMIN_PATH`
   - **Secret (值)**：`/sys-manage-88faxxoo` （或您自定义的路径）
6. 点击 **Add secret** (添加密钥)

### 2. 验证配置

配置完成后，下次推送代码到 `main` 分支时，GitHub Actions 会：

1. 自动触发构建
2. 前端镜像会使用 Secret 中配置的 `ADMIN_PATH` 值
3. 构建的镜像会推送到 GHCR

**查看构建日志：**
- 访问仓库的 **Actions** 标签页
- 点击最新的工作流运行
- 展开 "Build and push Docker image" 步骤查看详细日志

## 构建参数说明

### 前端构建参数

```yaml
build-args: |
  VITE_API_BASE_URL=/
  VITE_ADMIN_PATH=${{ secrets.ADMIN_PATH || '/admin-secret' }}
```

**参数说明：**

| 参数 | 说明 | 默认值 | 来源 |
|------|------|--------|------|
| `VITE_API_BASE_URL` | API 基础路径 | `/` | 硬编码 |
| `VITE_ADMIN_PATH` | 管理后台路径 | `/admin-secret` | GitHub Secret |

**回退机制：**
- 如果 `ADMIN_PATH` Secret 未配置，会使用默认值 `/admin-secret`
- 建议配置 Secret 以使用自定义路径，提高安全性

## 镜像标签策略

### 推送到 main 分支

自动生成两个标签：
- `latest` - 最新版本
- `sha-<commit>` - 精确的提交版本（用于回滚）

**示例：**
```
ghcr.io/YOUR_USERNAME/arch-radar-frontend:latest
ghcr.io/YOUR_USERNAME/arch-radar-frontend:sha-abc1234
ghcr.io/YOUR_USERNAME/arch-radar-backend:latest
ghcr.io/YOUR_USERNAME/arch-radar-backend:sha-abc1234
```

### 创建 Git Tag (v*.*.*)

自动使用语义化版本标签：

**示例：**
```bash
git tag v1.0.0
git push origin v1.0.0
```

生成的镜像标签：
```
ghcr.io/YOUR_USERNAME/arch-radar-frontend:v1.0.0
ghcr.io/YOUR_USERNAME/arch-radar-backend:v1.0.0
```

### Pull Request

仅构建镜像验证，**不推送到 GHCR**。

## 使用 GHCR 镜像

### 1. 认证到 GHCR

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### 2. 拉取镜像

```bash
# 拉取最新版本
docker pull ghcr.io/YOUR_USERNAME/arch-radar-frontend:latest
docker pull ghcr.io/YOUR_USERNAME/arch-radar-backend:latest

# 拉取特定版本
docker pull ghcr.io/YOUR_USERNAME/arch-radar-frontend:v1.0.0
docker pull ghcr.io/YOUR_USERNAME/arch-radar-backend:sha-abc1234
```

### 3. 在生产环境使用

修改 `docker-compose.yml` 或 Kubernetes 配置：

```yaml
services:
  frontend:
    image: ghcr.io/YOUR_USERNAME/arch-radar-frontend:latest
    # ...其他配置

  backend:
    image: ghcr.io/YOUR_USERNAME/arch-radar-backend:latest
    # ...其他配置
```

## 本地测试 GitHub Actions 构建

### 使用 act 工具

```bash
# 安装 act
brew install act  # macOS
# 或
sudo apt install act  # Linux

# 模拟 push 事件
act push

# 模拟 pull_request 事件
act pull_request
```

### 使用 Docker 手动构建

模拟 GitHub Actions 的构建过程：

```bash
# 前端
docker build \
  --build-arg VITE_API_BASE_URL=/ \
  --build-arg VITE_ADMIN_PATH=/sys-manage-88faxxoo \
  -f docker/Dockerfile.frontend \
  -t arch-radar-frontend:test .

# 后端
docker build \
  -f docker/Dockerfile.backend \
  -t arch-radar-backend:test .
```

## 故障排查

### 构建失败：Secret not found

**问题**：GitHub Actions 日志显示 `ADMIN_PATH` 未定义

**解决**：
1. 检查 Secret 名称是否完全匹配（区分大小写）
2. 确认 Secret 在正确的位置（Repository secrets，不是 Environment secrets）
3. 重新运行工作流

### 前端镜像管理后台路径不正确

**问题**：部署后发现管理后台路径仍然是默认值

**解决**：
1. 检查 GitHub Secret 配置
2. 查看 Actions 构建日志，确认 `build-args` 正确传递
3. 重新触发构建（推送新提交或手动重新运行工作流）

### 镜像无法拉取：403 Forbidden

**问题**：从 GHCR 拉取镜像时权限被拒绝

**解决**：
1. 确保镜像可见性设置为 Public，或
2. 使用 Personal Access Token (PAT) 认证：
   ```bash
   echo $PAT | docker login ghcr.io -u YOUR_USERNAME --password-stdin
   ```

## 相关文档

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [GitHub Container Registry 文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [管理后台访问配置](../ADMIN_ACCESS.md)

## 安全建议

1. **定期轮换 ADMIN_PATH**：定期更改管理后台路径以提高安全性
2. **限制镜像可见性**：生产环境镜像建议设置为 Private
3. **启用镜像签名**：考虑使用 Cosign 对镜像进行签名
4. **开启漏洞扫描**：取消注释工作流中的 security-scan 任务
