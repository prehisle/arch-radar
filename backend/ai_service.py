import json
import requests
from typing import Dict, Any
from backend.config import settings
from openai import OpenAI

def generate_report(score: int, kp_stats: Dict[str, Any], prompt_template: str, api_key: str = None, duration_minutes: int = 0, history_rates: Dict[int, float] = None) -> Dict[str, Any]:
    """
    Generates an AI analysis report using Gemini or Qwen.
    """
    key = api_key or (settings.QWEN_API_KEY if settings.AI_PROVIDER == "qwen" else settings.GEMINI_API_KEY)
    
    if not key:
        return {"error": f"{settings.AI_PROVIDER} API Key not configured"}

    # Format KP stats for prompt
    kp_analysis_str = ""
    # Sort KPs by chapter to group them nicely in the prompt (optional but good)
    sorted_kps = sorted(kp_stats.values(), key=lambda x: x.get('chapter', ''))
    
    # history_rates is {kp_id: error_rate} (0.0 - 1.0)
    # We want to display historical accuracy = (1 - error_rate) * 100
    
    for kp_id, stats in kp_stats.items():
        # Note: kp_stats keys might be int, but we iterate dict.
        # Wait, sorted_kps iterates values, so we lose the ID key unless it's in stats.
        # Let's check main.py usage. kp_stats keys are q.knowledge_point_id (int).
        # We need the ID to look up history.
        pass

    # Re-iterate with sorting but keeping access to ID
    # Convert to list of tuples (id, stats)
    kp_items = []
    for k, v in kp_stats.items():
        kp_items.append((k, v))
        
    kp_items.sort(key=lambda x: x[1].get('chapter', ''))
    
    for kpid, stats in kp_items:
        name = stats.get('name', 'Unknown KP')
        chapter = stats.get('chapter', 'Unknown Chapter')
        weight = stats.get('weight', 'Unknown')
        total = stats['total']
        correct = stats['correct']
        accuracy = int((correct / total) * 100) if total > 0 else 0
        
        history_str = ""
        if history_rates and kpid in history_rates:
            hist_err = history_rates[kpid]
            hist_acc = int((1.0 - hist_err) * 100)
            diff = accuracy - hist_acc
            trend = "持平"
            if diff > 5: trend = "进步"
            elif diff < -5: trend = "退步"
            
            history_str = f" | 历史正确率: {hist_acc}% ({trend})"
            
        kp_analysis_str += f"- [{chapter}] {name} (权重: {weight}): 本次 {accuracy}% ({correct}/{total}){history_str}\n"

    accuracy = int((score / 75) * 100)
    score_gap = 45 - score
    gap_str = f"距离及格线（45分）还差 {score_gap} 分" if score_gap > 0 else f"已超过及格线 {abs(score_gap)} 分"
    
    prompt = prompt_template.format(
        score=score,
        accuracy=accuracy,
        duration_minutes=duration_minutes, 
        kp_analysis=kp_analysis_str,
        gap_analysis=gap_str
    )

    if settings.AI_PROVIDER == "qwen":
        return call_qwen(prompt, api_key=key)
    else:
        return call_gemini(prompt, api_key=key)

def generate_share_content(report_data: Dict[str, Any], prompt_template: str, api_key: str = None) -> Dict[str, Any]:
    """
    Generates social share content using Gemini or Qwen.
    """
    key = api_key or (settings.QWEN_API_KEY if settings.AI_PROVIDER == "qwen" else settings.GEMINI_API_KEY)
    if not key:
        return {"error": f"{settings.AI_PROVIDER} API Key not configured"}

    level = report_data.get('title')
    if not level and 'evaluation' in report_data and isinstance(report_data['evaluation'], dict):
        level = report_data['evaluation'].get('level')
    if not level:
        level = '软考考生'

    score_val = report_data.get('score', 0)
    score_str = f"{score_val}/75"
    # Estimate percentile based on score (Mock logic)
    percentile = 0
    if score_val > 60: percentile = 99
    elif score_val > 45: percentile = 80
    elif score_val > 30: percentile = 50
    else: percentile = 20
    
    highlight = ""
    if report_data.get('strong_points'):
        highlight = f"擅长领域：{', '.join(report_data['strong_points'][:3])}"
    else:
        highlight = "正在努力进步中"

    prompt = prompt_template.format(
        level=level,
        score=score_str,
        percentile=percentile,
        highlight=highlight
    )

    if settings.AI_PROVIDER == "qwen":
        return call_qwen(prompt, api_key=key)
    else:
        return call_gemini(prompt, api_key=key)

