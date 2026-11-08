import { useEffect, useState } from "react";
import { fetchJson } from "./api.js";

const initialState = () => ({ rooms: [], status: "loading", checkedAt: null, staleAfterSeconds: 60 });

export function useRooms() {
  const [state, setState] = useState(initialState);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let active = !document.hidden;
    let timer;
    let controller;
    let generation = 0;
    const current = (id) => !disposed && active && id === generation;
    async function refresh() {
      if (!active || disposed) return;
      const id = ++generation;
      controller = new AbortController();
      try {
        const body = await fetchJson("/api/rooms", { signal: controller.signal });
        if (!Array.isArray(body.rooms)) throw new Error("Unexpected room data.");
        if (current(id)) setState({ rooms: body.rooms, status: "ok", checkedAt: Date.now(), staleAfterSeconds: body.stale_after_seconds ?? 60 });
      } catch (error) {
        if (current(id) && error.name !== "AbortError") setState((previous) => ({ ...previous, status: "error" }));
      } finally {
        if (current(id)) timer = setTimeout(refresh, 10000);
      }
    }
    const setActive = (value) => {
      active = value;
      ++generation;
      clearTimeout(timer);
      controller?.abort();
      if (active) refresh();
    };
    const visibility = () => setActive(!document.hidden);
    const nativeState = (event) => setActive(event.detail.isActive);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("room:app-state", nativeState);
    refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("room:app-state", nativeState);
    };
  }, [attempt]);
  return { ...state, retry: ({ clear = false } = {}) => {
    if (clear) setState(initialState());
    setAttempt((value) => value + 1);
  } };
}

export function useSavedRooms(storageKey = "room.saved") {
  const [saved, setSaved] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return new Set(
        Array.isArray(value)
          ? value.filter((id) => typeof id === "string")
          : [],
      );
    } catch {
      return new Set();
    }
  });
  function toggle(id) {
    setSaved((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        /* Saving is optional. */
      }
      return next;
    });
  }
  return { saved, toggle };
}
