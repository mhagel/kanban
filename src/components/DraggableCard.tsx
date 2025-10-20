import type { Card as CardType, Column } from "../context/KanbanContext";
import { useKanban } from "../context/KanbanContext";
import React from "react";

type Props = {
  card: CardType;
  column: Column;
  index: number;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editValue: string;
  setEditValue: (v: string) => void;
  dragOverIndexByColumn: Record<Column, number | null>;
  setDragOverIndexByColumn: React.Dispatch<
    React.SetStateAction<Record<Column, number | null>>
  >;
  focusedId?: string | null;
  setFocusedId?: (id: string | null) => void;
};

export default function DraggableCard({
  card,
  column,
  index,
  draggingId,
  setDraggingId,
  editingId,
  setEditingId,
  editValue,
  setEditValue,
  dragOverIndexByColumn,
  setDragOverIndexByColumn,
  focusedId,
  setFocusedId,
}: Props) {
  const { recordAction } = useKanban();

  return (
    <li
      key={card.id}
      data-card-id={card.id}
      onClick={() => {
        // clicking inside the card should set/keep focus on this card
        if (setFocusedId) setFocusedId(card.id);
      }}
      draggable
      onDragStart={(e) => {
        setDraggingId(card.id);
        e.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ id: card.id, from: column })
        );
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        setDraggingId(null);
        setDragOverIndexByColumn((s) => ({ ...s, [column]: null }));
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverIndexByColumn((s) => ({ ...s, [column]: index }));
      }}
      onDragLeave={() =>
        setDragOverIndexByColumn((s) => ({ ...s, [column]: null }))
      }
      onDrop={(e) => {
        const payload = e.dataTransfer.getData("text/plain");
        setDraggingId(null);
        setDragOverIndexByColumn((s) => ({ ...s, [column]: null }));
        try {
          const parsed = JSON.parse(payload) as { id: string; from: Column };
          if (parsed && parsed.id) {
            if (parsed.id === card.id && parsed.from === column) return;
            recordAction({
              type: "move",
              from: parsed.from,
              to: column,
              cardId: parsed.id,
              index,
            });
          }
        } catch (err) {
          // ignore
        }
      }}
      className={`border rounded p-3 bg-slate-200 w-full h-[160px] flex flex-col cursor-grab transition-transform duration-150 ${
        !!draggingId && draggingId === card.id ? "cursor-grabbing" : ""
      } ${dragOverIndexByColumn[column] === index ? "translate-y-5" : ""} ${
        focusedId === card.id ? "ring-2 ring-blue-500 border-blue-500" : ""
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
                if (v && v !== card.title)
                  recordAction({
                    type: "update",
                    column,
                    cardId: card.id,
                    changes: { title: v },
                  });
                setEditingId(null);
                setEditValue("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = editValue.trim();
                  if (v && v !== card.title)
                    recordAction({
                      type: "update",
                      column,
                      cardId: card.id,
                      changes: { title: v },
                    });
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
            onClick={() => {
              if (setFocusedId) setFocusedId(null);
              recordAction({ type: "remove", column, cardId: card.id });
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}
