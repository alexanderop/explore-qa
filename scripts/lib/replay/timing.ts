import type { ReplayEvent } from "./types.ts";

type RawEvent = Omit<ReplayEvent, "t"> & { t?: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function spread(events: RawEvent[], durationS: number): ReplayEvent[] {
  const n = Math.max(1, events.length);
  const dur = durationS > 0 ? durationS : 1;
  return events.map((e, i) => ({
    ...e,
    t: r2((i * dur) / n),
  })) as ReplayEvent[];
}

export function scaleToDuration(events: RawEvent[], durationS: number): ReplayEvent[] {
  const dur = durationS > 0 ? durationS : 1;
  const n = events.length;
  const filled: RawEvent[] = events.map((e, i) => {
    if (e.t === undefined) {
      return { ...e, t: r2((i * dur) / Math.max(1, n)) };
    }
    return e;
  });
  const maxT = filled.reduce((m, e) => Math.max(m, e.t ?? 0), 0) || dur;
  const scale = maxT > 0 && maxT < dur ? dur / maxT : 1;
  return filled.map((e) => ({ ...e, t: r2((e.t ?? 0) * scale) })) as ReplayEvent[];
}

export function assignTimes(
  events: RawEvent[],
  durationS: number,
  hasRealTimestamps: boolean,
): ReplayEvent[] {
  return hasRealTimestamps ? scaleToDuration(events, durationS) : spread(events, durationS);
}
