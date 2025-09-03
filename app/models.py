
from sqlalchemy import Column, Integer, String, Text, Enum, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
import enum

from .db import Base

class TaskStatus(str, enum.Enum):
    backlog = "backlog"
    todo = "todo"
    working = "working"
    done = "done"

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(TaskStatus), nullable=False, default=TaskStatus.backlog)
    order = Column(Float, default=0.0)

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
