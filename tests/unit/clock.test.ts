import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClock } from "../../src/lib/clock.ts";

describe("clock store (regression: 'Maximum update depth exceeded' in the interview room)", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("has a value as soon as someone subscribes and never notifies by itself on subscribe", () => {
    const t = 1000; const c = createClock(1000, () => t);
    expect(c.getSnapshot()).toBeNull();
    const cb = vi.fn(); const off = c.subscribe(cb);
    expect(c.getSnapshot()).toBe(1000);
    expect(cb).not.toHaveBeenCalled();         // a subscribe that notifies would re-render -> re-subscribe -> loop
    off();
  });

  it("re-subscribing (StrictMode / re-render) does not change the snapshot or notify", () => {
    let t = 5; const c = createClock(1000, () => t);
    const cb = vi.fn();
    const off1 = c.subscribe(cb); t = 99;       // the clock moved on between two subscribes
    const off2 = c.subscribe(cb);
    expect(c.getSnapshot()).toBe(5);             // second subscriber joined the running clock instead of resetting it
    expect(cb).not.toHaveBeenCalled();
    off1(); off2();
  });

  it("ticks once per interval to every subscriber and stops when the last one leaves", () => {
    let t = 0; const c = createClock(1000, () => t);
    const a = vi.fn(), b = vi.fn();
    const offA = c.subscribe(a), offB = c.subscribe(b);
    t = 1000; vi.advanceTimersByTime(1000);
    expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1); expect(c.getSnapshot()).toBe(1000);
    offA(); t = 2000; vi.advanceTimersByTime(1000);
    expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(2);
    offB(); expect(c.listenerCount()).toBe(0);
    t = 3000; vi.advanceTimersByTime(5000);
    expect(b).toHaveBeenCalledTimes(2);          // timer cleared: no leaks
  });

  it("server snapshot is null (hydration-safe)", () => { expect(createClock().getServerSnapshot()).toBeNull(); });
});
