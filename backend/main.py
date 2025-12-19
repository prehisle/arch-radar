from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Body, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, delete, desc
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import random
import json
import time
from sqlalchemy import func
from sqlalchemy.orm import selectinload

from backend.database import get_session, create_db_and_tables, redis_client
from backend.models import Question, ExamSession, KnowledgePoint, AIConfig, MajorChapter, AILog
from backend.parsers import parse_weight_table, parse_questions, parse_syllabus
from backend.config import settings
from backend.ai_service import generate_variant_questions
from backend.auth import router as auth_router, get_current_admin, ensure_default_admin
from backend.models import AdminUser

from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Smart Assessment System - System Architect")

app.include_router(auth_router)

# Mount static files for images
import os
images_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ziliao", "images")
if os.path.exists(images_path):
    app.mount("/images", StaticFiles(directory=images_path), name="images")


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Captcha-ID"],
)

# Health check endpoint (no authentication required)
@app.get("/health")
def health_check():
    """健康检查端点，用于容器健康检查"""
    return {"status": "healthy", "service": "arch-radar-backend"}

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    # Initialize Major Chapters if empty
    with Session(get_session().__next__().get_bind()) as session:
        if not session.exec(select(MajorChapter)).first():
            chapters = [
                "计算机系统基本知识", "信息系统基础知识", "信息安全技术基础知识", "软件工程基础知识",
                "数据库设计基础知识", "系统架构设计基础知识", "系统质量属性与架构评估", "软件可靠性技术",
                "软件架构的演化和维护", "未来信息综合技术", "标准化与知识产权", "信息系统架构的设计理论与实践",
                "层次式架构的设计理论与实践", "云原生架构设计理论与实践", "面向服务的架构设计理论与实践",
                "嵌入式系统的架构设计理论与实践", "通信系统架构的设计理论与实践", "安全架构的设计理论与实践",
                "大数据架构设计理论与实践"
            ]
            for i, name in enumerate(chapters):
                session.add(MajorChapter(name=name, order=i+1))
            session.commit()
            print("Initialized Major Chapters.")
        
        # Auto-link KnowledgePoints to MajorChapters
        # 1. Fetch all MajorChapters
        mcs = session.exec(select(MajorChapter)).all()
        # Create map: Order (Index+1) -> MajorChapter ID
        mc_order_map = {mc.order: mc.id for mc in mcs}
        
        # 2. Fetch all KnowledgePoints
        kps = session.exec(select(KnowledgePoint)).all()
        count_linked = 0
        
        for kp in kps:
            if not kp.chapter: continue
            # Extract Chapter Number from string like "1. Computer System" or "1.1 xxx"
            # We assume the first number before dot is the chapter index
            try:
                # E.g. "1. 计算机系统" -> 1
                # E.g. "10. 未来信息" -> 10
                import re
                match = re.match(r'^(\d+)', kp.chapter.strip())
                if match:
                    chapter_num = int(match.group(1))
                    if chapter_num in mc_order_map:
                        if kp.major_chapter_id != mc_order_map[chapter_num]:
                            kp.major_chapter_id = mc_order_map[chapter_num]
                            session.add(kp)
                            count_linked += 1
            except Exception as e:
                print(f"Error linking KP {kp.name}: {e}")
                
        if count_linked > 0:
            session.commit()
            print(f"Linked {count_linked} KnowledgePoints to MajorChapters.")

        # Ensure default admin account exists
        ensure_default_admin(session)

# -----------------------------------------------------------------------------
# Admin APIs
# -----------------------------------------------------------------------------

@app.post("/api/admin/upload/syllabus")
async def upload_syllabus(file: UploadFile = File(...), db: Session = Depends(get_session)):
    content = (await file.read()).decode("utf-8")
    items = parse_syllabus(content)
    
    count = 0
    
    for item in items:
        # Only process points
        if item.get('type') != 'point':
            continue
            
        name = item['name']
        
        # Check if exists
        existing = db.exec(select(KnowledgePoint).where(KnowledgePoint.name == name)).first()
        
        if existing:
            kp = existing
            # Update structure info if needed
            if item.get('chapter'):
                kp.chapter = item['chapter']
            if item.get('description'):
                kp.description = item['description']
            db.add(kp)
        else:
            kp = KnowledgePoint(
                name=name,
                chapter=item.get('chapter', ''),
                description=item.get('description', ''),
                k_type='point'
            )
            db.add(kp)
            
        count += 1
        
    db.commit()
    return {"message": f"Processed {count} syllabus knowledge points"}

@app.post("/api/admin/upload/weights")
async def upload_weights(file: UploadFile = File(...), db: Session = Depends(get_session)):
    content = (await file.read()).decode("utf-8")
    data = parse_weight_table(content)
    
    count = 0
    for item in data:
        # Check if KP exists
        kp = db.exec(select(KnowledgePoint).where(KnowledgePoint.name == item['name'])).first()
        if kp:
            # Update weight
            kp.weight_level = item['weight_level']
            kp.weight_score = item['weight_score']
            kp.frequency = item.get('frequency', 0)
            kp.analysis = item.get('analysis')
            # kp.description = item.get('description') # Weight table no longer has description, it has analysis
            db.add(kp)
        else:
            # Create new (flat, as we don't have parent info from weight table usually, unless we infer from Chapter)
            # The parser extracts Chapter.
            kp = KnowledgePoint(**item)
            db.add(kp)
        count += 1
    
    db.commit()
    return {"message": f"Updated/Created {count} knowledge points from weights"}

@app.post("/api/admin/upload/questions")
async def upload_questions(
    source_type: str = Query(..., description="past_paper or exercise"),
    file: UploadFile = File(...), 
    db: Session = Depends(get_session)
):
    # Map source_type to Chinese if English provided
    # The user requested NOT to use English types in the DB.
    # We allow the API param to be English for compatibility but convert it here.
    type_map = {
        "past_paper": "历年真题",
        "exercise": "章节练习"
    }
    db_source_type = type_map.get(source_type, source_type)

    content = (await file.read()).decode("utf-8")
    questions_data = parse_questions(content, db_source_type)
    
    count = 0
    for q_data in questions_data:
        # Try to link KP
        kp_raw = q_data.pop("kp_raw", "")
        kp_id = None
        
        if kp_raw:
            # KP is now extracted directly from the file (e.g. "**知识点**: 操作系统")
            # We should try to find an exact match first, then fuzzy
            kp_name = kp_raw.strip()
            
            # Exact match
            kp = db.exec(select(KnowledgePoint).where(KnowledgePoint.name == kp_name)).first()
            if not kp:
                 # Fallback: Try contains if exact match fails
                 kp = db.exec(select(KnowledgePoint).where(KnowledgePoint.name.contains(kp_name))).first()
            
            if kp:
                kp_id = kp.id
        
        question = Question(**q_data, knowledge_point_id=kp_id)
        db.add(question)
        count += 1
        
    db.commit()
    return {"message": f"Uploaded {count} questions for {db_source_type}"}

# --- CRUD APIs for Data Management ---

@app.get("/api/admin/knowledge_points")
def get_kps(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    db: Session = Depends(get_session)
):
    query = select(KnowledgePoint)
    if search:
        query = query.where(KnowledgePoint.name.contains(search))
    
    total = db.exec(select(func.count()).select_from(query.subquery())).one()
    kps = db.exec(query.offset(skip).limit(limit)).all()
    
    return {"total": total, "data": kps}

