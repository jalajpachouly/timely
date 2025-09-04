// ==== Timely app.js — Kanban + Calendar ==================================

const API = { tasks: "/api/tasks", events: "/api/events" };
const DISPLAY_STATUSES = ["todo","working","done","backlog"];
const MIN_COL_WIDTH = 12; // %

/* Tag state */
const availableTags = new Set();   // from tasks
const selectedTags  = new Set();   // UI chips -> filter
const tasksById     = {};          // id -> task

/* ---------------- Utilities ---------------- */
async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
function parseTags(str) {
  return (str || "").split(",").map(s => s.trim()).filter(Boolean);
}
function checkboxChip(tag, checked=false) {
  const label = document.createElement("label");
  label.className = "tag-chip text-xs";
  label.innerHTML = `<input type="checkbox" data-tag="${tag}" ${checked ? "checked":""}> <span>${tag}</span>`;
  return label;
}
function rebuildTagFilterBar() {
  const bar = document.getElementById("tagFilterBar");
  if (!bar) return;
  bar.innerHTML = "";
  [...availableTags].sort().forEach(tag => {
    const chip = checkboxChip(tag, selectedTags.has(tag));
    chip.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) selectedTags.add(tag); else selectedTags.delete(tag);
      applyTagFilters();
    });
    bar.appendChild(chip);
  });
}
document.getElementById("clearTagFilter")?.addEventListener("click", () => {
  selectedTags.clear();
  rebuildTagFilterBar();
  applyTagFilters();
});

function todayISO() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function toLocalDateTime(dateStr, timeStr) {
  if (!timeStr) return null;
  const d = dateStr || todayISO();
  return `${d}T${timeStr}`;
}
function plus30min(localDT) {
  const base = new Date(localDT);
  const end  = new Date(base.getTime() + 30*60000);
  const y = end.getFullYear(), m = String(end.getMonth()+1).padStart(2,"0"), d = String(end.getDate()).padStart(2,"0");
  const hh = String(end.getHours()).padStart(2,"0"), mm = String(end.getMinutes()).padStart(2,"0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}
function isoToLocalParts(iso) {
  if (!iso) return { date:"", time:"" };
  const [date, t=""] = iso.split("T");
  const [hh="", mm=""] = t.split(":");
  return { date, time: `${hh}:${mm}` };
}
async function getEventForTask(taskId) {
  try {
    const res = await fetch(`${API.events}?task_id=${taskId}`);
    if (!res.ok) return null;
    const arr = await res.json();
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  } catch { return null; }
}

/* 30-min time options */
function fillTimeSelect(select) {
  if (!select || select.dataset.filled === "1") return;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Time (30 min)";
  select.appendChild(placeholder);
  for (let h = 0; h < 24; h++) {
    for (let m of [0,30]) {
      const v = `${String(h).padStart(2,"0")}:${m === 0 ? "00" : "30"}`;
      const opt = document.createElement("option");
      opt.value = opt.textContent = v;
      select.appendChild(opt);
    }
  }
  select.dataset.filled = "1";
}

/* ---------------- Task Card ---------------- */
function taskNode(task) {
  const el = document.createElement("div");
  el.className = "task-card p-2 bg-white rounded-xl shadow flex items-start gap-2";
  el.dataset.id = task.id;
  el.dataset.title = task.title;

  const tags = Array.isArray(task.tags) ? task.tags : [];
  const tagBadges = tags.map(t => `<span class="text-[10px] px-1 py-0.5 rounded bg-gray-100 border">${t}</span>`).join(" ");

  el.innerHTML = `
    <span class="grab-handle px-1 text-sm select-none" title="Drag within Kanban">⋮⋮</span>
    <div class="flex-1 min-w-0">
      <div class="font-medium text-sm whitespace-normal break-words">${task.title}</div>
      ${task.description ? `<div class="text-xs opacity-70 mt-1 whitespace-normal break-words">${task.description}</div>` : ""}
      ${tags.length ? `<div class="mt-1 flex flex-wrap gap-1">${tagBadges}</div>` : ""}
    </div>
    <div class="flex items-center gap-1 shrink-0">
      <span class="cal-handle btn-xs rounded bg-gray-100 shadow" title="Drag to calendar">📅</span>
      <button class="btn-xs rounded bg-gray-100 shadow" data-action="edit" title="Edit">✎</button>
      <button class="btn-xs rounded bg-gray-100 shadow" data-action="delete" title="Delete">🗑</button>
    </div>
  `;

  el.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    try {
      const evs = await jsonFetch(`${API.events}?task_id=${task.id}`);
      if (Array.isArray(evs)) await Promise.all(evs.map(ev => jsonFetch(`${API.events}/${ev.id}`, { method:"DELETE" })));
    } catch {}
    await jsonFetch(`${API.tasks}/${task.id}`, { method:"DELETE" });
    el.remove();
    delete tasksById[task.id];
    applyTagFilters();
    calendar?.refetchEvents?.();
  });

  el.querySelector('[data-action="edit"]').addEventListener("click", () => openEditModal(task, { fromCalendar:false }));

  return el;
}

