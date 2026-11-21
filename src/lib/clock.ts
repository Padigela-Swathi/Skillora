type Listener = () => void;

/**
 * A shared wall-clock store for React's useSyncExternalStore.
 *
 * `subscribe`, `getSnapshot` and `getServerSnapshot` have STABLE identities. If `subscribe` were re-created on every render,
 * React would re-subscribe on each render; a subscribe that touches the clock then triggers another render, and so on
 * ("Maximum update depth exceeded"). That race only shows up when the clock value changes between renders (slow machines,
 * dev mode), which is why it must not depend on timing.
 */
export function createClock(intervalMs = 1000, now: () => number = Date.now) {
  let tick: number | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<Listener>();

  const subscribe = (cb: Listener) => {
    listeners.add(cb);
    if (timer === null) {                     // first subscriber starts the clock; later ones just join it
      tick = now();
      timer = setInterval(() => { tick = now(); listeners.forEach((l) => l()); }, intervalMs);
    }
    return () => {
      listeners.delete(cb);
      if (listeners.size === 0 && timer !== null) { clearInterval(timer); timer = null; }
    };
  };

  return { subscribe, getSnapshot: () => tick, getServerSnapshot: (): number | null => null, listenerCount: () => listeners.size };
}

export const clock = createClock();
