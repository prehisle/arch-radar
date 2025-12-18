# 管理后台访问配置说明

## 配置概览

管理后台路径通过环境变量 `VITE_ADMIN_PATH` 动态配置，可以在不同环境使用不同的访问路径，提高安全性。

## 已完成的配置

### 1. Dockerfile 构建参数支持
- 文件：`docker/Dockerfile.frontend`
- 修改：添加了 `ARG` 和 `ENV` 声明，支持构建时传入环境变量

### 2. Docker Compose 构建参数
- 文件：`docker-compose.yml`
- 修改：frontend 服务添加了 `build.args`，从 `.env` 文件读取配置

### 3. 环境变量配置
- 当前 `.env` 文件中已配置：`VITE_ADMIN_PATH=/sys-manage-88fa`
- 示例文件 `.env.docker.example` 已更新，提供默认值：`/admin-secret`

## 使用方法

### 本地开发环境

**前端** (`frontend/.env`)：
```env
VITE_ADMIN_PATH="/sys-manage-88fa"
```

访问地址：`http://localhost:5173/sys-manage-88fa`

### Docker Compose 生产环境

**根目录** (`.env`)：
```env
VITE_ADMIN_PATH=/sys-manage-88fa
```

构建并启动：
```bash
# 重新构建前端镜像（必须！因为环境变量在构建时注入）
docker-compose build frontend

# 启动服务
docker-compose up -d
```

访问地址：`http://your-domain/sys-manage-88fa`

## 重要说明

### 1. 必须重新构建
修改 `VITE_ADMIN_PATH` 后，**必须重新构建前端镜像**：

```bash
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### 2. 环境变量优先级
- Dockerfile 中的默认值：`/admin-secret`
- `.env` 文件中的值会覆盖默认值
- 命令行传入的值优先级最高：
  ```bash
  docker-compose build --build-arg VITE_ADMIN_PATH=/my-custom-path frontend
  ```

### 3. 安全建议
- 使用难以猜测的随机路径
- 不要使用 `/admin`、`/manage` 等常见路径
- 推荐格式：`/sys-manage-{随机字符}`
- 示例：`/sys-manage-88fa`、`/backend-ctrl-x9k2`

### 4. 旧路径处理
代码中已将 `/admin` 重定向到首页，防止通过常见路径访问：
```jsx
<Route path="/admin" element={<Navigate to="/" replace />} />
```

## 验证配置

### 1. 检查构建参数是否传入
```bash
docker-compose config | grep -A 5 "frontend:"
```

应该看到：
```yaml
frontend:
  build:
    args:
      VITE_ADMIN_PATH: /sys-manage-88fa
```

### 2. 检查构建后的代码
构建完成后，检查打包后的 JS 文件：
```bash
docker run --rm arch-radar-frontend cat /usr/share/nginx/html/assets/index-*.js | grep -o "/sys-manage-88fa"
```

如果输出了路径，说明配置成功注入。

## 故障排查

### 问题 1：访问 404
**原因**：环境变量未正确传入构建过程

**解决**：
```bash
# 清除缓存重新构建
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### 问题 2：仍然可以访问 /admin
**原因**：浏览器缓存

**解决**：
- 清除浏览器缓存
- 使用无痕模式访问
- 强制刷新（Ctrl + F5）

### 问题 3：修改 .env 后未生效
**原因**：忘记重新构建镜像

**解决**：
记住！Vite 环境变量是在**构建时**注入的，运行时无法修改。
必须重新构建：
```bash
docker-compose build frontend
```

## 不同部署方式

### 1. Docker Compose（当前方式）
通过 `.env` 文件配置，构建时自动读取。

### 2. 直接 docker build
```bash
docker build \
  --build-arg VITE_ADMIN_PATH=/my-custom-path \
  -f docker/Dockerfile.frontend \
  -t my-frontend .
```

### 3. CI/CD 环境
在 GitHub Actions / GitLab CI 中：
```yaml
- name: Build Frontend
  env:
    VITE_ADMIN_PATH: ${{ secrets.ADMIN_PATH }}
  run: |
    docker-compose build frontend
```

## 相关文件

- `docker/Dockerfile.frontend` - 构建配置
- `docker-compose.yml` - 服务编排
- `.env` - 环境变量（生产）
- `.env.docker.example` - 环境变量示例
- `frontend/.env` - 前端开发环境变量
- `frontend/src/App.jsx` - 路由配置