/* ---------------- Kanban ---------------- */
async function loadTasks() {
  Object.keys(tasksById).forEach(k => delete tasksById[k]);
  availableTags.clear();

  for (const status of DISPLAY_STATUSES) {
    const col = document.getElementById(status);
    if (!col) continue;
    col.innerHTML = "";
    const data = await jsonFetch(`${API.tasks}?status=${status}`);
    data.forEach(t => {
      t.tags = Array.isArray(t.tags) ? t.tags : [];
      tasksById[t.id] = t;
      t.tags.forEach(tag => availableTags.add(tag));
      col.appendChild(taskNode(t));
    });
  }
  rebuildTagFilterBar();
  makeColumnsSortable();
  enableCalendarExternalDrag();
  applyTagFilters();
}

function makeColumnsSortable() {
  DISPLAY_STATUSES.forEach(listId => {
    const el = document.getElementById(listId);
    if (!el) return;
    new Sortable(el, {
      group: "tasks",
      animation: 150,
      ghostClass: "drop-highlight",
      handle: ".grab-handle",
      onEnd: async (evt) => {
        const id = evt.item.dataset.id;
        const newStatus = evt.to.id;
        const order = evt.newIndex + 1;
        await jsonFetch(`${API.tasks}/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status: newStatus, order })
        });
        if (tasksById[id]) tasksById[id].status = newStatus;
        applyTagFilters();
      }
    });
  });
}

function enableCalendarExternalDrag() {
  const Draggable = window.FullCalendar && window.FullCalendar.Draggable;
  if (!Draggable) { console.warn("FullCalendar.Draggable missing"); return; }
  DISPLAY_STATUSES.forEach(listId => {
    const container = document.getElementById(listId);
    if (!container || container.dataset.draggableBound === "1") return;
    new Draggable(container, {
      itemSelector: ".cal-handle",
      eventData: (handleEl) => {
        const card = handleEl.closest(".task-card");
        return {
          title: card?.dataset.title || "Task",
          duration: "00:30",
          extendedProps: { taskId: Number(card?.dataset.id || 0) }
        };
      }
    });
    container.dataset.draggableBound = "1";
  });
}

/* ---------------- Tag filtering ---------------- */
function taskMatchesFilter(task) {
  if (selectedTags.size === 0) return true;
  const tgs = task.tags || [];
  return tgs.some(t => selectedTags.has(t));
}
function applyTagFilters() {
  // Kanban
  document.querySelectorAll(".task-card").forEach(card => {
    const t = tasksById[Number(card.dataset.id)];
    const ok = t ? taskMatchesFilter(t) : (selectedTags.size === 0);
    card.style.display = ok ? "" : "none";
  });
  // Calendar
  calendar?.refetchEvents?.();
}

/* ---------------- Inline Adders ---------------- */
function bindInlineAdders() {
  document.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const status = btn.getAttribute("data-add");
      const adder  = document.querySelector(`[data-adder="${status}"]`);
      adder?.classList.remove("hidden");
      const titleInput = adder?.querySelector('input[name="title"]');
      const timeSelect = adder?.querySelector('select[name="time"]');
      fillTimeSelect(timeSelect);
      titleInput?.focus();
    });
  });

  document.querySelectorAll("[data-adder]").forEach(adder => {
    const form   = adder.querySelector("form");
    const cancel = adder.querySelector("[data-cancel]");
    const status = adder.getAttribute("data-adder");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd    = new FormData(form);
      const title = (fd.get("title") || "").toString().trim();
      const desc  = (fd.get("desc")  || "").toString().trim();
      const date  = (fd.get("date")  || "").toString();
      const time  = (fd.get("time")  || "").toString();
      const tags  = parseTags((fd.get("tags") || "").toString());

      if (!title) return;

      const statusToSave = time ? status : "backlog";

      const task = await jsonFetch(API.tasks, {
        method: "POST",
        body: JSON.stringify({ title, description: desc, status: statusToSave, order: 1, tags })
      });

      const startLocal = toLocalDateTime(date, time);
      if (startLocal) {
        const endLocal = plus30min(startLocal);
        await jsonFetch(API.events, {
          method: "POST",
          body: JSON.stringify({ title, start: startLocal, end: endLocal, all_day: false, task_id: task.id })
        });
        calendar?.refetchEvents?.();
      }

      form.reset();
      adder.classList.add("hidden");
      await loadTasks();
    });

    cancel.addEventListener("click", () => {
      form.reset();
      adder.classList.add("hidden");
    });
  });

  document.getElementById("newTaskBtn")?.addEventListener("click", async () => {
    const title = prompt("Task title?");
    if (!title) return;
    await jsonFetch(API.tasks, { method: "POST", body: JSON.stringify({ title, description: "", status: "backlog", order: 1, tags: [] }) });
    await loadTasks();
  });
}

/* ---------------- Edit Modal ---------------- */
let editTaskId = null;
let calendarContext = { fromCalendar:false, eventId:null, eventStart:null };

async function openEditModal(task, ctx = { fromCalendar:false, eventId:null, eventStart:null }) {
  editTaskId = task.id;
  calendarContext = ctx;

  const bg    = document.getElementById("modalBg");
  const modal = document.getElementById("editModal");
  const form  = document.getElementById("editForm");
  const removeBtn = document.getElementById("removeFromCalendarBtn");
  const deleteBtn = document.getElementById("deleteTaskBtn");

  if (!bg || !modal || !form) return;

  fillTimeSelect(form.time);

  form.title.value = task.title || "";
  form.desc.value  = task.description || "";
  form.tags.value  = (Array.isArray(task.tags) ? task.tags : []).join(", ");

  let prefillStart = ctx.fromCalendar && ctx.eventStart ? ctx.eventStart : (await getEventForTask(task.id))?.start || null;
  if (prefillStart) {
    const { date, time } = isoToLocalParts(prefillStart);
    form.date.value = date || "";
    form.time.value = time || "";
  } else {
    form.date.value = "";
    form.time.value = "";
  }

  if (ctx.fromCalendar && ctx.eventId) {
    removeBtn?.classList.remove("hidden");
    removeBtn.onclick = async () => {
      await jsonFetch(`${API.events}/${ctx.eventId}`, { method: "DELETE" });
      await jsonFetch(`${API.tasks}/${task.id}`, { method: "PUT", body: JSON.stringify({ status: "backlog" }) });
      calendar?.refetchEvents?.();
      await loadTasks();
      form.time.value = "";
    };
  } else {
    removeBtn?.classList.add("hidden");
    removeBtn && (removeBtn.onclick = null);
  }

  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      try {
        const evs = await jsonFetch(`${API.events}?task_id=${task.id}`);
        if (Array.isArray(evs)) await Promise.all(evs.map(ev => jsonFetch(`${API.events}/${ev.id}`, { method:"DELETE" })));
      } catch {}
      await jsonFetch(`${API.tasks}/${task.id}`, { method:"DELETE" });
      calendar?.refetchEvents?.();
      closeEditModal();
      await loadTasks();
    };
  }

  bg.style.display = "block";
  modal.style.display = "flex";
  form.title.focus();
}
function closeEditModal() {
  editTaskId = null;
  calendarContext = { fromCalendar:false, eventId:null, eventStart:null };
  const bg    = document.getElementById("modalBg");
  const modal = document.getElementById("editModal");
  const form  = document.getElementById("editForm");
  if (!bg || !modal || !form) return;
  form.reset();
  bg.style.display = "none";
  modal.style.display = "none";
}
document.getElementById("editCancel")?.addEventListener("click", closeEditModal);

document.getElementById("editForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!editTaskId) return;

  const fd    = new FormData(form);
  const title = (fd.get("title") || "").toString().trim();
  const desc  = (fd.get("desc")  || "").toString().trim();
  const date  = (fd.get("date")  || "").toString();
  const time  = (fd.get("time")  || "").toString();
  const tags  = parseTags((fd.get("tags") || "").toString());

  if (!title) return;

  await jsonFetch(`${API.tasks}/${editTaskId}`, {
    method: "PUT",
    body: JSON.stringify({ title, description: desc, tags })
  });
  if (tasksById[editTaskId]) tasksById[editTaskId].tags = tags;

  const startLocal = toLocalDateTime(date, time);

  if (startLocal) {
    const endLocal = plus30min(startLocal);
    if (calendarContext.fromCalendar && calendarContext.eventId) {
      await jsonFetch(`${API.events}/${calendarContext.eventId}`, {
        method: "PUT",
        body: JSON.stringify({ start: startLocal, end: endLocal })
      });
    } else {
      const existing = await getEventForTask(editTaskId);
      if (existing) {
        await jsonFetch(`${API.events}/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify({ start: startLocal, end: endLocal })
        });
      } else {
        await jsonFetch(API.events, {
          method: "POST",
          body: JSON.stringify({ title, start: startLocal, end: endLocal, all_day: false, task_id: editTaskId })
        });
      }
    }
    calendar?.refetchEvents?.();
  } else {
    try {
      const evs = await jsonFetch(`${API.events}?task_id=${editTaskId}`);
      if (Array.isArray(evs)) await Promise.all(evs.map(ev => jsonFetch(`${API.events}/${ev.id}`, { method:"DELETE" })));
    } catch {}
    await jsonFetch(`${API.tasks}/${editTaskId}`, { method: "PUT", body: JSON.stringify({ status: "backlog" }) });
    calendar?.refetchEvents?.();
  }

  closeEditModal();
  await loadTasks();
});

