from typing import Optional, List, Dict, Any
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, JSON, Text
from datetime import datetime
import uuid

# -----------------------------------------------------------------------------
# Data Management Models
# -----------------------------------------------------------------------------

class KnowledgePoint(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Hierarchy
    # parent_id is used for internal hierarchy if needed, but we now link to MajorChapter
    parent_id: Optional[int] = Field(default=None, foreign_key="knowledgepoint.id")
    major_chapter_id: Optional[int] = Field(default=None, foreign_key="majorchapter.id")
    
    children: List["KnowledgePoint"] = Relationship(back_populates="parent", sa_relationship_kwargs={"remote_side": "KnowledgePoint.id"})
    parent: Optional["KnowledgePoint"] = Relationship(back_populates="children")
    
    # Content
    name: str = Field(index=True)
    chapter: str = Field(index=True, default="") # Keep for backward compatibility/search, e.g. "1. Computer System"
    k_type: str = Field(default="point") # "structure" (Chapter/Section) or "point" (Knowledge Point)
    
    # From Weight Table
    weight_level: str = Field(default="冷门") # 核心, 重要, 一般, 冷门
    weight_score: int = Field(default=1)
    frequency: int = Field(default=0)
    analysis: Optional[str] = Field(default=None, sa_column=Column(Text))
    
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    
    questions: List["Question"] = Relationship(back_populates="knowledge_point")

class MajorChapter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    order: int = Field(default=0)


class Question(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Content
    content: str = Field(sa_column=Column(Text)) # Question text
    options: List[Any] = Field(sa_column=Column(JSON)) # ["A. ...", "B. ..."] OR [["A. ..", "B. .."], ["A. ..", "B. .."]] for multi-blank
    answer: str # "A", "B", "C", "D" OR "A,B" for multi-blank
    explanation: str = Field(sa_column=Column(Text))
    
    # Metadata
    source_type: str = Field(index=True) # "past_paper", "exercise", "ai_generated"
    source_detail: Optional[str] = None # e.g. "2023_Nov_SystemArch", "Chapter1_Exercise"
    
    # Relations
    knowledge_point_id: Optional[int] = Field(default=None, foreign_key="knowledgepoint.id")
    knowledge_point: Optional[KnowledgePoint] = Relationship(back_populates="questions")

# -----------------------------------------------------------------------------
# User & Session Models
# -----------------------------------------------------------------------------

class ExamSession(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_fingerprint: str = Field(index=True)
    
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    
    # List of Question IDs generated for this session
    question_ids: List[int] = Field(default=[], sa_column=Column(JSON))
    
    # User's answers: { "question_id": "A", ... }
    user_answers: Dict[str, str] = Field(default={}, sa_column=Column(JSON))
    
    # User Info
    ip_address: Optional[str] = None
    location: Optional[str] = None
    device_info: Optional[str] = None # e.g. "PC", "Android", "iOS"
    
    is_submitted: bool = Field(default=False)
    score: Optional[int] = None
    
    # Full AI Report
    ai_report: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    
    # Stats
    pdf_download_count: int = Field(default=0)
    share_count: int = Field(default=0)

class AILog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    call_type: str = Field(index=True) # "smart_paper", "report", "social_analysis"
    status: str = Field(index=True) # "success", "failure"
    response_time: float # in seconds
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    error_message: Optional[str] = None

class AIConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    config_key: str = Field(unique=True) # e.g. "gemini_api_key", "prompt_report"
    value: str = Field(sa_column=Column(Text))
