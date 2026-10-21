export type PreviewDataState = 'data' | 'loading' | 'empty' | 'error';

const validStates: PreviewDataState[] = ['data', 'loading', 'empty', 'error'];
const stateListeners = new Set<() => void>();

function readInitialState(): PreviewDataState {
  if (!import.meta.env.DEV) return 'data';
  const params = new URLSearchParams(window.location.search);
  const queryState = params.get('previewState');
  const storedState = window.localStorage.getItem('previewState');
  const selected = queryState ?? storedState;
  if (selected && validStates.includes(selected as PreviewDataState)) {
    if (queryState) window.localStorage.setItem('previewState', queryState);
    return selected as PreviewDataState;
  }
  return 'data';
}

let currentState = readInitialState();

export function getPreviewDataState(): PreviewDataState {
  return import.meta.env.DEV ? currentState : 'data';
}

export function setPreviewDataState(nextState: PreviewDataState): void {
  if (!import.meta.env.DEV) return;
  currentState = nextState;
  window.localStorage.setItem('previewState', nextState);
  stateListeners.forEach((listener) => listener());
}

export function subscribePreviewState(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}