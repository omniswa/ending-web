import { appStore } from "../state/store.js";

export const isFavorite = (id) => appStore.get().favorites.includes(id);

export function addFavorite(id) {
  appStore.update((s) =>
    s.favorites.includes(id) ? s : { ...s, favorites: [id, ...s.favorites] },
  );
}

export function removeFavorite(id) {
  appStore.update((s) =>
    s.favorites.includes(id)
      ? { ...s, favorites: s.favorites.filter((f) => f !== id) }
      : s,
  );
}

/** Toggles and returns the new state. */
export function toggleFavorite(id) {
  const next = !isFavorite(id);
  if (next) addFavorite(id);
  else removeFavorite(id);
  return next;
}