@app.put("/api/admin/knowledge_points/{kp_id}")
def update_kp(kp_id: int, data: Dict[str, Any], db: Session = Depends(get_session)):
    kp = db.get(KnowledgePoint, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")
    
    for k, v in data.items():
        if hasattr(kp, k):
            setattr(kp, k, v)
            
    db.add(kp)
    db.commit()
    return kp

@app.delete("/api/admin/knowledge_points/{kp_id}")
def delete_kp(kp_id: int, db: Session = Depends(get_session)):
    kp = db.get(KnowledgePoint, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")
    db.delete(kp)
    db.commit()
    return {"status": "deleted"}

@app.get("/api/admin/questions")
def get_questions(
    skip: int = 0, 
    limit: int = 50, 
    source_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_session)
):
    query = select(Question).options(selectinload(Question.knowledge_point))
    if source_type:
        query = query.where(Question.source_type == source_type)
    if search:
        query = query.where(Question.content.contains(search))
        
    total = db.exec(select(func.count()).select_from(query.subquery())).one()
    questions = db.exec(query.offset(skip).limit(limit)).all()
    
    # Enrich with KP details
    data = []
    for q in questions:
        item = q.dict()
        if q.knowledge_point:
            item['knowledge_point'] = q.knowledge_point.dict()
        data.append(item)
    
    return {"total": total, "data": data}

@app.put("/api/admin/questions/{q_id}")
def update_question(q_id: int, data: Dict[str, Any], db: Session = Depends(get_session)):
    q = db.get(Question, q_id)
    if not q:
        raise HTTPException(404, "Question not found")
        
    for k, v in data.items():
        if hasattr(q, k):
            setattr(q, k, v)
            
    db.add(q)
    db.commit()
    return q

@app.delete("/api/admin/questions/{q_id}")
def delete_question(q_id: int, db: Session = Depends(get_session)):
    q = db.get(Question, q_id)
    if not q:
        raise HTTPException(404, "Question not found")
    db.delete(q)
    db.commit()
    return {"status": "deleted"}

# --- AI Config APIs ---

@app.get("/api/admin/config")
def get_ai_config(db: Session = Depends(get_session)):
    configs = db.exec(select(AIConfig)).all()
    return {c.config_key: c.value for c in configs}

@app.post("/api/admin/config")
def update_ai_config(config: Dict[str, str], db: Session = Depends(get_session)):
    for k, v in config.items():
        existing = db.exec(select(AIConfig).where(AIConfig.config_key == k)).first()
        if existing:
            existing.value = v
            db.add(existing)
        else:
            new_conf = AIConfig(config_key=k, value=v)
            db.add(new_conf)
    db.commit()
    return {"status": "updated"}

# -----------------------------------------------------------------------------
# Exam APIs
# -----------------------------------------------------------------------------

@app.get("/api/exam/session/{session_id}")
def get_exam_session(
    session_id: str,
    db: Session = Depends(get_session)
):
    """
    Get existing session details without triggering new generation.
    """
    # 1. Try Redis
    cache_key = f"exam_session:{session_id}" # Note: previous keys were by fingerprint, but here we query by ID
    # But wait, our cache logic uses fingerprint as key: f"exam_session:{user_fingerprint}"
    # We can't easily look up by session_id in Redis unless we scan or have secondary index.
    # So we look up in DB first.
    
    session = db.get(ExamSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
        
    # Check if submitted
    if session.is_submitted:
        # Return what? Or maybe just allow viewing?
        pass

    # Calculate duration left
    time_diff = (datetime.utcnow() - session.start_time).total_seconds()
    duration_left = max(0, int(9000 - time_diff))
    
    return {
        "session_id": session.id,
        "status": "resumed",
        "start_time": session.start_time.isoformat(),
        "duration_left": duration_left,
        "questions": get_questions_by_ids(db, session.question_ids),
        "user_answers": session.user_answers or {}
    }

def get_user_question_history(fingerprint: str) -> List[int]:
    """Get list of question IDs recently seen by user."""
    key = f"user_history:{fingerprint}"
    try:
        # Get all history
        ids = redis_client.lrange(key, 0, -1)
        return [int(x) for x in ids] if ids else []
    except Exception as e:
        print(f"Redis History Fetch Error: {e}")
        return []

def get_user_kp_error_rates(db: Session, fingerprint: str) -> Dict[int, float]:
    """
    Calculate error rates for each KP based on user's past sessions.
    Returns: {kp_id: error_rate} (0.0 to 1.0)
    """
    # 1. Fetch user's submitted sessions
    sessions = db.exec(select(ExamSession).where(
        ExamSession.user_fingerprint == fingerprint,
        ExamSession.is_submitted == True
    ).order_by(desc(ExamSession.start_time)).limit(20)).all()
    
    if not sessions: return {}
    
    # 2. Collect stats
    kp_stats = {} # {kp_id: {total: 0, wrong: 0}}
    
    # We need to fetch all questions involved to know their KPs and Answers
    # Optimization: Collect all QIDs first
    all_qids = set()
    for s in sessions:
        if s.question_ids:
            all_qids.update(s.question_ids)
            
    if not all_qids: return {}
    
    questions = db.exec(select(Question).where(Question.id.in_(all_qids))).all()
    q_map = {q.id: q for q in questions}
    
    for s in sessions:
        if not s.user_answers: continue
        
        for qid_int in s.question_ids:
            q = q_map.get(qid_int)
            if not q or not q.knowledge_point_id: continue
            
            qid_str = str(qid_int)
            user_ans = s.user_answers.get(qid_str)
            
            if q.knowledge_point_id not in kp_stats:
                kp_stats[q.knowledge_point_id] = {"total": 0, "wrong": 0}
            
            kp_stats[q.knowledge_point_id]["total"] += 1
            
            # Check correctness (simple match)
            if user_ans != q.answer:
                kp_stats[q.knowledge_point_id]["wrong"] += 1
                
    # 3. Calculate rates
    rates = {}
    for kpid, stats in kp_stats.items():
        if stats["total"] > 0:
            rates[kpid] = stats["wrong"] / stats["total"]
            
    return rates

def update_user_question_history(fingerprint: str, q_ids: List[int]):
    """Push new question IDs to history and trim."""
    if not q_ids: return
    key = f"user_history:{fingerprint}"
    try:
        # Push to left
        redis_client.lpush(key, *q_ids)
        # Keep last 200
        redis_client.ltrim(key, 0, 199)
        # Set expire (e.g. 30 days)
        redis_client.expire(key, 3600 * 24 * 30)
    except Exception as e:
        print(f"Redis History Update Error: {e}")

@app.post("/api/exam/start")
def start_exam(
    request: Request,
    user_fingerprint: str = Body(..., embed=True), 
    db: Session = Depends(get_session)
):
    # Capture Info
    # Handle Proxy Headers for Real IP
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # X-Forwarded-For: <client>, <proxy1>, <proxy2>
        ip = forwarded_for.split(",")[0].strip()
    else:
        # Fallback to X-Real-IP if available
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            ip = real_ip
        else:
            ip = request.client.host
            
    user_agent = request.headers.get("user-agent", "").lower()
    
    # Device Detection
    device = "PC"
    if "mobile" in user_agent or "android" in user_agent or "iphone" in user_agent or "ipad" in user_agent:
        if "ipad" in user_agent: device = "iPad"
        elif "iphone" in user_agent: device = "iPhone"
        elif "android" in user_agent: device = "Android"
        else: device = "Mobile"
    
    # Debug Logging
    print(f"DEBUG: IP={ip}, UA={user_agent}, Device={device}")

    # Location Detection
    location = "Unknown"
    # Check for private IP ranges (Local LAN)
    if ip == "127.0.0.1" or ip.startswith("192.168.") or ip.startswith("10.") or (ip.startswith("172.") and 16 <= int(ip.split('.')[1]) <= 31):
        location = "局域网 (LAN)"
    else:
        # Try external API for public IP
        try:
            import requests
            # Use ip-api.com (free, no key, rate limited)
            res = requests.get(f"http://ip-api.com/json/{ip}?lang=zh-CN", timeout=3)
            if res.status_code == 200:
                data = res.json()
                if data.get("status") == "success":
                    location = f"{data.get('regionName', '')} {data.get('city', '')}".strip()
        except Exception:
            pass # Keep as Unknown if failed



    # 1. Check Redis Cache first (3.2.2 Session Persistence)
    cache_key = f"exam_session:{user_fingerprint}"
    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            print(f"DEBUG: Cache Hit for {user_fingerprint}")
            session_data = json.loads(cached_data)
            # Recalculate duration_left based on start_time in cache (or just trust cache? Time passes...)
            # Ideally we recalculate.
            start_time = datetime.fromisoformat(session_data["start_time"])
            time_diff = (datetime.utcnow() - start_time).total_seconds()
            
            if time_diff < 9000:
                session_data["duration_left"] = int(9000 - time_diff)
                return session_data
            else:
                # Expired in logic even if in Redis
                redis_client.delete(cache_key)
    except Exception as e:
        print(f"Redis Error: {e}")

    # 2. Check active session in DB (Fallback / Long term)
    existing = db.exec(select(ExamSession).where(
        ExamSession.user_fingerprint == user_fingerprint,
        ExamSession.is_submitted == False
    )).first()
    
    if existing:
        # Update device/ip info on resume
        existing.ip_address = ip
        existing.device_info = device
        existing.location = location
        db.add(existing)
        db.commit()

        time_diff = (datetime.utcnow() - existing.start_time).total_seconds()
        if time_diff < 9000: # 150 mins
            # Resume
            print(f"DEBUG: Resuming active session from DB for {user_fingerprint}")
            response_data = {
                "session_id": existing.id,
                "status": "resumed",
                "start_time": existing.start_time.isoformat(),
                "duration_left": int(9000 - time_diff),
                "questions": get_questions_by_ids(db, existing.question_ids),
                "user_answers": existing.user_answers
            }
            # Cache it
            try:
                redis_client.setex(cache_key, 1800, json.dumps(response_data))
            except Exception as e:
                print(f"Redis Set Error: {e}")
                
            return response_data
        else:
            # Expire
            existing.is_submitted = True
            db.add(existing)
            db.commit()
            
    # 3. Generate New Exam
    
    # Lock to prevent double generation
    lock_key = f"exam_gen_lock:{user_fingerprint}"
    if not redis_client.set(lock_key, "1", nx=True, ex=30):
        # Already generating
        print(f"DEBUG: Concurrent generation detected for {user_fingerprint}")
        # Wait loop
        for _ in range(10):
            time.sleep(0.5)
            existing = db.exec(select(ExamSession).where(
                ExamSession.user_fingerprint == user_fingerprint,
                ExamSession.is_submitted == False
            )).first()
            if existing:
                # Return session
                time_diff = (datetime.utcnow() - existing.start_time).total_seconds()
                return {
                    "session_id": existing.id,
                    "status": "resumed",
                    "start_time": existing.start_time.isoformat(),
                    "duration_left": int(9000 - time_diff),
                    "questions": get_questions_by_ids(db, existing.question_ids),
                    "user_answers": existing.user_answers
                }
        raise HTTPException(429, "Exam generation in progress, please retry.")

    # Target: 75 Qs. 
    # 30% Past (22), 50% Exercise (38), 20% AI (15)
    
    # We use "历年真题" and "章节练习" as source_type now, mapped from upload
    q_past = db.exec(select(Question).where(Question.source_type == "历年真题")).all()
    q_exercise = db.exec(select(Question).where(Question.source_type == "章节练习")).all()
    q_ai = db.exec(select(Question).where(Question.source_type == "ai_generated")).all()
    
    # If no data found with Chinese types, try fallback to English types (legacy support)
    if not q_past:
        q_past = db.exec(select(Question).where(Question.source_type == "past_paper")).all()
    if not q_exercise:
        q_exercise = db.exec(select(Question).where(Question.source_type == "exercise")).all()
    
    # Pre-fetch KP weights for weighted sampling
    # We fetch ID and Score
    kps = db.exec(select(KnowledgePoint.id, KnowledgePoint.weight_score)).all()
    # Optimization 1: User Error Rate Weighting
    user_error_rates = get_user_kp_error_rates(db, user_fingerprint)
    
    kp_weights = {}
    for kp_id, score in kps:
        base_weight = score if score and score > 0 else 1
        # Apply Error Rate Factor: W_final = W_global * (1 + 2.0 * ErrorRate)
        error_rate = user_error_rates.get(kp_id, 0.0)
        kp_weights[kp_id] = base_weight * (1.0 + 2.0 * error_rate)

    # Optimization 2: Sliding Window Deduplication
    user_history = get_user_question_history(user_fingerprint)
    
    # Weight-based selection helper
    def weighted_sample(questions, k, exclude_ids=None):
        if not questions: return []
        
        # Filter exclusions
        candidates = questions
        if exclude_ids:
             candidates = [q for q in questions if q.id not in exclude_ids]
             
        # Fallback if candidates not enough (backfill from excluded if needed, oldest first logic implied by random if we just ignore exclusion)
        # But simple fallback: if not enough candidates, use full list
        if len(candidates) < k:
            candidates = questions # Reset filter
        
        if len(candidates) <= k: return candidates
        
        # Efraimidis-Spirakis algorithm
        scored_items = []
        for q in candidates:
            w = kp_weights.get(q.knowledge_point_id, 1) 
            if w <= 0: w = 1
            
            r = random.random()
            if r == 0: r = 1e-10
            
            score = r ** (1.0 / w)
            scored_items.append((score, q))
            
        scored_items.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored_items[:k]]

    selected = []
    
    # 1. Select 5 "Low Weight" questions (General/Cold/Not Syllabus)
    # Fetch candidate questions via join
    q_low_weight = db.exec(select(Question).join(KnowledgePoint).where(
        KnowledgePoint.weight_level.in_(["一般", "冷门", "非考纲要求"])
    )).all()
    
    # Filter History for Low Weight too
    low_weight_candidates = [q for q in q_low_weight if q.id not in user_history]
    if len(low_weight_candidates) < 5: low_weight_candidates = q_low_weight
    
    low_weight_picks = []
    if low_weight_candidates:
        count_low = min(len(low_weight_candidates), 5)
        low_weight_picks = random.sample(low_weight_candidates, count_low)
        selected.extend(low_weight_picks)
        
    # Remove picked low weight questions from pools to avoid duplicates
    picked_ids = {q.id for q in low_weight_picks}
    q_past = [q for q in q_past if q.id not in picked_ids]
    q_exercise = [q for q in q_exercise if q.id not in picked_ids]
    
    # 2. Fill remaining slots
    # Target: 22 Past, 45 Exercise
    selected.extend(weighted_sample(q_past, 22, exclude_ids=user_history))
    selected.extend(weighted_sample(q_exercise, 45, exclude_ids=user_history))
    
    # Fill AI quota
    needed_ai = 75 - len(selected)
    
    # Optimization 3: Error-Driven AI Generation (Sync with Timeout)
    # Identify Target KPs: Top 3 Weakest KPs (Error Rate > 0.4)
    # Sort error rates
    sorted_errors = sorted(user_error_rates.items(), key=lambda x: x[1], reverse=True)
    target_kps = [kpid for kpid, rate in sorted_errors if rate >= 0.4][:3]
    
    # If no weak KPs (New User), pick top weighted KPs
    if not target_kps:
        sorted_weights = sorted(kps, key=lambda x: x[1] if x[1] else 0, reverse=True)
        target_kps = [x[0] for x in sorted_weights[:3]]
        
    # Check if we need to generate for these KPs
    # Filter q_ai by target_kps and check count
    # Since q_ai list is all AI questions, we filter in memory
    
    # Group q_ai by KP
    ai_by_kp = {}
    for q in q_ai:
        if q.knowledge_point_id:
            ai_by_kp.setdefault(q.knowledge_point_id, []).append(q)
            
    # For each target KP, if we have < 1 AI questions, generate 1
    # Optimize: Collect all seeds first and do ONE AI call
    all_seeds_data = []
    
    for kpid in target_kps:
        existing_ai_count = len(ai_by_kp.get(kpid, []))
        if existing_ai_count < 1:
            # Need to generate
            # Find seed questions for this KP (from Past/Exercise)
            # Fetch 1 seed
            seeds = db.exec(select(Question).where(
                Question.knowledge_point_id == kpid,
                Question.source_type.in_(["历年真题", "章节练习", "past_paper", "exercise"])
            ).limit(1)).all()
            
            if seeds:
                for q in seeds:
                    kp_name = q.knowledge_point.name if q.knowledge_point else "Unknown"
                    all_seeds_data.append({
                        "id": q.id, 
                        "content": q.content, 
                        "options": q.options, 
                        "answer": q.answer, 
                        "explanation": q.explanation,
                        "knowledge_point": kp_name,
                        "kp_id": kpid # Pass KP ID to map back later
                    })
        else:
            print(f"DEBUG: Skipping AI generation for KP {kpid}, enough questions ({existing_ai_count}) exist.")

    if all_seeds_data:
        try:
            # Fetch API Key
            if settings.AI_PROVIDER == "qwen":
                api_conf = db.exec(select(AIConfig).where(AIConfig.config_key == "qwen_api_key")).first()
                api_key = api_conf.value if api_conf else settings.QWEN_API_KEY
            else:
                api_conf = db.exec(select(AIConfig).where(AIConfig.config_key == "gemini_api_key")).first()
                api_key = api_conf.value if api_conf else settings.GEMINI_API_KEY

            start_ts = time.time()
            
            # Batch generate: Pass all seeds at once (No batching needed for small N=3)
            generated_all = generate_variant_questions(all_seeds_data, 1, api_key=api_key)
            
            duration = time.time() - start_ts
            db.add(AILog(call_type="smart_paper_error_driven", status="success", response_time=duration))
            
            # Save
            new_qs = []
            
            # Helper to find original KP ID from generated item (based_on_id)
            seed_kp_map = {str(item["id"]): item["kp_id"] for item in all_seeds_data}
            
            for item in generated_all:
                # Basic validation
                raw_content = item.get("content", "")
                if not raw_content: continue
                
                content = str(raw_content).strip()
                if len(content) < 5 or "xxx" in content.lower(): continue
                
                if not item.get("options") or not item.get("answer"): continue
                
                opts = item.get("options", [])
                if not isinstance(opts, list) or len(opts) < 2: continue
                
                # Retrieve KP ID
                base_id = str(item.get('based_on_id', ''))
                kp_id_gen = seed_kp_map.get(base_id)
                
                if not kp_id_gen: continue # Should not happen if AI returns based_on_id correctly
                
                # Ensure options list
                if isinstance(opts, str):
                    try: opts = json.loads(opts)
                    except: pass

                q = Question(
                    content=item["content"],
                    options=opts,
                    answer=item["answer"],
                    explanation=item.get("explanation", "AI Generated"),
                    source_type="ai_generated",
                    knowledge_point_id=kp_id_gen,
                    source_detail=f"Error-Driven Variant of {base_id}"
                )
                db.add(q)
                new_qs.append(q)
            
            db.commit()
            for q in new_qs: db.refresh(q)
            q_ai.extend(new_qs)
            
        except Exception as e:
            print(f"Error-Driven AI Generation Failed: {e}")

    # Now select AI questions
    selected.extend(weighted_sample(q_ai, needed_ai, exclude_ids=user_history))
        
    # Final check and backfill
    if len(selected) < 75:
        needed_backfill = 75 - len(selected)
        print(f"DEBUG: Insufficient questions ({len(selected)}), backfilling {needed_backfill}...")
        
        # Collect all used IDs
        used_ids = {q.id for q in selected}
        
        # Try to fetch from database excluding already selected ones
        # We fetch extra to ensure randomness
        backfill_candidates = db.exec(select(Question).where(Question.id.not_in(used_ids)).limit(needed_backfill * 5)).all()
        
        if backfill_candidates:
            # If we have enough, sample
            if len(backfill_candidates) >= needed_backfill:
                backfill_picks = random.sample(backfill_candidates, needed_backfill)
            else:
                backfill_picks = backfill_candidates
                
            selected.extend(backfill_picks)
            print(f"DEBUG: Backfilled {len(backfill_picks)} questions.")
        else:
            print("DEBUG: No more questions available in DB to backfill.")
        
    # Shuffle final list
    random.shuffle(selected)
    q_ids = [q.id for q in selected]
    
    session = ExamSession(
        user_fingerprint=user_fingerprint,
        question_ids=q_ids,
        ip_address=ip,
        device_info=device,
        location=location
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    response_data = {
        "session_id": session.id,
        "status": "created",
        "start_time": session.start_time.isoformat(),
        "duration_left": 9000, # 150 mins
        "questions": get_questions_by_ids(db, q_ids),
        "user_answers": {}
    }
    
    # Cache to Redis
    try:
        redis_client.setex(cache_key, 1800, json.dumps(response_data))
    except Exception as e:
        print(f"Redis Set Error: {e}")
    
    redis_client.delete(lock_key)
    return response_data

def get_questions_by_ids(db: Session, ids: List[int]):
    # Maintain order?
    qs = db.exec(select(Question).where(Question.id.in_(ids))).all()
    q_map = {q.id: q for q in qs}
    result = []
    for i, qid in enumerate(ids):
        q = q_map.get(qid)
        if q:
            # Hide answer/explanation for exam
            result.append({
                "id": q.id,
                "index": i + 1,
                "content": q.content,
                "options": q.options,
                "type": "single", # Single choice
                "user_answer": None
            })
    return result

@app.post("/api/exam/sync")
def sync_answers(
    session_id: str = Body(...),
    answers: Dict[str, str] = Body(...),
    db: Session = Depends(get_session)
):
    session = db.get(ExamSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
        
    session.user_answers = answers
    db.add(session)
    db.commit()
    
    # Update Redis Cache
    try:
        cache_key = f"exam_session:{session.user_fingerprint}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            data = json.loads(cached_data)
            data["user_answers"] = answers
            redis_client.setex(cache_key, 1800, json.dumps(data))
    except Exception as e:
        print(f"Redis Update Error: {e}")
        
    return {"status": "synced"}

from backend.ai_service import generate_report, generate_share_content

@app.post("/api/exam/submit")
def submit_exam(
    session_id: str = Body(..., embed=True),
    db: Session = Depends(get_session)
):
    session = db.get(ExamSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
        
    if session.is_submitted:
        return session.ai_report or {"error": "Already submitted but no report"}

    # Grade
    questions = db.exec(select(Question).where(Question.id.in_(session.question_ids))).all()
    q_map = {q.id: q for q in questions}
    
    score = 0
    
    # For detailed analysis
    kp_stats = {} # {kp_id: {total: 0, correct: 0, name: ""}}
    
    for qid in session.question_ids:
        q = q_map.get(qid)
        if not q: continue
        
        user_ans = session.user_answers.get(str(qid))
        
        # Grading logic update for multi-answer
        # If multi-blank (options is list of lists), we can count partial credit or full credit.
        # Requirement usually: strict match for full credit, or 1 point per blank?
        # Standard software exam: 1 point per question ID usually, even if it has multiple blanks (usually these are separate question IDs in real paper, but here merged)
        # BUT wait, "1个题目有多个选项...每个空的答案也不一样" -> This usually means it's effectively multiple questions sharing one stem.
        # In our system, it is ONE Question entity.
        # Let's assume strict matching for now: User must get ALL blanks right to get the point for this Question ID.
        # OR: if we want partial credit, we need to change scoring system (float score or multiple points per Question).
        # Given "score += 1" above, it implies 1 point per Question entity.
        # So we stick to: user_ans string must equal q.answer string (e.g. "A,B" == "A,B")
        
        is_correct = (user_ans == q.answer)
        if is_correct:
            score += 1
            
        # Stats
        if q.knowledge_point_id:
            if q.knowledge_point_id not in kp_stats:
                # Need to fetch KP name and details
                kp_name = "Unknown"
                kp_chapter = "Unknown"
                kp_weight = "Unknown"
                
                kp = q.knowledge_point
                if not kp:
                    kp = db.get(KnowledgePoint, q.knowledge_point_id)
                
                if kp:
                    kp_name = kp.name
                    kp_weight = kp.weight_level
                    # Try to get major chapter name if linked
                    if kp.major_chapter_id:
                         mc = db.get(MajorChapter, kp.major_chapter_id)
                         if mc: kp_chapter = mc.name
                    else:
                         kp_chapter = kp.chapter # Fallback
                    
                kp_stats[q.knowledge_point_id] = {
                    "total": 0, 
                    "correct": 0, 
                    "name": kp_name,
                    "chapter": kp_chapter,
                    "weight": kp_weight
                }
            
            kp_stats[q.knowledge_point_id]["total"] += 1
            if is_correct:
                kp_stats[q.knowledge_point_id]["correct"] += 1
        
    # Update Redis Cache (History)
    update_user_question_history(session.user_fingerprint, session.question_ids)
    
    final_score = score
    final_end_time = datetime.utcnow()
    
    # Calculate duration in minutes
    duration_seconds = (final_end_time - session.start_time).total_seconds()
    duration_minutes = int(duration_seconds / 60)
    
    # Generate AI Report
    # Get Prompt from DB
    prompt_conf = db.exec(select(AIConfig).where(AIConfig.config_key == "prompt_report")).first()
    prompt_template = prompt_conf.value if prompt_conf else settings.DEFAULT_PROMPT_REPORT
    
    # Get API Key
    if settings.AI_PROVIDER == "qwen":
        api_conf = db.exec(select(AIConfig).where(AIConfig.config_key == "qwen_api_key")).first()
        api_key = api_conf.value if api_conf else settings.QWEN_API_KEY
    else:
        api_conf = db.exec(select(AIConfig).where(AIConfig.config_key == "gemini_api_key")).first()
        api_key = api_conf.value if api_conf else settings.GEMINI_API_KEY
    
    # Run AI Generation
    # We run it synchronously here for simplicity, but for production use BackgroundTasks
    # IMPORTANT: Do not modify session object before this to avoid holding DB locks during slow AI call (due to autoflush)
    try:
        # Fetch historical rates for context
        history_rates = get_user_kp_error_rates(db, session.user_fingerprint)
        
        start_ts = time.time()
        report = generate_report(final_score, kp_stats, prompt_template, api_key=api_key, duration_minutes=duration_minutes, history_rates=history_rates)
        duration = time.time() - start_ts
        db.add(AILog(call_type="report", status="success", response_time=duration))
        
        # Fallback if AI fails
        if "error" in report:
            print(f"AI Generation Failed: {report['error']}")
            # We already logged success for the API call itself (it returned), but the content might be error.
            # Actually if it returns a dict with error, it technically succeeded in calling, but failed in content.
            # Let's count it as success in invocation, but maybe we want to know.
            # For now, keep it simple.
            report = generate_ai_report_mock(final_score, kp_stats, db)
        else:
            # Inject radar data if AI succeeded
            report["radar_data"] = calculate_radar_data(kp_stats, db)
    except Exception as e:
        duration = time.time() - start_ts
        db.add(AILog(call_type="report", status="failure", response_time=duration, error_message=str(e)))
        print(f"AI Service Exception: {e}")
        report = generate_ai_report_mock(final_score, kp_stats, db)

    # Inject basic stats (accuracy, duration)
    report["score"] = final_score
    report["accuracy"] = int((final_score / 75) * 100)
    report["duration_minutes"] = duration_minutes
    report["total_questions"] = 75

    # Update Session - Now safe to acquire lock
    session.score = final_score
    session.is_submitted = True
    session.end_time = final_end_time
    session.ai_report = report
    
    db.add(session)
    db.commit()
    
    # Clear Redis Cache (3.2.2)
    try:
        redis_client.delete(f"exam_session:{session.user_fingerprint}")
        print(f"DEBUG: Cleared cache for {session.user_fingerprint}")
    except Exception as e:
        print(f"Redis Delete Error: {e}")
    
    return report

@app.post("/api/exam/share")
def get_share_content(
    session_id: str = Body(..., embed=True),
    db: Session = Depends(get_session)
):
    session = db.get(ExamSession, session_id)
    if not session or not session.ai_report:
        raise HTTPException(404, "Report not found")
        
    # Increment share count
    session.share_count += 1
    db.add(session)
    # Commit session update but keep going for AI log
    
    # Get Prompt
    prompt_conf = db.exec(select(AIConfig).where(AIConfig.config_key == "prompt_share")).first()
    prompt_template = prompt_conf.value if prompt_conf else settings.DEFAULT_PROMPT_SHARE
    
    # Get API Key
    if settings.AI_PROVIDER == "qwen":
        api_conf = db.exec(select(AIConfig).where(AIConfig.config_key == "qwen_api_key")).first()
        api_key = api_conf.value if api_conf else settings.QWEN_API_KEY
    else:
        api_conf = db.exec(select(AIConfig).where(AIConfig.config_key == "gemini_api_key")).first()
        api_key = api_conf.value if api_conf else settings.GEMINI_API_KEY
    
    # Check if share content already exists
    if session.ai_report and "share_content" in session.ai_report:
        return session.ai_report["share_content"]
    
    try:
        start_ts = time.time()
        share_content = generate_share_content(session.ai_report, prompt_template, api_key=api_key)
        duration = time.time() - start_ts
        db.add(AILog(call_type="social_analysis", status="success", response_time=duration))
        
        # Save generated content to session
        session.ai_report["share_content"] = share_content
        # Force update because SQLModel/SQLAlchemy might not detect dict mutation
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(session, "ai_report")
        db.add(session)
        
        db.commit() # Commit logs and session update
        return share_content
    except Exception as e:
        duration = time.time() - start_ts
        db.add(AILog(call_type="social_analysis", status="failure", response_time=duration, error_message=str(e)))
        db.commit()
        raise HTTPException(500, f"AI generation failed: {str(e)}")

def calculate_radar_data(kp_stats, db):
    # Fetch KP details
    kps = db.exec(select(KnowledgePoint).where(KnowledgePoint.id.in_(kp_stats.keys()))).all()
    kp_map = {kp.id: kp for kp in kps}
    
    # Major Chapter stats aggregation
    major_chapters = db.exec(select(MajorChapter)).all()
    mc_map = {mc.id: {"name": mc.name, "correct": 0, "total": 0, "order": mc.order} for mc in major_chapters}
    
    for kpid, stats in kp_stats.items():
        kp = kp_map.get(kpid)
        if not kp: continue
        
        # Link via major_chapter_id
        if kp.major_chapter_id and kp.major_chapter_id in mc_map:
             mc_map[kp.major_chapter_id]["correct"] += stats["correct"]
             mc_map[kp.major_chapter_id]["total"] += stats["total"]
        else:
             # Try fuzzy match if not linked yet (fallback)
             found = False
             kp_chap = kp.chapter.strip() if kp.chapter else ""
             if kp_chap:
                 import re
                 match = re.match(r'^(\d+)', kp_chap)
                 if match:
                     order = int(match.group(1))
                     # Find MC with this order
                     for mc_id, data in mc_map.items():
                         if data["order"] == order:
                             mc_map[mc_id]["correct"] += stats["correct"]
                             mc_map[mc_id]["total"] += stats["total"]
                             found = True
                             break
    
    # Format Data
    radar_data = []
    sorted_mcs = sorted(mc_map.values(), key=lambda x: x["order"])
    
    for data in sorted_mcs:
        score_pct = int((data["correct"] / data["total"]) * 100) if data["total"] > 0 else 0
        radar_data.append({
            "subject": data["name"],
            "A": score_pct,
            "fullMark": 100
        })
            
    return radar_data

def generate_ai_report_mock(score, kp_stats, db):
    # Fetch KP details
    kps = db.exec(select(KnowledgePoint).where(KnowledgePoint.id.in_(kp_stats.keys()))).all()
    kp_map = {kp.id: kp for kp in kps}
    
    weaknesses = []
    strengths = []
    
    for kpid, stats in kp_stats.items():
        kp = kp_map.get(kpid)
        if not kp: continue
        
        accuracy = stats["correct"] / stats["total"]
        if accuracy < 0.6:
            weaknesses.append(f"{kp.name}")
        else:
            strengths.append(f"{kp.name}")
            
    radar_data = calculate_radar_data(kp_stats, db)
        
    # Learning Path
    path = []
    if weaknesses:
        path = [f"重点复习: {w}" for w in weaknesses[:5]]
    else:
        path = ["继续保持，多做真题巩固。"]
    
    level = "初级架构师"
    if score >= 45:
        level = "高级架构师"
    elif score >= 30:
        level = "准高级架构师"
        
    return {
        "score": score,
        "total": 75,
        "accuracy": int((score/75)*100),
        "title": level,
        "strong_points": strengths,
        "weak_points": weaknesses,
        "learning_path": path,
        "prediction": f"基于您当前表现，若针对薄弱环节进行复习，预计下次考试得分有望提升至 {min(75, score + 8)} 分。",
        "radar_data": radar_data,
        "detail_results": [] 
    }

from fastapi.responses import Response

@app.get("/api/exam/report/{session_id}/pdf")
async def get_report_pdf(session_id: str, db: Session = Depends(get_session)):
    session = db.get(ExamSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
        
    if not session.is_submitted or not session.ai_report:
        raise HTTPException(400, "Report not generated yet")
        
    from backend.pdf_generator import create_pdf_report
    
    # We need to reconstruct the full report data structure expected by the generator
    # Assuming 'session.ai_report' contains the 'ai_report' key content
    # But wait, looking at 'submit_exam', it returns 'session.ai_report' directly?
    # Let's check submit_exam return value.
    # It returns session.ai_report.
    
    # However, the frontend receives { ai_report: ..., questions: ... } structure from somewhere else?
    # Ah, let's check get_report endpoint.
    
    pdf_bytes = create_pdf_report({"ai_report": session.ai_report}, session_id)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Smart_Assessment_Report_{session_id[:8]}.pdf"
        }
    )

@app.get("/api/exam/report/{session_id}")
def get_report(session_id: str, db: Session = Depends(get_session)):
    session = db.get(ExamSession, session_id)
    if not session or not session.ai_report:
        raise HTTPException(404, "Report not found")
    
    # Fetch full question details including answer and explanation
    questions = db.exec(select(Question).where(Question.id.in_(session.question_ids))).all()
    q_map = {q.id: q for q in questions}
    
    # Build detailed question list
    detail_questions = []
    for i, qid in enumerate(session.question_ids):
        q = q_map.get(qid)
        if q:
            detail_questions.append({
                "id": q.id,
                "index": i + 1,
                "content": q.content,
                "options": q.options,
                "answer": q.answer,
                "explanation": q.explanation,
                "user_answer": session.user_answers.get(str(qid))
            })

    return {
        "ai_report": session.ai_report,
        "questions": detail_questions
    }

# -----------------------------------------------------------------------------
# Dashboard APIs
# -----------------------------------------------------------------------------

@app.get("/api/dashboard/users")
def get_dashboard_users(
    skip: int = 0, 
    limit: int = 20, 
    db: Session = Depends(get_session)
):
    # Fetch sessions with pagination directly
    total = db.exec(select(func.count(ExamSession.id))).one()
    sessions = db.exec(select(ExamSession).order_by(desc(ExamSession.start_time)).offset(skip).limit(limit)).all()
    
    users_list = []
    for s in sessions:
        score = s.score or 0
        
        # Use level from ai_report if available, else fallback to score-based estimation
        level = "架构学徒"
        if s.ai_report and "evaluation" in s.ai_report:
            level = s.ai_report["evaluation"].get("level", level)
        elif s.ai_report and "title" in s.ai_report: # Fallback for old report format
            level = s.ai_report.get("title", level)
        else:
            # Score-based estimation if no report
            if score >= 45: level = "高级架构师"
            elif score >= 30: level = "准高级架构师"
            elif score > 0: level = "初级架构师"
        
        users_list.append({
            "fingerprint": s.user_fingerprint,
            "ip": s.ip_address or "Unknown",
            "location": s.location or "Unknown",
            "device": s.device_info or "Unknown",
            "start_time": s.start_time + timedelta(hours=8),
            "submit_time": s.end_time + timedelta(hours=8) if s.end_time else None,
            "score": score,
            "level": level,
            "pdf_count": s.pdf_download_count,
            "share_count": s.share_count
        })
            
    return {"total": total, "data": users_list}

@app.get("/api/dashboard/materials")
def get_material_stats(db: Session = Depends(get_session)):
    # Try cache
    cache_key = "material_stats"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Static Info
    total_q = db.exec(select(func.count(Question.id))).one()
    past_q = db.exec(select(func.count(Question.id)).where(Question.source_type.in_(["历年真题", "past_paper"]))).one()
    exercise_q = db.exec(select(func.count(Question.id)).where(Question.source_type.in_(["章节练习", "exercise"]))).one()
    ai_q = db.exec(select(func.count(Question.id)).where(Question.source_type == "ai_generated")).one()
    
    # Static info: Chapters & KPs
    chapters = db.exec(select(func.count(MajorChapter.id))).one()
    kps = db.exec(select(func.count(KnowledgePoint.id))).one()
    
    # Weight Distribution
    weight_counts = db.exec(select(KnowledgePoint.weight_level, func.count(KnowledgePoint.id)).group_by(KnowledgePoint.weight_level)).all()
    weights = [{"name": w[0] or "未标注", "value": w[1]} for w in weight_counts]

    result = {
        "static": {
            "total_questions": total_q,
            "past_questions": past_q,
            "exercise_questions": exercise_q,
            "ai_questions": ai_q,
            "chapters": chapters,
            "knowledge_points": kps,
            "weight_distribution": weights
        }
    }
    
    # Cache for 1 hour (Material stats change infrequently)
    redis_client.setex(cache_key, 3600, json.dumps(result))
    
    return result


@app.get("/api/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_session), admin: AdminUser = Depends(get_current_admin)):
    # Try cache
    cache_key = "dashboard_stats"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    sessions = db.exec(select(ExamSession)).all()
    
    # --- 1. User Stats (New Users, PDF Downloads, Shares, Trends, Distributions) ---
    unique_users = set(s.user_fingerprint for s in sessions)
    total_users = len(unique_users)
    
    pdf_downloads = sum(s.pdf_download_count for s in sessions)
    shares = sum(s.share_count for s in sessions)
    
    # User Trends (Last 7 days)
    # Use UTC+8 for China Time
    china_now = datetime.utcnow() + timedelta(hours=8)
    dates = [(china_now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    
    user_trends = {d: {"active": 0, "new": 0, "total": 0} for d in dates}
    
    # Helper set for daily active users
    daily_active_users = {d: set() for d in dates}

    # Calculate daily stats
    for s in sessions:
        # Session times are UTC in DB usually (from datetime.utcnow() on save), so convert to China Time
        s_time = s.start_time + timedelta(hours=8)
        d_str = s_time.strftime("%Y-%m-%d")
        if d_str in daily_active_users:
            daily_active_users[d_str].add(s.user_fingerprint)
            
    # Update active counts
    for d, users_set in daily_active_users.items():
        if d in user_trends:
            user_trends[d]["active"] = len(users_set)
            
    # Re-calc New Users correctly & Total Users Trend
    # 1. Get all sessions ordered by time asc
    all_sessions_asc = sorted(sessions, key=lambda x: x.start_time)
    
    # Calculate base total (users created BEFORE the window)
    window_start_str = dates[0]
    base_total = 0
    
    # Pre-scan to count users created before window
    pre_seen = set()
    for s in all_sessions_asc:
        # Convert to China Time
        s_time = s.start_time + timedelta(hours=8)
        d_str = s_time.strftime("%Y-%m-%d")
        
        if d_str < window_start_str:
            if s.user_fingerprint not in pre_seen:
                base_total += 1
                pre_seen.add(s.user_fingerprint)
    
    # Now scan properly for trends
    daily_new = {} # date_str -> count
    seen_users = set(pre_seen) # Copy
    
    for s in all_sessions_asc:
        s_time = s.start_time + timedelta(hours=8)
        d_str = s_time.strftime("%Y-%m-%d")
        
        if s.user_fingerprint not in seen_users:
            daily_new[d_str] = daily_new.get(d_str, 0) + 1
            seen_users.add(s.user_fingerprint)
            
    # Calculate Total Trend
    # 1. Calculate accumulated total up to start of window
    accumulated = 0
    for d_str, count in sorted(daily_new.items()):
        if d_str < window_start_str:
            accumulated += count
            
    # 2. Fill the window
    for d in dates:
        new_count = daily_new.get(d, 0)
        accumulated += new_count
        
        if d in user_trends:
            user_trends[d]["new"] = new_count
            user_trends[d]["total"] = accumulated
            
    user_trend_list = [{"date": d, "active": v["active"], "new": v["new"], "total": v["total"]} for d, v in user_trends.items()]

    # Distributions (Device, Score)
    device_dist = {}
    score_dist = {"0-10": 0, "10-20": 0, "20-30": 0, "30-40": 0, "40-50": 0, "50-60": 0, "60+": 0}
    
    for s in sessions:
        dev = s.device_info or "Unknown"
        device_dist[dev] = device_dist.get(dev, 0) + 1
        
        sc = s.score or 0
        if sc < 10: score_dist["0-10"] += 1
        elif sc < 20: score_dist["10-20"] += 1
        elif sc < 30: score_dist["20-30"] += 1
        elif sc < 40: score_dist["30-40"] += 1
        elif sc < 50: score_dist["40-50"] += 1
        elif sc < 60: score_dist["50-60"] += 1
        else: score_dist["60+"] += 1
        
    device_list = [{"name": k, "value": v} for k,v in device_dist.items()]
    score_list = [{"name": k, "value": v} for k,v in score_dist.items()]

    # --- 2. Knowledge Point Weight Distribution ---
    # Metrics: Core, Key, General, Cold (Count & Percentage)
    # We need to query KnowledgePoints and aggregate by weight_level
    # weight_level: "核心", "重要", "一般", "冷门" (default)
    
    kps = db.exec(select(KnowledgePoint)).all()
    weight_dist = {
        "核心": {"count": 0, "name": "核心考点"},
        "重要": {"count": 0, "name": "重要考点"},
        "一般": {"count": 0, "name": "一般考点"},
        "冷门": {"count": 0, "name": "冷门考点"}
    }
    
    total_kps = len(kps)
    for kp in kps:
        level = kp.weight_level or "冷门"
        if level not in weight_dist: level = "冷门"
        weight_dist[level]["count"] += 1
        
    # Calculate percentage
    kp_dist_list = []
    for k, v in weight_dist.items():
        percent = round((v["count"] / total_kps * 100), 1) if total_kps > 0 else 0
        kp_dist_list.append({
            "name": v["name"],
            "count": v["count"],
            "percentage": percent
        })
        
    # --- 3. Distributions (Location, Start Time, Duration) ---
    loc_dist = {}
    start_time_dist = {f"{i:02d}": 0 for i in range(24)} # 00-23 hours
    duration_dist = {"0-10m": 0, "10-30m": 0, "30-60m": 0, "60-90m": 0, "90m+": 0}
    
    # Calculate Today Start in UTC for filtering
    now_utc = datetime.utcnow()
    now_china = now_utc + timedelta(hours=8)
    today_start_china = now_china.replace(hour=0, minute=0, second=0, microsecond=0)
    # Convert back to UTC (naive) to compare with DB
    today_start_utc = today_start_china - timedelta(hours=8)

    for s in sessions:
        # Location (Keep global stats for location? Or also Today? Usually Location is global is better, but consistency...)
        # Let's keep Location and Duration as Global for now, unless user complained. 
        # User specifically complained about "Start Time Distribution".
        
        loc = s.location or "Unknown"
        loc_dist[loc] = loc_dist.get(loc, 0) + 1
        
        # Duration (Global)
        if s.end_time:
            mins = (s.end_time - s.start_time).total_seconds() / 60
            if mins < 10: duration_dist["0-10m"] += 1
            elif mins < 30: duration_dist["10-30m"] += 1
            elif mins < 60: duration_dist["30-60m"] += 1
            elif mins < 90: duration_dist["60-90m"] += 1
            else: duration_dist["90m+"] += 1

        # Start Time (Hour) - Only Today
        # Check if session is from today
        # Ensure s.start_time comparison works (both naive or both aware)
        s_start = s.start_time
        if s_start.tzinfo is not None:
             s_start = s_start.replace(tzinfo=None) # Make naive UTC for comparison with today_start_utc
        
        if s_start >= today_start_utc:
            # Convert to China Time for bucket
            s_time_cn = s_start + timedelta(hours=8)
            hour = s_time_cn.strftime("%H")
            start_time_dist[hour] += 1
            
    # Format distributions
            
    # Format distributions
    loc_list = [{"name": k, "value": v} for k,v in loc_dist.items()]
    start_time_list = [{"name": k, "value": v} for k,v in sorted(start_time_dist.items())]
    duration_list = [{"name": k, "value": v} for k,v in duration_dist.items()]

    # --- 4. AI Stats & Trends ---
    # We need to query AILog
    # Call types: "smart_paper" (assembly), "report" (report), "social_analysis" (social)
    logs = db.exec(select(AILog)).all()
    
    ai_stats = {
        "assembly": 0,
        "report": 0,
        "social": 0,
        "success": 0,
        "failure": 0,
        "avg_latency": {
            "assembly": 0.0,
            "report": 0.0,
            "social": 0.0
        }
    }
    
    # Latency Accumulators for Global Stats
    latency_sums = {"smart_paper": 0.0, "report": 0.0, "social_analysis": 0.0}
    latency_counts = {"smart_paper": 0, "report": 0, "social_analysis": 0}

    # Trends: Date -> {assembly: 0, report: 0, social: 0, success: 0, failure: 0, latency_sums: {}, latency_counts: {}}
    # Last 7 days
    china_now = datetime.utcnow() + timedelta(hours=8)
    dates = [(china_now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    
    # Initialize trend structure
    ai_trends = {}
    for d in dates:
        ai_trends[d] = {
            "assembly": 0, "report": 0, "social": 0,
            "success": 0, "failure": 0,
            "latency_sums": {"smart_paper": 0.0, "report": 0.0, "social_analysis": 0.0},
            "latency_counts": {"smart_paper": 0, "report": 0, "social_analysis": 0}
        }
    
    for log in logs:
        # 1. Global Counts
        if log.call_type == "smart_paper": ai_stats["assembly"] += 1
        elif log.call_type == "report": ai_stats["report"] += 1
        elif log.call_type == "social_analysis": ai_stats["social"] += 1
        
        if log.status == "success":
            ai_stats["success"] += 1
        else:
            ai_stats["failure"] += 1
            
        # Global Latency Accumulation
        if log.response_time and log.response_time > 0:
            ctype = log.call_type
            if ctype in latency_sums:
                latency_sums[ctype] += log.response_time
                latency_counts[ctype] += 1

        # 2. Trend Data
        # Convert timestamp to China Time
        log_time = log.timestamp + timedelta(hours=8)
        d_str = log_time.strftime("%Y-%m-%d")
        
        if d_str in ai_trends:
            # Type Counts
            if log.call_type == "smart_paper": ai_trends[d_str]["assembly"] += 1
            elif log.call_type == "report": ai_trends[d_str]["report"] += 1
            elif log.call_type == "social_analysis": ai_trends[d_str]["social"] += 1
            
            # Status Counts
            if log.status == "success":
                ai_trends[d_str]["success"] += 1
            else:
                ai_trends[d_str]["failure"] += 1
                
            # Latency Accumulation
            if log.response_time and log.response_time > 0:
                ctype = log.call_type
                if ctype in ai_trends[d_str]["latency_sums"]:
                    ai_trends[d_str]["latency_sums"][ctype] += log.response_time
                    ai_trends[d_str]["latency_counts"][ctype] += 1
            
    # Calculate Global Averages
    if latency_counts["smart_paper"] > 0:
        ai_stats["avg_latency"]["assembly"] = round(latency_sums["smart_paper"] / latency_counts["smart_paper"], 2)
    if latency_counts["report"] > 0:
        ai_stats["avg_latency"]["report"] = round(latency_sums["report"] / latency_counts["report"], 2)
    if latency_counts["social_analysis"] > 0:
        ai_stats["avg_latency"]["social"] = round(latency_sums["social_analysis"] / latency_counts["social_analysis"], 2)
            
    # Flatten Trends
    ai_trend_list = []
    for d in dates:
        data = ai_trends[d]
        
        # Calculate daily averages
        avg_lat = {"assembly": 0.0, "report": 0.0, "social": 0.0}
        
        lc = data["latency_counts"]
        ls = data["latency_sums"]
        
        if lc["smart_paper"] > 0: avg_lat["assembly"] = round(ls["smart_paper"] / lc["smart_paper"], 2)
        if lc["report"] > 0: avg_lat["report"] = round(ls["report"] / lc["report"], 2)
        if lc["social_analysis"] > 0: avg_lat["social"] = round(ls["social_analysis"] / lc["social_analysis"], 2)
        
        ai_trend_list.append({
            "date": d,
            "assembly": data["assembly"],
            "report": data["report"],
            "social": data["social"],
            "success": data["success"],
            "failure": data["failure"],
            "latency": avg_lat
        })

    result = {
        "user_stats": {
            "total_users": total_users,
            "pdf_downloads": pdf_downloads,
            "shares": shares,
            "trend": user_trend_list,
            "device_distribution": device_list,
            "score_distribution": score_list
        },
        "kp_distribution": kp_dist_list,
        "location_distribution": loc_list,
        "start_time_distribution": start_time_list,
        "duration_distribution": duration_list,
        "ai_stats": ai_stats,
        "ai_trends": ai_trend_list
    }
    
    # Cache for 5 minutes
    redis_client.setex(cache_key, 300, json.dumps(result))
    
    return result

@app.post("/api/exam/download-event")
def track_download_event(
    session_id: str = Body(..., embed=True),
    db: Session = Depends(get_session)
):
    session = db.get(ExamSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    session.pdf_download_count += 1
    db.add(session)
    db.commit()
    
    # Invalidate dashboard cache to reflect changes immediately
    try:
        redis_client.delete("dashboard_stats")
    except Exception as e:
        print(f"Redis Delete Error: {e}")
        
    return {"status": "ok"}
