/**
 * Звуки синтезируются на месте, а не лежат файлами: репозиторий публичный,
 * бинарники в нём заводить не хочется, а тембр так настраивается параметром.
 */

export type SoundId = "tick" | "ping" | "double" | "triple" | "chime" | "gong" | "alarm";

type Note = {
  freq: number;
  /** сдвиг от начала звука, секунды */
  at: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
};

export const SOUNDS: { id: SoundId; label: string; notes: Note[] }[] = [
  { id: "tick", label: "щелчок", notes: [{ freq: 1200, at: 0, dur: 0.05, gain: 0.5, type: "square" }] },
  { id: "ping", label: "пинг", notes: [{ freq: 880, at: 0, dur: 0.28 }] },
  { id: "double", label: "два бипа", notes: [
    { freq: 660, at: 0, dur: 0.14 },
    { freq: 660, at: 0.18, dur: 0.18 },
  ] },
  { id: "triple", label: "три бипа", notes: [
    { freq: 784, at: 0, dur: 0.11 },
    { freq: 784, at: 0.15, dur: 0.11 },
    { freq: 784, at: 0.3, dur: 0.18 },
  ] },
  { id: "chime", label: "перезвон", notes: [
    { freq: 523.25, at: 0, dur: 0.5 },
    { freq: 659.25, at: 0.09, dur: 0.5 },
    { freq: 783.99, at: 0.18, dur: 0.75 },
  ] },
  { id: "gong", label: "гонг", notes: [
    { freq: 98, at: 0, dur: 1.8, gain: 0.5 },
    { freq: 196, at: 0, dur: 1.5, gain: 0.8 },
    { freq: 293, at: 0.02, dur: 1.1, gain: 0.3 },
  ] },
  { id: "alarm", label: "тревога", notes: [
    { freq: 880, at: 0, dur: 0.16, gain: 0.9, type: "triangle" },
    { freq: 660, at: 0.2, dur: 0.16, gain: 0.9, type: "triangle" },
    { freq: 880, at: 0.4, dur: 0.16, gain: 0.9, type: "triangle" },
    { freq: 660, at: 0.6, dur: 0.28, gain: 0.9, type: "triangle" },
  ] },
];

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (!import.meta.client) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Браузер держит звук закрытым, пока пользователь не сделал жест. Любой клик открывает. */
export function unlockAudio() {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

/**
 * Часы звуковой подсистемы. Идут отдельно от главного потока и не тормозят,
 * когда браузер душит фоновую вкладку — поэтому вехи ставятся именно по ним.
 * Замирают вместе с системой на сне ноутбука, отсюда же берётся признак расхождения.
 */
export function audioNow(): number | null {
  return context()?.currentTime ?? null;
}

/**
 * `at` — момент по часам аудиоконтекста; без него звучит сразу.
 * Возвращает отмену: запланированное надо снимать при остановке таймера.
 */
export function playSound(id: SoundId, volume = 0.6, at?: number): (() => void) | null {
  const c = context();
  if (!c) return null;
  if (c.state === "suspended") void c.resume();

  const sound = SOUNDS.find((s) => s.id === id);
  if (!sound) return null;

  const master = c.createGain();
  // 0.35 — потолок: даже на максимуме ползунка звук не должен бить по ушам в наушниках
  master.gain.value = Math.min(1, Math.max(0, volume)) * 0.35;
  master.connect(c.destination);

  const t0 = Math.max(at ?? 0, c.currentTime + 0.02);
  for (const n of sound.notes) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.freq;

    const start = t0 + n.at;
    // экспоненциальная рампа не умеет в ноль, отсюда 0.0001
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(n.gain ?? 0.7, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);

    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + n.dur + 0.05);
  }

  return () => master.disconnect();
}
