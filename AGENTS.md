# AGENTS.md

本文件为所有 AI 代码助手（Claude Code、GitHub Copilot、Cursor 等）提供编码规范和最佳实践指导。

> **架构文档参考：** 详细的项目架构、技术栈和 API 设计请查阅 [CLAUDE.md](./CLAUDE.md) 和 [README.md](./README.md)

## 语言和交互规范

- **项目主要语言：** 中文
- **代码注释：** 复杂逻辑使用中文注释
- **变量命名：** 使用英文，遵循各语言规范（Python: snake_case，JavaScript: camelCase）
- **用户界面文本：** 必须使用中文
- **数据库枚举值：** 使用中文（如 "核心"、"重要"、"一般"、"冷门"）

## 项目结构

```
arch-radar/
├── backend/              # FastAPI 后端
│   ├── main.py          # API 路由和端点
│   ├── models.py        # SQLModel 数据模型
│   ├── database.py      # MySQL/Redis 连接
│   ├── config.py        # 配置管理
│   ├── ai_service.py    # AI 服务调用（Qwen/Gemini）
│   ├── pdf_generator.py # PDF 报告生成
│   └── parsers.py       # 数据导入解析
├── frontend/            # React 18 + Vite 前端
│   ├── src/
│   │   ├── pages/       # 页面组件（Home, Exam, Report, Admin）
│   │   ├── components/  # 可复用组件
│   │   └── api.js       # API 调用封装
│   └── public/          # 静态资源
└── ziliao/              # 资源文件
    └── images/          # UI 图片
```

## 开发命令速查

### 后端

```bash
# 安装依赖
pip install -r backend/requirements.txt

# 启动开发服务器
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# 运行测试
pytest
```

### 前端

```bash
cd frontend

# 安装依赖
npm install

# 开发服务器（http://localhost:5173）
npm run dev

# 代码检查
npm run lint

# 生产构建
npm run build

# 预览构建
npm run preview
```

## Python/FastAPI 编码规范

### 代码风格

- **遵循 PEP 8**：4 空格缩进
- **类型注解**：所有函数和类字段必须有类型注解
- **文档字符串**：公开 API 和复杂函数添加 docstring

```python
# ✅ 推荐
from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel

class KnowledgePoint(SQLModel, table=True):
    """知识点模型

    用于组织考试大纲的层次化知识结构
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    weight_level: str = Field(default="冷门")  # 核心/重要/一般/冷门

async def generate_report(session_id: str) -> Dict[str, Any]:
    """生成 AI 分析报告

    Args:
        session_id: 考试会话 ID

    Returns:
        包含分析结果的字典
    """
    # 实现逻辑...

# ❌ 避免：缺少类型注解和文档
def generate_report(session_id):
    # 实现逻辑...
```

### 数据模型规范

1. **使用 SQLModel** - 所有模型继承 `SQLModel, table=True`
2. **类型安全** - 必须有完整的类型注解
3. **索引优化** - 查询字段添加 `index=True`
4. **长文本字段** - 使用 `sa_column=Column(Text)`
5. **JSON 字段** - 使用 `sa_column=Column(JSON)`

```python
# ✅ 正确示例
from sqlalchemy import Column, JSON, Text

class Question(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str = Field(sa_column=Column(Text))
    options: List[Any] = Field(sa_column=Column(JSON))
    source_type: str = Field(index=True)  # 经常查询
    knowledge_point_id: Optional[int] = Field(
        default=None,
        foreign_key="knowledgepoint.id"
    )
```

### API 端点规范

- **路由分组**：使用 `/api/{module}/` 前缀（exam, admin, dashboard）
- **RESTful 设计**：GET 查询、POST 创建/操作、PUT 更新、DELETE 删除
- **错误处理**：使用 `HTTPException` 返回明确的错误信息
- **响应模型**：定义 Pydantic 模型作为响应

```python
# ✅ 推荐
from fastapi import HTTPException

@app.post("/api/exam/start", response_model=ExamStartResponse)
async def start_exam(request: ExamStartRequest) -> Dict[str, Any]:
    """开始新的考试会话"""
    try:
        session = create_exam_session(request.user_fingerprint)
        questions = select_questions(session.id)
        return {
            "session_id": session.id,
            "questions": questions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="创建考试会话失败")

# ❌ 避免
@app.post("/start")
def start(fp):
    return create_session(fp)
```

### 数据库操作

- **使用会话管理**：通过依赖注入获取 session
- **事务处理**：确保 commit/rollback
- **查询优化**：使用 `select().where()` 而非 `filter()`

