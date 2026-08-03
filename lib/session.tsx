'use client';

/**
 * session.tsx — one continuous session.
 *
 * Holds what must survive movement between windows: which window is open,
 * per-window scroll position, query history, and which target of a multi-target
 * answer the user is currently standing on. Persisted to sessionStorage so a
 * refresh does not feel like starting over.
 *
 * Context + useReducer rather than a store dependency — this is ~6 fields.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { QueryResult, QueryStatus } from './retrieval';
import { clampWindowId } from './windows';

export type Exchange = {
  id: string;
  question: string;
  result: QueryResult | null;
  status: QueryStatus;
  error?: string;
};

type ScrollPos = { x: number; y: number };

type State = {
  currentWindow: number;
  scroll: Record<number, ScrollPos>;
  history: Exchange[];
  targetIndex: number;
  /** Windows whose companion guide has already been shown this session. The
   *  guide interrupts once per window, not on every return visit. */
  guideSeen: Record<number, boolean>;
  hydrated: boolean;
};

const initialState: State = {
  currentWindow: 0,
  scroll: {},
  history: [],
  targetIndex: 0,
  guideSeen: {},
  hydrated: false,
};

type Action =
  | { type: 'HYDRATE'; state: Partial<State> }
  | { type: 'SET_WINDOW'; id: number }
  | { type: 'SET_SCROLL'; id: number; pos: ScrollPos }
  | { type: 'ASK'; id: string; question: string }
  | { type: 'ANSWER'; id: string; result: QueryResult }
  | { type: 'FAIL'; id: string; error: string }
  | { type: 'SET_TARGET_INDEX'; index: number }
  | { type: 'MARK_GUIDE_SEEN'; id: number }
  | { type: 'CLEAR_HISTORY' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.state, hydrated: true };

    case 'SET_WINDOW':
      return { ...state, currentWindow: clampWindowId(action.id) };

    case 'SET_SCROLL':
      return { ...state, scroll: { ...state.scroll, [action.id]: action.pos } };

    case 'ASK':
      return {
        ...state,
        targetIndex: 0,
        history: [
          ...state.history,
          { id: action.id, question: action.question, result: null, status: 'thinking' },
        ],
      };

    case 'ANSWER':
      return {
        ...state,
        targetIndex: 0,
        history: state.history.map((h) =>
          h.id === action.id
            ? {
                ...h,
                result: action.result,
                status: action.result.targets.length ? 'answered' : 'empty',
              }
            : h
        ),
      };

    case 'FAIL':
      return {
        ...state,
        history: state.history.map((h) =>
          h.id === action.id ? { ...h, status: 'error', error: action.error } : h
        ),
      };

    case 'SET_TARGET_INDEX':
      return { ...state, targetIndex: action.index };

    case 'MARK_GUIDE_SEEN':
      return { ...state, guideSeen: { ...state.guideSeen, [action.id]: true } };

    case 'CLEAR_HISTORY':
      return { ...state, history: [], targetIndex: 0 };

    default:
      return state;
  }
}

const KEY = 'silicon-altar-session-v1';

const Ctx = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  latest: Exchange | null;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) dispatch({ type: 'HYDRATE', state: JSON.parse(raw) });
      else dispatch({ type: 'HYDRATE', state: {} });
    } catch {
      dispatch({ type: 'HYDRATE', state: {} });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      const { hydrated, ...persist } = state;
      sessionStorage.setItem(KEY, JSON.stringify(persist));
    } catch {
      // Non-fatal: session persistence is a nicety, not a requirement.
    }
  }, [state]);

  const latest = state.history.length ? state.history[state.history.length - 1] : null;

  const value = useMemo(() => ({ state, dispatch, latest }), [state, latest]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
