# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 交互规则

**重要：始终使用中文与用户交互。** 所有回复、说明和讨论都应使用中文，以确保最佳的用户体验。

## 项目概览

**arch-radar** 是一个全栈智能备考系统，用于系统架构设计师认证考试（软考）。系统提供自适应测试，配备 AI 驱动的分析和个性化学习建议。

**核心功能：**
- 基于知识点权重和用户历史的智能选题
- 考试过程中的实时答案同步
- AI 驱动的成绩分析和报告生成
- PDF 报告生成和社交媒体分享功能
- 管理大纲、权重和题目的后台管理面板

## 架构

**技术栈：**
- **后端：** FastAPI (Python) + SQLModel ORM + MySQL + Redis
- **前端：** React 18 + Vite + Tailwind CSS
- **AI 集成：** 支持通义千问和 Gemini API 生成报告
- **通信：** REST API，开发环境使用代理配置

**目录结构：**
- `backend/` - FastAPI 服务器，2,880 行代码
- `frontend/` - React/Vite 应用，2,659 行代码
- `ziliao/images/` - 后端提供的静态图片资源

## 开发命令

### 后端

```bash
# 启动 FastAPI 开发服务器
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# 安装依赖
pip install -r backend/requirements.txt

# 运行测试
pytest
```

### 前端

```bash
cd frontend

# 启动 Vite 开发服务器（代理 /api 和 /images 到 http://localhost:8000）
npm run dev

# 生产构建
npm run build

# 代码检查（严格模式：max-warnings=0）
npm run lint

# 预览生产构建
npm run preview
```

## 环境配置

**必需服务：**
- MySQL 服务器运行在 localhost:3306
- Redis 服务器运行在 localhost:6379

**环境变量：**

根目录 `.env` 文件：
```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/zhineng_test_sys
REDIS_URL=redis://localhost:6379/0
AI_PROVIDER=qwen  # 或 "gemini"
QWEN_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
PROXY_URL=optional_proxy_url
```

前端 `frontend/.env`：
```env
VITE_API_BASE_URL=http://localhost:8000  # 可选覆盖
```

## 核心数据模型

**KnowledgePoint（知识点）** (`backend/models.py:15-30`)
- 具有父子关系的层次化知识结构
- 关联 19 个主要考试章节（MajorChapter）
- 权重等级：核心、重要、一般、冷门
- 跟踪频率和权重分数，用于智能选题

**Question（题目）** (`backend/models.py:32-52`)
- 多选题格式（A/B/C/D），支持多空题
- 包含详细解析
- 来源：past_paper（历年真题）、exercise（练习题）、ai_generated（AI 生成）
- 关联知识点，用于自适应测试

**ExamSession（考试会话）** (`backend/models.py:54-78`)
- 基于 UUID 的会话跟踪
- 用户指纹来自 localStorage（无需身份验证）
- 存储题目 ID、用户答案、分数和提交状态
- AI 生成的完整报告以 JSON 格式存储
- 跟踪 PDF 下载和分享次数

**MajorChapter（主要章节）** (`backend/models.py:80-103`)
- 涵盖系统架构考试主题的 19 个章节
- 包括：计算机系统、软件工程、数据库、架构设计模式、质量属性、专业架构（云原生、微服务、嵌入式等）

## API 架构

**核心端点：**

管理路由（`/api/admin/`）：
- `POST /upload/syllabus` - 解析并导入考试大纲
- `POST /upload/weights` - 导入知识点权重
- `POST /upload/questions` - 导入考试题目
- `GET /knowledge_points` - 分页知识点列表，支持搜索
- `GET /questions` - 分页题目列表，支持过滤
- `GET /config` - 获取 AI 配置
- `POST /config` - 更新 AI 提示词和设置

考试路由（`/api/exam/`）：
- `POST /start` - 生成 30 题考试会话
- `GET /session/{id}` - 获取会话数据
- `POST /sync` - 实时答案同步
- `POST /submit` - 提交考试，触发评分和 AI 分析
- `GET /report/{id}` - 获取 AI 生成的报告
- `GET /report/{id}/pdf` - 下载 PDF 报告
- `POST /share` - 生成社交媒体分享内容
- `POST /download-event` - 跟踪 PDF 下载事件