```python
# ✅ 推荐
from sqlmodel import Session, select

def get_questions_by_kp(db: Session, kp_id: int) -> List[Question]:
    """根据知识点查询题目"""
    statement = select(Question).where(
        Question.knowledge_point_id == kp_id
    )
    return db.exec(statement).all()

# 使用
with Session(engine) as db:
    questions = get_questions_by_kp(db, kp_id=1)
```

### AI 服务调用

- **错误处理**：捕获超时和 API 错误
- **重试机制**：实现指数退避
- **日志记录**：记录到 AILog 表

```python
# ✅ 推荐
async def call_ai_with_retry(prompt: str, max_retries: int = 3) -> Dict:
    """带重试的 AI 调用"""
    for attempt in range(max_retries):
        try:
            if settings.AI_PROVIDER == "qwen":
                result = await call_qwen(prompt)
            else:
                result = await call_gemini(prompt)

            # 记录成功日志
            log_ai_call(provider=settings.AI_PROVIDER, success=True)
            return result

        except Exception as e:
            if attempt == max_retries - 1:
                log_ai_call(provider=settings.AI_PROVIDER,
                           success=False, error=str(e))
                raise HTTPException(
                    status_code=500,
                    detail="AI 服务暂时不可用，请稍后重试"
                )
            await asyncio.sleep(2 ** attempt)  # 指数退避
```

## React/JavaScript 编码规范

### 组件结构

- **函数式组件**：使用 hooks 而非 class 组件
- **组件命名**：PascalCase（如 `ExamPage.jsx`）
- **工具函数**：camelCase（如 `api.js`, `utils.js`）

```jsx
// ✅ 推荐：清晰的函数式组件
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 考试页面组件
 * 展示题目并管理答题流程
 */
function Exam() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExam();
  }, []);

  const loadExam = async () => {
    try {
      const sessionId = localStorage.getItem('current_exam_session');
      const response = await api.getSession(sessionId);
      setQuestions(response.data.questions);
    } catch (error) {
      console.error('加载考试失败:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    // 自动同步到服务器
    await api.syncAnswer(sessionId, questionId, answer);
  };

  if (loading) return <LoadingOverlay />;

  return (
    <div className="container mx-auto p-4">
      {/* 组件内容 */}
    </div>
  );
}

export default Exam;
```

### 状态管理

- **本地状态**：`useState` 管理组件内状态
- **副作用**：`useEffect` 处理数据加载
- **持久化**：关键数据存储到 `localStorage`

```jsx
// ✅ 推荐：持久化关键状态
const startExam = async () => {
  const fingerprint = getUserFingerprint();
  const response = await api.startExam(fingerprint);

  // 保存 session_id，刷新页面后可恢复
  localStorage.setItem('current_exam_session', response.data.session_id);

  navigate(`/exam`);
};

// 获取或创建用户指纹
const getUserFingerprint = () => {
  let fingerprint = localStorage.getItem('user_fingerprint');
  if (!fingerprint) {
    fingerprint = `user_${Date.now()}_${Math.random().toString(36)}`;
    localStorage.setItem('user_fingerprint', fingerprint);
  }
  return fingerprint;
};
```

### API 调用规范

- **集中管理**：所有 API 调用在 `src/api.js`
- **错误拦截**：统一处理错误
- **超时设置**：避免长时间等待

```javascript
// ✅ 推荐：src/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
});

// 响应拦截器
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 404) {
      console.error('资源不存在');
    } else if (error.response?.status === 500) {
      console.error('服务器错误');
    }
    return Promise.reject(error);
  }
);

export default {
  // 考试相关
  startExam: (fingerprint) =>
    api.post('/exam/start', { user_fingerprint: fingerprint }),
  getSession: (id) =>
    api.get(`/exam/session/${id}`),
  syncAnswer: (sessionId, questionId, answer) =>
    api.post('/exam/sync', { session_id: sessionId, question_id: questionId, answer }),
  submitExam: (sessionId) =>
    api.post('/exam/submit', { session_id: sessionId }),

  // 报告相关
  getReport: (sessionId) =>
    api.get(`/exam/report/${sessionId}`),
  downloadPDF: (sessionId) =>
    api.get(`/exam/report/${sessionId}/pdf`, { responseType: 'blob' }),
};
```

### 样式规范

- **Tailwind CSS 优先**：使用 utility classes
- **自定义颜色**：使用 `tailwind.config.js` 中定义的颜色
- **响应式**：使用 Tailwind 的响应式前缀

```jsx
// ✅ 推荐
<div className="container mx-auto px-4 py-8">
  <h1 className="text-3xl font-bold text-charcoal mb-6">
    考试报告
  </h1>
  <div className="bg-paper rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
    <p className="text-gray-700 leading-relaxed">
      您的总分：<span className="text-coral font-semibold">75</span>
    </p>
  </div>
</div>

// ❌ 避免：内联样式
<div style={{ padding: '20px' }}>
  <h1 style={{ fontSize: '24px', color: '#333' }}>考试报告</h1>
</div>
```

