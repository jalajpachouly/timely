
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Event as EventModel
from ..schemas import EventCreate, EventUpdate, EventOut

router = APIRouter()

@router.get("", response_model=List[EventOut])
def list_events(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    task_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(EventModel)
    if start:
        q = q.filter(EventModel.end >= start)
    if end:
        q = q.filter(EventModel.start <= end)
    if task_id is not None:
        q = q.filter(EventModel.task_id == task_id)
    events = q.all()
    return [EventOut(
        id=e.id, title=e.title, start=e.start, end=e.end,
        allDay=e.all_day, task_id=e.task_id
    ) for e in events]


@router.post("", response_model=EventOut)
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    e = EventModel(
        title=payload.title,
        start=payload.start,
        end=payload.end,
        all_day=payload.all_day,
        task_id=payload.task_id
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return EventOut(
        id=e.id, title=e.title, start=e.start, end=e.end, allDay=e.all_day, task_id=e.task_id
    )

@router.put("/{event_id}", response_model=EventOut)
def update_event(event_id: int, payload: EventUpdate, db: Session = Depends(get_db)):
    e = db.query(EventModel).get(event_id)
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    if payload.title is not None:
        e.title = payload.title
    if payload.start is not None:
        e.start = payload.start
    if payload.end is not None:
        e.end = payload.end
    if payload.all_day is not None:
        e.all_day = payload.all_day
    if payload.task_id is not None:
        e.task_id = payload.task_id
    db.commit()
    db.refresh(e)
    return EventOut(
        id=e.id, title=e.title, start=e.start, end=e.end, allDay=e.all_day, task_id=e.task_id
    )

@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    e = db.query(EventModel).get(event_id)
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(e)
    db.commit()
    return {"ok": True}