仪表板路由（`/api/dashboard/`）：
- `GET /users` - 最近考试用户列表
- `GET /stats` - 全局统计数据
- `GET /materials` - 题目/知识点库存统计

## 关键工作流程

### 考试流程
1. 用户点击"开始" → `POST /api/exam/start` 创建包含 30 题的 ExamSession
2. 使用基于知识点和用户历史的加权算法选择题目
3. 前端获取题目并显示逐题界面（Exam.jsx）
4. 用户作答时通过 `POST /api/exam/sync` 自动同步答案
5. 提交触发 `POST /api/exam/submit` → 评分 + AI 报告生成
6. Report.jsx 显示结果，包括雷达图（Recharts）、AI 分析和建议
7. 用户可下载 PDF 或生成社交分享内容

### AI 报告生成 (`backend/ai_service.py`)
- 考试提交时触发
- 分析分数、正确率、用时、知识点掌握情况
- 与历史成绩对比，识别趋势
- 生成个性化学习路径，重点关注高权重薄弱点
- 使用 `backend/config.py:24-71` 中的提示词（可通过管理界面自定义）
- 支持通义千问和 Gemini API，带有回退逻辑
- 所有调用记录在 AILog 表中

### 管理数据管理
1. 上传大纲 CSV/文本 → 解析为 KnowledgePoint 层次结构
2. 上传权重表 → 分配重要性等级
3. 上传题目 → 解析并关联知识点
4. 仪表板显示数据库存和用户统计
5. 可通过 REST API 编辑/删除单个条目

## 重要实现细节

**前端渲染：**
- 使用 react-markdown 及插件显示富文本内容：
  - `remark-gfm` 用于 GitHub 风格的 Markdown
  - `remark-math` + `rehype-katex` 用于 LaTeX 数学公式渲染
  - `rehype-raw` 用于原始 HTML 支持
- 通过 PrintableReport.jsx 和 react-to-print 实现打印优化布局

**后端解析 (`backend/parsers.py`)：**
- 处理大纲、权重和题目的各种输入格式
- 支持 CSV 和文本格式
- 自动创建知识点层次结构
- 使用模式匹配将题目关联到知识点

**PDF 生成 (`backend/pdf_generator.py`)：**
- 346 行自定义 PDF 生成器
- 渲染带有图表和格式化内容的考试报告
- 通过 `/api/exam/report/{id}/pdf` 端点触发

**Vite 代理配置 (`frontend/vite.config.js`)：**
- 开发服务器代理 `/api/*` → `http://localhost:8000`
- 代理 `/images/*` → `http://localhost:8000`
- 支持前后端分离的无缝开发

**数据库初始化：**
- 启动时通过 SQLModel 自动创建数据库表
- 开发环境无需迁移文件
- Redis 用于缓存和会话管理

## 测试

**后端：**
- pytest + httpx 进行 API 测试
- 测试应覆盖主要 API 路由和 AI 服务集成

**前端：**
- 使用 `--max-warnings 0` 强制执行 ESLint（严格模式）
- 通过 Vite 开发服务器进行手动测试
- 测试从开始到 PDF 下载的完整考试流程

## Tailwind 配置

自定义主题定义在 `frontend/tailwind.config.js`：
- 颜色：paper、charcoal、serene、sage、coral、slate、sky
- 字体：Inter + Noto Sans SC（中文字符支持）
- Typography 插件用于 markdown 渲染

## AI 配置

默认提示词定义在 `backend/config.py`，但可被覆盖：
- 报告生成提示词（中文）：包含知识掌握画像、评价、预测和学习路径的详细分析
- 社交分享提示词：生成朋友圈和小红书内容，使用丰富的表情符号格式

通过 `AI_PROVIDER` 环境变量选择 AI 提供商：
- `qwen`（默认）- 使用通义千问 API
- `gemini` - 使用 Google Gemini API

两个提供商在 `backend/ai_service.py:call_qwen()` 和 `call_gemini()` 中使用相同接口。
