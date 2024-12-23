import { useCallback, useReducer, useRef } from "react";

type Action<T> =
  | {
      type: "UNDO" | "REDO";
    }
  | {
      type: "SET";
      newPresent: T;
    }
  | {
      type: "CLEAR";
      initialPresent: T;
    };

type State<T> = {
  past: T[];
  present: T;
  future: T[];
};

function useHistoryStateReducer<T>(state: State<T>, action: Action<T>): State<T> {
  const { past, present, future } = state;

  if (action.type === "UNDO") {
    return {
      past: past.slice(0, past.length - 1),
      present: past[past.length - 1],
      future: [present, ...future],
    };
  } else if (action.type === "REDO") {
    return {
      past: [...past, present],
      present: future[0],
      future: future.slice(1),
    };
  } else if (action.type === "SET") {
    const { newPresent } = action;

    if (action.newPresent === present) {
      return state;
    }

    return {
      past: [...past, present],
      present: newPresent,
      future: [],
    };
  } else if (action.type === "CLEAR") {
    return {
      ...state,
      present: action.initialPresent,
    };
  } else {
    throw new Error("Unsupported action type");
  }
}

/**
 * Simple hook with undo/redo/clear functionality.
 */
export function useHistoryState<T>(initialPresent: T) {
  const initialUseHistoryStateState: State<T> = {
    past: [],
    present: initialPresent,
    future: [],
  };
  const initialPresentRef = useRef(initialPresent);

  const [state, dispatch] = useReducer(useHistoryStateReducer, {
    ...initialUseHistoryStateState,
    present: initialPresentRef.current,
  });

  const canUndo = state.past.length !== 0;
  const canRedo = state.future.length !== 0;

  const undo = useCallback(() => {
    if (canUndo) {
      dispatch({ type: "UNDO" });
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      dispatch({ type: "REDO" });
    }
  }, [canRedo]);

  const set = useCallback((newPresent: T) => dispatch({ type: "SET", newPresent }), []);

  const clear = useCallback(() => dispatch({ type: "CLEAR", initialPresent: initialPresentRef.current }), []);

  return { state: state.present, set, undo, redo, clear, canUndo, canRedo };
}
