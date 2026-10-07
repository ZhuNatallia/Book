import { useEffect, useRef } from 'react';

// Android's system Back button is the browser's history.back(). The app used to keep
// every screen in React state only, so Back left the site. Each forward step pushes
// a history entry; Back runs the matching undo.

export type SettingsView = 'main' | 'language' | 'theme' | 'profile' | 'feedback' | 'plan' | 'account';

export type BookPlace = {
  view: 'recipes' | 'shopping' | 'menu' | 'converter' | 'friends';
  fridge: boolean;
  recipeId: string | null;
  add: boolean;
  settings: SettingsView | null;
};

type Layer = {
  undo: () => void;
  // Place this undo restores. Overlay layers (a dialog on top of a screen) leave it empty.
  place?: BookPlace;
};

const stack: Layer[] = [];
let historyDepth = 0;
let skip = 0;
let listening = false;
let syncQueued = false;

function onPopState() {
  if (skip > 0) {
    skip -= 1;
    return;
  }
  historyDepth = Math.max(0, historyDepth - 1);
  stack.pop()?.undo();
}

// history.back() is async. React StrictMode also runs effect → cleanup → effect
// before that popstate arrives, so an immediate back() would pop the entry that
// was just pushed again. Align the history length with the stack after the turn.
function scheduleSync() {
  if (syncQueued || typeof window === 'undefined') return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    const extra = historyDepth - stack.length;
    if (extra <= 0) return;
    historyDepth -= extra;
    skip += 1;
    window.history.go(-extra);
  });
}

export function installBackNav() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const prev = window.history.state;
  if (!prev || typeof prev !== 'object' || !('bookNav' in prev)) {
    window.history.replaceState({ ...(prev ?? {}), bookNav: 'root' }, '');
  }
  window.addEventListener('popstate', onPopState);
}

export function samePlace(a: BookPlace, b: BookPlace): boolean {
  return a.view === b.view
    && a.fridge === b.fridge
    && a.recipeId === b.recipeId
    && a.add === b.add
    && a.settings === b.settings;
}

export function pushLayer(
  undo: () => void,
  place?: BookPlace,
  options?: { replaceOverlay?: boolean },
): Layer {
  installBackNav();
  if (options?.replaceOverlay) {
    const top = stack[stack.length - 1];
    if (top && top.place === undefined) {
      stack.pop();
      const layer: Layer = { undo, place };
      window.history.replaceState({ bookNav: stack.length + 1 }, '');
      stack.push(layer);
      return layer;
    }
  }
  const layer: Layer = { undo, place };
  historyDepth += 1;
  window.history.pushState({ bookNav: historyDepth }, '');
  stack.push(layer);
  return layer;
}

// The screen closed itself (its own button, or the component unmounted).
// Drop the layer without running undo again, then remove the leftover history entry.
export function releaseLayer(layer: Layer) {
  const index = stack.lastIndexOf(layer);
  if (index === -1) return;
  stack.splice(index, 1);
  scheduleSync();
}

// Drop the top dialog so the next navigation can reuse its history entry.
export function discardTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top || top.place !== undefined) return false;
  stack.pop();
  scheduleSync();
  return true;
}

export function backOnce(): boolean {
  if (stack.length === 0) return false;
  window.history.back();
  return true;
}

// Close every layer above the first restored place that matches, including that place's own undo.
export function undoUntil(match: (place: BookPlace) => boolean): boolean {
  if (stack.length === 0) return false;
  let steps = 0;
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    steps += 1;
    const place = stack[i].place;
    if (place && match(place)) break;
  }
  const removed = stack.splice(stack.length - steps, steps);
  historyDepth = Math.max(0, historyDepth - steps);
  skip += 1;
  window.history.go(-steps);
  for (let i = removed.length - 1; i >= 0; i -= 1) removed[i].undo();
  return true;
}

export function layerDepth(): number {
  return stack.length;
}

// A dialog or sub-screen that is not part of BookPlace. Closing it from the UI
// removes the history entry; the system Back button runs onClose.
export function useBackLayer(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const layerRef = useRef<Layer | null>(null);

  useEffect(() => {
    if (!active) return;
    const layer = pushLayer(() => {
      layerRef.current = null;
      onCloseRef.current();
    });
    layerRef.current = layer;
    return () => {
      const current = layerRef.current;
      if (!current) return;
      layerRef.current = null;
      releaseLayer(current);
    };
  }, [active]);
}
