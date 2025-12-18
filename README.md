# Arch Radar - 智能软考备考系统

智能化的系统架构设计师认证考试备考系统。提供自适应测试、AI 驱动的成绩分析和个性化学习建议。

## 功能特性

- **智能选题** - 基于知识点权重和用户历史的自适应选题算法
- **实时答案同步** - 考试过程中自动同步答案
- **AI 智能分析** - 提供详细的成绩分析报告和个性化建议
- **知识点追踪** - 跨 19 个主要考试章节的层次化知识点追踪
- **PDF 报告生成** - 可下载的详细分析报告
- **社交分享** - 为朋友圈和小红书生成分享内容
- **管理后台** - 管理大纲、权重、题目，查看统计数据

## 技术栈

**后端：**
- FastAPI（Python Web 框架）
- SQLModel + MySQL（数据库）
- Redis（缓存）
- AI 集成（通义千问/Gemini API）

**前端：**
- React 18 + Vite
- Tailwind CSS
- Recharts（数据可视化）
- React Markdown（支持 LaTeX）

## 环境要求

- Python 3.8+
- Node.js 16+
- MySQL 5.7+
- Redis 5.0+

## 安装步骤

### 1. 克隆仓库

```bash
git clone <repository-url>
cd arch-radar
```

### 2. 后端设置

```bash
# 安装 Python 依赖
pip install -r backend/requirements.txt
```

### 3. 前端设置

```bash
# 进入前端目录
cd frontend

# 安装 Node.js 依赖
npm install

cd ..
```

### 4. 数据库设置

创建 MySQL 数据库：

```sql
CREATE DATABASE zhineng_test_sys CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 数据库配置
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/zhineng_test_sys

# Redis 配置
REDIS_URL=redis://localhost:6379/0

# AI 配置
AI_PROVIDER=qwen
QWEN_API_KEY=your_qwen_api_key_here
# 或使用 Gemini
# AI_PROVIDER=gemini
# GEMINI_API_KEY=your_gemini_api_key_here

# 可选：HTTP 代理
# PROXY_URL=http://your-proxy:port
```

## 运行应用

### 启动后端服务

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API 服务将运行在 `http://localhost:8000`

### 启动前端开发服务器

在新终端中：

```bash
cd frontend
npm run dev
```

前端将运行在 `http://localhost:5173`

## 使用指南

### 学生用户

1. **开始测评** - 点击"开始测评"开始 30 题自适应考试
2. **答题** - 逐题作答，答案自动保存
3. **提交** - 提交考试以获取 AI 智能分析
4. **查看报告** - 查看成绩、知识点掌握情况和个性化建议
5. **下载/分享** - 导出 PDF 报告或生成社交媒体分享内容

### 管理员

1. **进入管理面板** - 访问 `/admin`
2. **上传大纲** - 导入考试大纲以创建知识点层次结构
3. **上传权重** - 设置知识点重要性等级
4. **上传题目** - 导入考试题目并关联知识点
5. **数据管理** - 编辑或删除知识点和题目
6. **查看仪表板** - 监控使用统计和数据库存
7. **配置 AI** - 自定义 AI 报告生成的提示词

## 项目结构

```
arch-radar/
├── backend/              # FastAPI 后端
│   ├── main.py          # API 端点
│   ├── models.py        # 数据库模型
│   ├── database.py      # 数据库和 Redis 配置
│   ├── config.py        # 配置文件
│   ├── ai_service.py    # AI 集成
│   ├── pdf_generator.py # PDF 生成
│   └── parsers.py       # 数据解析工具
├── frontend/            # React 前端
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   ├── components/  # 可复用组件
│   │   ├── App.jsx      # 主路由
│   │   └── api.js       # API 客户端
│   └── public/          # 静态资源
└── ziliao/              # 资源文件
    └── images/          # UI 图片
```

## 开发指南

### 后端开发

```bash
# 启动开发服务器（自动重载）
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# 运行测试
pytest
```

### 前端开发

```bash
cd frontend

# 开发服务器
npm run dev

# 代码检查
npm run lint

# 生产构建
npm run build

# 预览构建
npm run preview
```

## API 文档

后端服务启动后，访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 配置说明

### AI 提示词

AI 提示词可通过以下方式自定义：
1. `backend/config.py` 中的默认提示词
2. 管理面板配置界面（`/api/admin/config`）

### Tailwind 主题

自定义主题颜色定义在 `frontend/tailwind.config.js`：
- paper, charcoal, serene, sage, coral, slate, sky

### Vite 代理

开发代理配置在 `frontend/vite.config.js`：
- `/api/*` → `http://localhost:8000`
- `/images/*` → `http://localhost:8000`

## 数据库结构

系统启动时自动创建以下数据表：
- `knowledgepoint` - 知识点层次结构
- `question` - 考试题目
- `examsession` - 用户考试会话
- `majorchapter` - 19 个主要考试章节
- `ailog` - AI API 调用日志
- `aiconfig` - 动态配置

## AI 集成

系统支持两种 AI 提供商：

**通义千问（Qwen）**
- 设置 `AI_PROVIDER=qwen`
- 提供 `QWEN_API_KEY`

**Google Gemini**
- 设置 `AI_PROVIDER=gemini`
- 提供 `GEMINI_API_KEY`

AI 生成内容包括：
1. 详细的成绩分析报告
2. 知识掌握情况画像
3. 个性化学习路径
4. 社交媒体分享文案

## 常见问题

### 数据库连接问题
- 确保 MySQL 正在运行
- 验证 DATABASE_URL 中的凭据
- 检查数据库是否存在且可访问

### Redis 连接问题
- 确保 Redis 在 6379 端口运行
- 验证 REDIS_URL 配置

### AI API 错误
- 验证 API 密钥是否正确
- 检查网络连接（如需要可使用 PROXY_URL）
- 查看 AI 提供商服务状态

### 前端代理问题
- 确保后端在 8000 端口运行
- 检查 `vite.config.js` 代理设置

## 开源协议

[在此添加您的许可证信息]

## 贡献指南

[在此添加贡献指南]

## 技术支持

如有问题或疑问，请在仓库中[创建 Issue](link-to-issues)。
