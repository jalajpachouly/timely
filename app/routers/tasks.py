from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Task as TaskModel, TaskStatus
from ..schemas import TaskCreate, TaskUpdate, TaskOut

router = APIRouter()

@router.get("", response_model=List[TaskOut])
def list_tasks(
    status: Optional[TaskStatus] = Query(None),
    tags: Optional[str] = Query(None, description="Comma-separated; match ANY tag"),
    db: Session = Depends(get_db),
):
    q = db.query(TaskModel)
    if status:
        q = q.filter(TaskModel.status == status)
    tasks = q.order_by(TaskModel.status, TaskModel.order).all()

    # Optional ANY-tag filter server-side
    if tags:
        wanted = {t.strip() for t in tags.split(",") if t.strip()}
        if wanted:
            tasks = [t for t in tasks if set(t.tags or []) & wanted]
    return tasks

@router.post("", response_model=TaskOut)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    t = TaskModel(
        title=payload.title,
        description=payload.description,
        status=TaskStatus(payload.status),
        order=payload.order,
        tags=payload.tags or [],  # NEW
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    t = db.query(TaskModel).get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    if payload.title is not None:
        t.title = payload.title
    if payload.description is not None:
        t.description = payload.description
    if payload.status is not None:
        t.status = TaskStatus(payload.status)
    if payload.order is not None:
        t.order = payload.order
    if payload.tags is not None:           # NEW
        t.tags = list(payload.tags)
    db.commit()
    db.refresh(t)
    return t

@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(TaskModel).get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return t

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(TaskModel).get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(t)
    db.commit()
    return {"ok": True}
