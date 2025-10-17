import React, { useReducer, useEffect, useRef, useState } from "react";

type Card = { id: string; title: string; description?: string };
type Column = "todo" | "inprogress" | "done";

type State = Record<Column, Card[]>;

type Action =
  | { type: "add"; column: Column; card: Card }
  | { type: "move"; from: Column; to: Column; cardId: string }
  | { type: "remove"; column: Column; cardId: string }
  | { type: "update"; column: Column; cardId: string; changes: Partial<Card> }
  | { type: "set"; state: State };

const STORAGE_KEY = "kanban.state.v1";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add": {
      return {
        ...state,
        [action.column]: [action.card, ...state[action.column]],
      };
    }
    case "move": {
      const card = state[action.from].find((c) => c.id === action.cardId);
      if (!card) return state;
      return {
        ...state,
        [action.from]: state[action.from].filter((c) => c.id !== action.cardId),
        [action.to]: [card, ...state[action.to]],
      };
    }
    case "remove": {
      return {
        ...state,
        [action.column]: state[action.column].filter(
          (c) => c.id !== action.cardId
        ),
      };
    }
    case "update": {
      return {
        ...state,
        [action.column]: state[action.column].map((c) =>
          c.id === action.cardId ? { ...c, ...action.changes } : c
        ),
      };
    }
    case "set":
      return action.state;
    default:
      return state;
  }
}

const initialState: State = {
  todo: [],
  inprogress: [],
  done: [],
};

function usePersistedReducer(): [State, React.Dispatch<Action>] {
  const [state, dispatch] = useReducer(reducer, initialState);
  const initiated = useRef(false);

  // hydrate from localStorage once
  useEffect(() => {
    if (initiated.current) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        dispatch({ type: "set", state: parsed });
      }
    } catch (e) {
      // ignore parse errors
    }
    initiated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }, [state]);

  return [state, dispatch];
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const [state, dispatch] = usePersistedReducer();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [column, setColumn] = useState<Column>("todo");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const addCard = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    const card: Card = {
      id: uid(),
      title: title.trim(),
      description: description.trim() || undefined,
    };
    dispatch({ type: "add", column, card });
    setTitle("");
    setDescription("");
  };
  console.log("draggingId", draggingId);
  return (
    <div className="min-h-screen bg-slate-100 p-6 w-full flex flex-col">
      <header className="mx-auto mb-6 w-full">
        <h1 className="text-2xl font-semibold text-slate-800">Kanban</h1>
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
            placeholder="Description"
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
                        if (state[key].some((c) => c.id === parsed.id)) {
                          return;
                        }

                        dispatch({
                          type: "move",
                          from: parsed.from,
                          to: key,
                          cardId: parsed.id,
                        });
                      }
                    } catch (err) {
                      // ignore
                    }
                  }}
                  className="bg-white rounded shadow p-4 h-screen w-[360px]"
                >
                  <h2 className="font-medium mb-4 flex items-center justify-between text-slate-900">
                    <span className="text-lg">{title}</span>
                    <span className="text-sm text-slate-500">
                      {state[key].length}
                    </span>
                  </h2>
                  <ul className="space-y-2">
                    {state[key].map((card) => (
                      <li
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(card.id); // TODO: clunky
                          e.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({ id: card.id, from: key })
                          );
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        className={`border rounded p-3 bg-slate-200 w-full h-[160px] flex flex-col cursor-grab ${
                          !!draggingId &&
                          draggingId === card.id &&
                          "cursor-grabbing"
                        }`}
                      >
                        <div className="flex flex-col gap-2 h-full justify-between">
                          <div className="text-slate-900 flex flex-col">
                            {editingId === card.id ? (
                              <input
                                autoFocus
                                className="font-semibold border-b px-1 py-0.5 bg-transparent"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => {
                                  const v = editValue.trim();
                                  if (v && v !== card.title) {
                                    dispatch({
                                      type: "update",
                                      column: key,
                                      cardId: card.id,
                                      changes: { title: v },
                                    });
                                  }
                                  setEditingId(null);
                                  setEditValue("");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const v = editValue.trim();
                                    if (v && v !== card.title) {
                                      dispatch({
                                        type: "update",
                                        column: key,
                                        cardId: card.id,
                                        changes: { title: v },
                                      });
                                    }
                                    setEditingId(null);
                                    setEditValue("");
                                  } else if (e.key === "Escape") {
                                    setEditingId(null);
                                    setEditValue("");
                                  }
                                }}
                              />
                            ) : (
                              <div
                                className="font-semibold"
                                onDoubleClick={() => {
                                  setEditingId(card.id);
                                  setEditValue(card.title);
                                }}
                              >
                                {card.title}
                              </div>
                            )}
                            {card.description && (
                              <div className="text-sm">{card.description}</div>
                            )}
                          </div>
                          <div className="flex gap-1 justify-between">
                            <button
                              className="text-sm px-2 py-1 border rounded text-red-600"
                              onClick={() =>
                                dispatch({
                                  type: "remove",
                                  column: key,
                                  cardId: card.id,
                                })
                              }
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </li>
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
