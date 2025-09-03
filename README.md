
# Timely — Python (FastAPI) + Kanban + Calendar (FullCalendar)

A split-view productivity app:
- Left half: Backlog, Todo, Working, Done (drag-and-drop between lists)
- Right half: Calendar with Month/Week/Day views, 30-minute slots, drag tasks into time slots to create events.

## Features
- Full drag & drop across Kanban columns (SortableJS)
- Drag tasks into calendar to create scheduled events (FullCalendar `Draggable`)
- Day/week/month views with 30-minute slot granularity
- Edit events by drag/resize; click to delete
- Strict modular Python backend (routers, services-ready, models, schemas)
- SQLite persistence (SQLAlchemy)

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000 in your browser.

## Project Layout
```
timely/
  app/
    __init__.py
    main.py
    db.py
    models.py
    schemas.py
    routers/
      tasks.py
      events.py
    static/
      index.html
      app.js
  requirements.txt
  README.md
```

## Notes
- This starter keeps services thin; add business logic in `app/services/*` if needed.
- `order` is a simple index; enhance with fractional ordering or batch updates for large boards.
- Security/auth not included; add auth if deploying.
