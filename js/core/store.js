/** Minimal observable store: immutable updates, synchronous subscribers. */
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  return {
    get: () => state,
    /** `updater` receives the current state and returns the next one (or the same object for no-op). */
    update(updater) {
      const next = updater(state);
      if (next === state) return;
      state = next;
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
