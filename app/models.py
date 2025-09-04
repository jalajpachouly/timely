from sqlalchemy import Column, Integer, String, Text, Enum, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator
import enum, json

from .db import Base

class TaskStatus(str, enum.Enum):
    backlog = "backlog"
    todo = "todo"
    working = "working"
    done = "done"

# JSON-encoded list for tags (portable)
class JSONEncodedList(TypeDecorator):
    impl = Text
    cache_ok = True
    def process_bind_param(self, value, dialect):
        if value is None:
            return "[]"
        return json.dumps(list(value))
    def process_result_value(self, value, dialect):
        if not value:
            return []
        try:
            return json.loads(value)
        except Exception:
            return []

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(TaskStatus), nullable=False, default=TaskStatus.backlog)
    order = Column(Float, default=0.0)

    # NEW: tags persisted as JSON list
    tags = Column(JSONEncodedList, nullable=False, default=list)

    events = relationship("Event", back_populates="task", cascade="all, delete-orphan")

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    start = Column(DateTime, nullable=False)
    end = Column(DateTime, nullable=False)
    all_day = Column(Boolean, nullable=False, default=False)

    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    task = relationship("Task", back_populates="events")
