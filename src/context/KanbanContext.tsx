import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";

export type Card = { id: string; title: string; description?: string };
export type Column = "todo" | "inprogress" | "done";
export type State = Record<Column, Card[]>;

export type Action =
  | { type: "add"; column: Column; card: Card }
  | { type: "move"; from: Column; to: Column; cardId: string; index?: number }
  | { type: "remove"; column: Column; cardId: string }
  | { type: "update"; column: Column; cardId: string; changes: Partial<Card> }
  | { type: "set"; state: State };

export type Activity = { text: string; ts: number };
export type ActivityState = Record<"actions", Activity[]>;

const STORAGE_KEY = "kanban.state.v1";
const STORAGE_KEY_ACTIVITY = "kanban.activity.v1";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add": {
      return {
        ...state,
        [action.column]: [action.card, ...state[action.column]],
      };
    }
    case "move": {
      const fromArr = state[action.from];
      const toArr = state[action.to];
      const sourceIndex = fromArr.findIndex((c) => c.id === action.cardId);
      if (sourceIndex === -1) return state;
      const card = fromArr[sourceIndex];
      const newFrom = fromArr
        .slice(0, sourceIndex)
        .concat(fromArr.slice(sourceIndex + 1));

      let targetIndex = action.index;
      if (targetIndex === undefined || targetIndex === null)
        targetIndex = toArr.length;

      if (action.from === action.to) {
        const adjustedIndex = Math.max(
          0,
          Math.min(targetIndex, newFrom.length)
        );
        const newCol = newFrom.slice();
        newCol.splice(adjustedIndex, 0, card);
        return { ...state, [action.from]: newCol };
      }

      const newTo = toArr.slice();
      const insertIndex = Math.max(0, Math.min(targetIndex, newTo.length));
      newTo.splice(insertIndex, 0, card);
      return { ...state, [action.from]: newFrom, [action.to]: newTo };
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

const initialState: State = { todo: [], inprogress: [], done: [] };
// const initialActivityState: ActivityState = {
//   actions: [],
// };

type ContextValue = {
  state: State;
  dispatch: React.Dispatch<Action>;
  activities: ActivityState;
  recordAction: (a: Action) => void;
};

const KanbanContext = createContext<ContextValue | undefined>(undefined);

export function KanbanProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const initialActivityState: ActivityState = { actions: [] };
  type ActivityAction =
    | { type: "push"; text: string }
    | { type: "set"; actions: Activity[] };

  function activityReducer(
    state: ActivityState,
    action: ActivityAction
  ): ActivityState {
    switch (action.type) {
      case "push": {
        const act: Activity = { text: action.text, ts: Date.now() };
        const concatenated = state.actions.concat(act);
        const deduped = concatenated.filter(
          (a, i, arr) => arr.findIndex((b) => b.text === a.text) === i
        );
        return { actions: deduped.slice(-5) };
      }
      case "set":
        return { actions: action.actions.slice(-5) };
      default:
        return state;
    }
  }

  const [activities, dispatchActivities] = React.useReducer(
    activityReducer,
    undefined,
    () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_ACTIVITY);
        if (!raw) return initialActivityState;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const deduped = (parsed as Activity[]).filter(
            (a, i, arr) => arr.findIndex((b) => b.text === a.text) === i
          );
          return { actions: deduped.slice(-5) };
        }
      } catch (e) {
        // ignore and fall through to default
      }
      return initialActivityState;
    }
  );
  const inited = useRef(false);

  // hydrate
  useEffect(() => {
    if (inited.current) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        dispatch({ type: "set", state: parsed });
      }
    } catch (e) {
      // ignore
    }
    inited.current = true;
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }, [state]);

  // persist activities.actions whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_ACTIVITY,
        JSON.stringify(activities.actions)
      );
    } catch (e) {
      // ignore
    }
  }, [activities]);

  function pushActivity(text: string) {
    dispatchActivities({ type: "push", text });
  }

  function getReadableName(column: Column) {
    const readables = {
      todo: "To Do",
      inprogress: "In Progress",
      done: "Done",
    };

    return readables[column] || "";
  }

  // helper that both dispatches and records activity for tracked actions
  function recordAction(action: Action) {
    // interpret action and generate activity texts for tracked types
    try {
      if (action.type === "add") {
        pushActivity(`${action.card.title} created`);
      } else if (action.type === "remove") {
        // find title from current state if possible
        const col = state[action.column] || [];
        const found = col.find((c) => c.id === action.cardId);
        const title = found ? found.title : action.cardId;
        pushActivity(`${title} deleted`);
      } else if (action.type === "move") {
        // find title from source column if possible
        const fromCol = state[action.from] || [];
        const found = fromCol.find((c) => c.id === action.cardId);
        const title = found ? found.title : action.cardId;
        pushActivity(`${title} moved to ${getReadableName(action.to)}`);
      } else if (action.type === "update") {
        const col = state[action.column] || [];
        const found = col.find((c) => c.id === action.cardId);
        const title = found ? found.title : action.cardId;
        pushActivity(`${title} updated`);
      }
    } catch (e) {
      // ignore
    }
    // always dispatch the action
    dispatch(action as Action);
  }

  return (
    <KanbanContext.Provider
      value={{ state, dispatch, activities, recordAction }}
    >
      {children}
    </KanbanContext.Provider>
  );
}

export function useKanban() {
  const ctx = useContext(KanbanContext);
  if (!ctx) throw new Error("useKanban must be used inside a KanbanProvider");
  return ctx;
}
