import os
from dotenv import load_dotenv

# Try loading from .env in current directory (project root)
load_dotenv()
# Also try loading from backend/.env if it exists (for when running from root)
load_dotenv("backend/.env")

class Settings:
    # Database
    # Default to sqlite if not set, but user requested MySQL, so we default to a mysql connection string structure
    # Users should set this env var.
    DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:your_password@localhost:3306/zhineng_test_sys")
    
    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # AI
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    QWEN_API_KEY = os.getenv("QWEN_API_KEY", "")
    AI_PROVIDER = os.getenv("AI_PROVIDER", "qwen") # "gemini" or "qwen"
    
    # Default Prompts
    DEFAULT_PROMPT_REPORT = """
你是一位资深的软考系统架构设计师辅导专家。请根据以下考生的测评数据，生成一份专业的深度分析报告。

**输入数据**：
- 总分：{score}/75
- 正确率：{accuracy}%
- 答题用时：{duration_minutes}分钟
- 及格差距：{gap_analysis}
- 知识点掌握情况（按章节/知识点统计的正确率，含历史对比）：
{kp_analysis}

**请生成以下内容（JSON格式）**：
1. **knowledge_profile** (知识点掌握画像):
   - **strengths**: 列出掌握牢固（正确率高）的章节或知识点。
   - **weaknesses**: 列出薄弱环节（正确率低且权重高）的章节或知识点。若某薄弱项是历史顽疾（历史正确率也低），请特别标注。
2. **evaluation** (当前水平评价):
   - **level**: 给出一个定性评级（如：架构师学徒、初级架构师、准高级架构师）。
   - **comment**: 结合得分、历年真题难度以及**进步情况**（对比历史数据），给出一段综合评价。若有显著进步请予以鼓励，若原地踏步请警示。
3. **prediction** (真实考试预测):
   - **score_range**: 预测真实考试可能的分数范围（如 "40-45"）。
   - **advice**: 基于及格线（45分）差距，给出具体的提分建议（如“若能攻克XX薄弱项，预计可提升Y分”）。
4. **learning_path** (个性化学习路径建议):
   - 生成一个有序列表，包含具体的复习建议。
   - 逻辑：优先攻克“高权重&低正确率”的内容，特别是那些反复出错的“顽疾”知识点。
   - **重要**：请明确建议考生使用系统的“智能组卷”功能，针对识别出的 [薄弱知识点] 进行定向强化训练。
"""

    DEFAULT_PROMPT_SHARE = """
你是一位精通社交媒体传播的文案大师。请根据考生的软考架构师测评结果，生成适合分享到朋友圈/小红书的文案。

**输入数据**：
- 评分等级：{level}
- 总分：{score}
- 击败了多少考生（预估）：{percentile}%
- 亮点：{highlight}

**请生成以下内容（JSON格式）**：
1. **moments_copy** (朋友圈文案): 
   - 风格：**凡尔赛体**或**自嘲努力体**。
   - 长度：3-5行。
   - 核心：隐晦地炫耀“架构师”这个高大上的目标，或体现“智能备考”的科技感（例如提到AI精准诊断）。
2. **xiaohongshu_copy** (小红书文案): 
   - 包含吸睛标题（如：🚫拒绝无效刷题！...）和正文。
   - 必须使用大量Emoji 🌟🔥💪。
   - 强调：**“AI智能组卷”**、**“哪里不会考哪里”**、**“精准查漏补缺”**。
   - 带有话题标签：#软考 #系统架构设计师 #AI备考 #备考攻略。
3. **image_text** (图片文字): 适合印在分享图上的核心短句（如“AI说我是准高工”或“击败99%的竞争者”）。
"""

    # System Proxy
    PROXY_URL = os.getenv("PROXY_URL", None)

settings = Settings()