/* ---------------- Calendar ---------------- */
let calendar;

function setupCalendar() {
  const el = document.getElementById("calendar");
  if (!el) return;

  calendar = new FullCalendar.Calendar(el, {
    timeZone: "local",
    initialView: "timeGridWeek",
    height: "100%",
    expandRows: true,
    headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" },
    slotDuration: "00:30:00",
    snapDuration: "00:30:00",
    eventDuration: "00:30:00",
    scrollTime: "08:00:00",
    editable: true,
    droppable: true,
    nowIndicator: true,
    selectable: true,

    eventSources: [{
      events: async (info, success, failure) => {
        try {
          const q = new URLSearchParams({ start: info.startStr, end: info.endStr });
          const data = await jsonFetch(`${API.events}?${q.toString()}`);
          const filtered = data.filter(e => {
            if (selectedTags.size === 0) return true;
            if (!e.task_id) return false;
            const t = tasksById[e.task_id];
            return t ? taskMatchesFilter(t) : false;
          }).map(e => ({
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            allDay: e.allDay,
            extendedProps: { taskId: e.task_id || null }
          }));
          success(filtered);
        } catch (err) { failure(err); }
      }
    }],

    select: async (sel) => {
      const title = prompt("Event title?");
      if (!title) { calendar.unselect(); return; }
      await jsonFetch(API.events, { method: "POST", body: JSON.stringify({ title, start: sel.startStr, end: sel.endStr, all_day: !!sel.allDay }) });
      calendar.refetchEvents();
      calendar.unselect();
    },

    eventReceive: async (info) => {
      try {
        const s = info.event.startStr;
        const e = info.event.endStr || plus30min(s);
        await jsonFetch(API.events, {
          method: "POST",
          body: JSON.stringify({
            title: info.event.title,
            start: s, end: e,
            all_day: !!info.event.allDay,
            task_id: info.event.extendedProps.taskId || null
          })
        });
        info.event.remove();
        calendar.refetchEvents();
      } catch (err) { console.error(err); info.revert(); }
    },

    eventDrop: async (info) => {
      try {
        const s = info.event.startStr;
        const e = info.event.endStr || plus30min(s);
        await jsonFetch(`${API.events}/${info.event.id}`, { method: "PUT", body: JSON.stringify({ start: s, end: e }) });
      } catch (err) { console.error(err); info.revert(); }
    },

    eventResize: async (info) => {
      try {
        await jsonFetch(`${API.events}/${info.event.id}`, { method: "PUT", body: JSON.stringify({ start: info.event.startStr, end: info.event.endStr }) });
      } catch (err) { console.error(err); info.revert(); }
    },

    eventClick: async (info) => {
      const taskId = info.event.extendedProps.taskId;
      if (!taskId) {
        await jsonFetch(`${API.events}/${info.event.id}`, { method: "DELETE" });
        calendar.refetchEvents();
        return;
      }
      const task = await jsonFetch(`${API.tasks}/${taskId}`);
      openEditModal(task, { fromCalendar:true, eventId: info.event.id, eventStart: info.event.startStr });
    },
  });

  calendar.render();
}

