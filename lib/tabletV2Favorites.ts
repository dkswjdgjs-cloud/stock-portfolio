"use client";

export interface FavEntry {
  ticker: string;
  market: "KR" | "US";
  name: string;
}

const STORAGE_KEY = "glow-favorites";

export function loadFavorites(): FavEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveFavorites(favs: FavEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export function isFav(favs: FavEntry[], ticker: string): boolean {
  return favs.some((f) => f.ticker === ticker);
}

export function toggleFav(favs: FavEntry[], entry: FavEntry): FavEntry[] {
  if (isFav(favs, entry.ticker)) {
    return favs.filter((f) => f.ticker !== entry.ticker);
  }
  return [...favs, entry];
}
