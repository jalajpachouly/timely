
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum

class TaskStatus(str, Enum):
    backlog = "backlog"
    todo = "todo"
    working = "working"
    done = "done"

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.backlog
    order: float = 0.0

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    order: Optional[float] = None

class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: TaskStatus
    order: float
    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    title: str
    start: datetime
    end: datetime
    all_day: bool = False
    task_id: Optional[int] = None

class EventUpdate(BaseModel):
    title: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    all_day: Optional[bool] = None
    task_id: Optional[int] = None

class EventOut(BaseModel):
    id: int
    title: str
    start: datetime
    end: datetime
    all_day: bool = Field(alias="allDay")
    task_id: Optional[int]
    class Config:
        from_attributes = True
        populate_by_name = True