/* ---------------- Splitters ---------------- */
(function bindOuterSplitter(){
  const split = document.getElementById("split");
  const left  = document.getElementById("kanbanPane");
  const right = document.getElementById("calendarPane");
  const gut   = document.getElementById("gutter");
  if (!split || !left || !right || !gut) return;

  let dragging = false;
  gut.addEventListener("mousedown", () => { dragging = true; });
  window.addEventListener("mouseup", () => { dragging = false; });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rect = split.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 160), rect.width - 160);
    const pct = (x / rect.width) * 100;
    left.style.width = `${pct}%`;
    right.style.width = `${100 - pct}%`;
    calendar?.updateSize?.();
  });
})();

function initKanbanSplitters() {
  const board = document.getElementById("kanbanBoard");
  if (!board) return;

  let widths = JSON.parse(localStorage.getItem("kanbanWidths") || "null");
  if (!Array.isArray(widths) || widths.length !== 4) widths = [25,25,25,25];

  function applyWidths() {
    DISPLAY_STATUSES.forEach((status, i) => {
      const wrap = document.querySelector(`.kanban-colwrap[data-colwrap="${status}"]`);
      if (wrap) wrap.style.width = `${widths[i]}%`;
    });
  }
  applyWidths();

  let dragging = false;
  let idx = -1;
  let startX = 0, startLeft = 0, startRight = 0;

  function onMouseMove(e) {
    if (!dragging) return;
    const rect = board.getBoundingClientRect();
    const deltaPx = e.clientX - startX;
    const pct = (deltaPx / rect.width) * 100;

    let newLeft = Math.max(MIN_COL_WIDTH, Math.min(100 - MIN_COL_WIDTH, startLeft + pct));
    let newRight = Math.max(MIN_COL_WIDTH, Math.min(100 - MIN_COL_WIDTH, startRight - pct));

    const others = widths.reduce((a,c,i) => i!==idx && i!==idx+1 ? a+c : a, 0);
    const cap = 100 - others;
    if (newLeft + newRight > cap) {
      const overflow = newLeft + newRight - cap;
      if (pct > 0) newRight -= overflow; else newLeft -= overflow;
    }

    widths[idx] = newLeft;
    widths[idx+1] = newRight;
    applyWidths();
    calendar?.updateSize?.();
  }
  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    localStorage.setItem("kanbanWidths", JSON.stringify(widths));
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  document.querySelectorAll(".kanban-gutter").forEach(g => {
    g.addEventListener("mousedown", (e) => {
      const i = Number(g.dataset.gutter);
      if (Number.isNaN(i)) return;
      dragging = true; idx = i; startX = e.clientX;
      startLeft  = widths[i];
      startRight = widths[i+1];
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  });
}

/* ---------------- Init ---------------- */
setupCalendar();
bindInlineAdders();
loadTasks();
initKanbanSplitters();
console.log("Timely ready: tag persistence + tag filtering");