## 测试规范

### 后端测试

```python
# ✅ 推荐：pytest + httpx
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_start_exam():
    """测试开始考试接口"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/exam/start",
            json={"user_fingerprint": "test_user_123"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert len(data["questions"]) == 30
        assert data["questions"][0]["content"]
```

### 前端测试

```bash
# 手动测试关键流程
1. 开始考试 → 验证 30 题正确加载
2. 答题过程 → 检查答案自动保存
3. 提交考试 → 确认报告生成
4. 下载 PDF → 验证格式正确
5. 社交分享 → 检查文案生成
```

**提交前检查：**
```bash
# 后端
pytest

# 前端
npm run lint
```

## Git 提交规范

### 提交信息格式

```bash
# ✅ 推荐：清晰的提交信息（中文或英文，保持一致）
git commit -m "添加用户答题进度自动保存功能

- 实现答案实时同步到服务器
- 添加防抖处理避免频繁请求
- 页面刷新后可恢复答题状态
"

# 或英文
git commit -m "Add auto-save for exam progress

- Implement real-time answer sync to server
- Add debounce to reduce request frequency
- Support resume after page refresh
"

# ❌ 避免：模糊的提交信息
git commit -m "fix bug"
git commit -m "update"
git commit -m "test"
```

### 提交前清单

```bash
# 1. 代码检查
npm run lint          # 前端
pytest                # 后端

# 2. 检查敏感信息
git diff --cached     # 确保没有 API 密钥

# 3. 确认 .env 未被追踪
git status            # .env 应在 Untracked files
```

### PR 规范

- 说明改动目的和主要变更
- 关联相关 issue
- 前端改动附截图
- 注明 API 契约变更
- 说明 `.env` 配置变更（不提交密钥）

## 安全最佳实践

### 环境变量

```bash
# ✅ 推荐：使用 .env（不提交到 git）
DATABASE_URL=mysql+pymysql://user:pass@localhost/db
QWEN_API_KEY=sk-xxxxx

# ❌ 绝对避免：硬编码
QWEN_API_KEY = "sk-dece252542..."  # 危险！
```

### 输入验证

```python
# ✅ 推荐：Pydantic 验证
from pydantic import BaseModel, validator

class ExamStartRequest(BaseModel):
    user_fingerprint: str

    @validator('user_fingerprint')
    def validate_fingerprint(cls, v):
        if not v or len(v) > 200:
            raise ValueError('无效的用户标识')
        return v
```

### SQL 注入防护

```python
# ✅ 推荐：使用 ORM
session = db.exec(
    select(ExamSession).where(ExamSession.id == session_id)
).first()

# ❌ 危险：字符串拼接
query = f"SELECT * FROM examsession WHERE id = '{session_id}'"
```

## 性能优化建议

### 后端

```python
# ✅ Redis 缓存
async def get_questions_cache(kp_id: int):
    cache_key = f"questions:kp:{kp_id}"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    questions = db.query(Question).filter(...).all()
    redis.setex(cache_key, 3600, json.dumps(questions))
    return questions
```

### 前端

```jsx
// ✅ 防抖处理
import { debounce } from 'lodash';

const syncAnswer = useCallback(
  debounce(async (questionId, answer) => {
    await api.syncAnswer(sessionId, questionId, answer);
  }, 1000),
  [sessionId]
);

// ✅ 懒加载图片
<img src={url} loading="lazy" alt="题目配图" />
```

## 常见问题解决

### 前端无法访问后端

```javascript
// 检查 vite.config.js 代理配置
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/images': 'http://localhost:8000'
    }
  }
}
```

### AI API 超时

```python
# 增加超时并添加重试
async with httpx.AsyncClient(timeout=60.0) as client:
    # 调用 API...
```

### 数据库连接池耗尽

```python
# 正确管理会话
with Session(engine) as db:
    try:
        # 操作...
        db.commit()
    except:
        db.rollback()
        raise
```

## 代码审查清单

提交代码前请检查：

- [ ] 中文文本正确显示
- [ ] API 有适当错误处理
- [ ] 数据库查询使用了索引
- [ ] 无硬编码敏感信息
- [ ] 前端组件有加载/错误状态
- [ ] 复杂逻辑有注释
- [ ] 遵循命名约定
- [ ] Git 提交信息清晰
- [ ] 通过 lint 和测试

## 参考文档

- **架构详解**: [CLAUDE.md](./CLAUDE.md)
- **项目说明**: [README.md](./README.md)
- **环境配置**: [.env.example](./.env.example)
