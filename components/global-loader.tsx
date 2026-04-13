"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type LoaderVariant = "review" | "generate" | "rewrite";

type LoaderState = {
  active: boolean;
  label: string;
  messages: string[];
  index: number;
};

type LoaderContextValue = {
  showLoader: (variant: LoaderVariant) => number;
  hideLoader: (id: number) => void;
};

const LOADER_MESSAGES: Record<LoaderVariant, string[]> = {
  generate: [
    "Converting your requirement into best format...",
    "Reading your input...",
    "Understanding context...",
    "Extracting key data...",
    "Adding AI suggestions...",
    "Almost there...",
    "Here we go 🚀",
  ],
  review: [
    "Reviewing available fields...",
    "Analyzing input...",
    "Extracting structure...",
    "Here we go 🚀",
  ],
  rewrite: [
    "Improving your content...",
    "Enhancing tone...",
    "Making it more professional...",
    "Done ✨",
  ],
};

const LOADER_LABELS: Record<LoaderVariant, string> = {
  generate: "Generating output",
  review: "Refreshing review",
  rewrite: "Rewriting with AI",
};

const LoaderContext = createContext<LoaderContextValue | null>(null);

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
  const sequenceRef = useRef(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [state, setState] = useState<LoaderState>({
    active: false,
    label: "",
    messages: [],
    index: 0,
  });

  useEffect(() => {
    if (!state.active || state.messages.length < 2) {
      return;
    }

    const interval = window.setInterval(() => {
      setState((current) => ({
        ...current,
        index: (current.index + 1) % current.messages.length,
      }));
    }, 1800);

    return () => window.clearInterval(interval);
  }, [state.active, state.messages]);

  const showLoader = useCallback((variant: LoaderVariant) => {
    const nextId = sequenceRef.current + 1;
    sequenceRef.current = nextId;
    setActiveId(nextId);
    setState({
      active: true,
      label: LOADER_LABELS[variant],
      messages: LOADER_MESSAGES[variant],
      index: 0,
    });
    return nextId;
  }, []);

  const hideLoader = useCallback((id: number) => {
    setActiveId((currentId) => {
      if (currentId !== id) {
        return currentId;
      }
      setState({
        active: false,
        label: "",
        messages: [],
        index: 0,
      });
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({
      showLoader,
      hideLoader,
    }),
    [hideLoader, showLoader]
  );

  return (
    <LoaderContext.Provider value={value}>
      {children}
      <GlobalLoaderOverlay state={state} />
    </LoaderContext.Provider>
  );
}

export function useGlobalLoader() {
  const context = useContext(LoaderContext);

  if (!context) {
    throw new Error("useGlobalLoader must be used within GlobalLoaderProvider.");
  }

  return context;
}

function GlobalLoaderOverlay({ state }: { state: LoaderState }) {
  if (!state.active) {
    return null;
  }

  return (
    <div
      className="global-loader-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={state.label}
    >
      <div className="global-loader-card">
        <div className="global-loader-spinner" aria-hidden="true" />
        <p className="global-loader-label">{state.label}</p>
        <h2 className="global-loader-message">
          {state.messages[state.index] || "Loading..."}
        </h2>
      </div>
    </div>
  );
}