def generate_variant_questions(seed_questions: list[Dict[str, Any]], count_per_seed: int = 1, api_key: str = None) -> list[Dict[str, Any]]:
    """
    Generates variant questions based on seed questions.
    """
    key = api_key or (settings.QWEN_API_KEY if settings.AI_PROVIDER == "qwen" else settings.GEMINI_API_KEY)
    if not key:
        return []

    # Construct prompt
    seeds_text = ""
    for q in seed_questions:
        seeds_text += f"ID: {q['id']}\n知识点: {q.get('knowledge_point', 'Unknown')}\nContent: {q['content']}\nOptions: {q['options']}\nAnswer: {q['answer']}\nExplanation: {q['explanation']}\n\n"

    prompt = f"""
你是一位软考“系统架构设计师”（高级）的命题专家。
请为以下每道种子题目生成 {count_per_seed} 道新的变体选择题。
变体题目应测试相同的知识点，但使用不同的场景、数值或表述方式。
确保难度和风格符合该专业考试的水平。

【重要规则】
1. **绝对禁止**生成带图片的题目。不要在题干中包含 markdown 图片语法（如 ![image](...)）。
2. 如果种子题目依赖图片才能作答，请改编题目，用文字描述图片内容，或者构造一个不需要图片但测试相同知识点的纯文字题目。
3. 输出必须是有效的 JSON 对象列表。

种子题目：
{seeds_text}

输出 JSON 格式要求：
1. 对于普通单选题：
   "options": ["A. <选项内容>", "B. <选项内容>", "C. <选项内容>", "D. <选项内容>"],
   "answer": "A"
2. 对于包含多个填空（如(1), (2)）的题目：
   "options": [
       ["A. <空1选项>", "B. <空1选项>", "C. <空1选项>", "D. <空1选项>"], 
       ["A. <空2选项>", "B. <空2选项>", "C. <空2选项>", "D. <空2选项>"]
   ],
   "answer": "A,C" （对应每个空的正确选项，用逗号分隔）

[
  {{
    "based_on_id": <种子题目的ID>,
    "content": "<题目题干>",
    "options": <选项列表>,
    "answer": "<答案>",
    "explanation": "<详细解析>"
  }},
  ...
]
"""
    try:
        print(f"Generating questions with {settings.AI_PROVIDER}...")
        
        if settings.AI_PROVIDER == "qwen":
            result = call_qwen(prompt, api_key=key)
        else:
            result = call_gemini(prompt, api_key=key)
            
        if isinstance(result, list):
            return result
        elif isinstance(result, dict) and "error" in result:
            print(f"AI Generation Error: {result['error']}")
            return []
        else:
            if isinstance(result, dict):
                 if "questions" in result: return result["questions"]
                 return []
            return []
    except Exception as e:
        print(f"Variant Generation Exception: {e}")
        return []

def call_qwen(prompt: str, api_key: str = None, model_name: str = "qwen3-max") -> Dict[str, Any]:
    """
    Calls Qwen API (via DashScope compatible OpenAI client)
    """
    key = api_key or settings.QWEN_API_KEY
    if not key:
        return {"error": "Qwen API Key not configured"}

    client = OpenAI(
        api_key=key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    print(f"[{model_name}] Prompt:\n{prompt}")

    try:
        completion = client.chat.completions.create(
            model=model_name,
            messages=[{'role': 'user', 'content': prompt}],
            response_format={"type": "json_object"}
        )
        
        content = completion.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"Qwen API Error: {e}")
        return {"error": str(e)}


def call_gemini(prompt: str, api_key: str = None, model_name: str = "gemini-2.0-flash") -> Dict[str, Any]:
    key = api_key or settings.GEMINI_API_KEY
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    }
    
    try:
        # Use requests for better proxy compatibility
        proxies = None
        if settings.PROXY_URL:
            print(f"Using Proxy: {settings.PROXY_URL}")
            proxies = {
                "http": settings.PROXY_URL,
                "https": settings.PROXY_URL
            }

        print(prompt) 
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, proxies=proxies, timeout=60.0)
        
        if response.status_code == 429 and model_name == "gemini-2.0-flash":
            print(f"Gemini 2.0 Flash Rate Limit (429). Falling back to gemini-1.5-flash...")
            return call_gemini(prompt, api_key, model_name="gemini-1.5-flash")
            
        response.raise_for_status()
        data = response.json()
        
        # Extract JSON from text response
        text_content = data['candidates'][0]['content']['parts'][0]['text']
        # Clean up code blocks if present
        text_content = text_content.replace('```json', '').replace('```', '').strip()
        
        return json.loads(text_content)
    except Exception as e:
        print(f"Gemini API Error ({model_name}): {e}")
        # If it was already a fallback attempt or another error, return error
        return {"error": str(e)}
