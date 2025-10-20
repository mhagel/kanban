import React, { useState, useEffect, useRef } from "react";
import { useKanban } from "./context/KanbanContext";
import type { Card, Column } from "./context/KanbanContext";
import DraggableCard from "./components/DraggableCard";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const { state, recordAction, activities } = useKanban();
  const [showActivity, setShowActivity] = useState(false);
  const activityRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [column, setColumn] = useState<Column>("todo");
  const [query, setQuery] = useState<string>("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [dragOverIndexByColumn, setDragOverIndexByColumn] = useState<
    Record<Column, number | null>
  >({ todo: null, inprogress: null, done: null });
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const addCard = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    const card: Card = {
      id: uid(),
      title: title.trim(),
      description: description.trim() || undefined,
    };
    // use recordAction so the activity is recorded
    recordAction({ type: "add", column, card });
    setTitle("");
    setDescription("");
    // focus the newly created card. Defer to next tick so the originating
    // click (submit) doesn't immediately bubble to the document click
    // listener and clear the focus.
    setTimeout(() => setFocusedId(card.id), 0);
  };

  // clear focusedId when clicking anywhere outside the focused card
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!focusedId) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // if the click happened inside the focused card, keep focus
      if (target.closest && target.closest(`[data-card-id="${focusedId}"]`)) {
        return;
      }
      setFocusedId(null);
    }

    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [focusedId]);

  // close activity popup when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!showActivity) return;
      const target = e.target as Node | null;
      if (!activityRef.current) return;
      if (target && activityRef.current.contains(target)) return;
      setShowActivity(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [showActivity]);

  function timeAgo(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 w-full flex flex-col">
      <header className="mx-auto mb-6 w-full flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">
          Kanban by Mark Hagelberg
        </h1>
        <div className="flex items-center gap-3">
          <div className="w-64">
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Search cards..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div ref={activityRef} className="relative">
            <button
              className="px-3 py-2 border rounded bg-white text-slate-700"
              onClick={() => setShowActivity((s) => !s)}
            >
              Activity
            </button>

            {showActivity && (
              <div className="absolute right-0 mt-2 w-72 bg-white shadow-lg rounded p-3 z-50">
                <div className="font-medium mb-2">Recent activity</div>
                <ul className="text-sm text-slate-700 space-y-2 max-h-56 overflow-auto">
                  {(activities.length === 0 && (
                    <li className="text-slate-500">No recent activity</li>
                  )) ||
                    activities
                      // sort by timestamp descending
                      .sort((a, b) => b.ts - a.ts)
                      .slice()
                      .map((a) => (
                        <li key={a.ts} className="flex justify-between">
                          <span>{a.text}</span>
                          <span className="text-xs text-slate-400 ml-2">
                            {timeAgo(a.ts)}
                          </span>
                        </li>
                      ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-col mx-auto w-full">
        <form onSubmit={addCard} className="mb-4 flex gap-2 text-slate-800">
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="New card title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select
            className="rounded border px-2"
            value={column}
            onChange={(e) => setColumn(e.target.value as Column)}
          >
            <option value="todo">Todo</option>
            <option value="inprogress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            type="submit"
          >
            Add
          </button>
        </form>

        {/* columns */}
        {(() => {
          const columns: { key: Column; title: string }[] = [
            { key: "todo", title: "To Do" },
            { key: "inprogress", title: "In Progress" },
            { key: "done", title: "Done" },
          ];

          return (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {columns.map(({ key, title }) => (
                <div
                  key={key}
                  // drop target
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const payload = e.dataTransfer.getData("text/plain");
                    setDraggingId(null);
                    try {
                      const parsed = JSON.parse(payload) as {
                        id: string;
                        from: Column;
                      };
                      if (parsed && parsed.id) {
                        // check if id is already in column
                        if (state[key].some((c: Card) => c.id === parsed.id)) {
                          return;
                        }

                        recordAction({
                          type: "move",
                          from: parsed.from,
                          to: key,
                          cardId: parsed.id,
                          index: state[key].length,
                        });
                      }
                    } catch (err) {
                      // ignore
                    }
                  }}
                  className="bg-white rounded shadow p-4 h-screen w-[360px]"
                >
                  <h2 className="font-medium mb-6 flex items-center justify-between text-slate-900">
                    <span className="text-lg">{title}</span>
                    <span className="text-sm text-slate-500">
                      {
                        // show filtered count when a query is active
                        ((): number => {
                          if (!query.trim()) return state[key].length;
                          const q = query.toLowerCase();
                          return state[key].filter((c: Card) => {
                            return (
                              c.title.toLowerCase().includes(q) ||
                              (c.description || "").toLowerCase().includes(q)
                            );
                          }).length;
                        })()
                      }
                    </span>
                  </h2>
                  <ul className="space-y-2">
                    {state[key]
                      .filter((c: Card) => {
                        if (!query.trim()) return true;
                        const q = query.toLowerCase();
                        return (
                          c.title.toLowerCase().includes(q) ||
                          (c.description || "").toLowerCase().includes(q)
                        );
                      })
                      .map((card: Card, index: number) => (
                        <DraggableCard
                          key={card.id}
                          card={card}
                          column={key}
                          index={index}
                          draggingId={draggingId}
                          setDraggingId={setDraggingId}
                          editingId={editingId}
                          setEditingId={setEditingId}
                          editValue={editValue}
                          setEditValue={setEditValue}
                          dragOverIndexByColumn={dragOverIndexByColumn}
                          setDragOverIndexByColumn={setDragOverIndexByColumn}
                          focusedId={focusedId}
                          setFocusedId={setFocusedId}
                        />
                      ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })()}
      </main>
    </div>
  );
}
