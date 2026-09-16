/**
 * Звуки синтезируются на месте, а не лежат файлами: репозиторий публичный,
 * бинарники в нём заводить не хочется, а тембр так настраивается параметром.
 */

export type SoundId =
  | "tick"
  | "ping"
  | "double"
  | "triple"
  | "chime"
  | "gong"
  | "alarm"
  | "siren"
  | "buzzer"
  | "rising";

type Note = {
  freq: number;
  /** конечная частота: с ней нота едет от freq к to — так делается вой сирены */
  to?: number;
  /** сдвиг от начала звука, секунды */
  at: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
};

/** Ряд одинаковых бипов: описывать их по одному — простыня без смысла */
function beeps(
  count: number,
  freq: number,
  dur: number,
  step: number,
  type: OscillatorType,
  gain: number | ((i: number) => number),
): Note[] {
  return Array.from({ length: count }, (_, i) => ({
    freq,
    at: i * step,
    dur,
    type,
    gain: typeof gain === "function" ? gain(i) : gain,
  }));
}

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

  // Три громких на случай «это нельзя прослушать». Пила и меандр богаты
  // обертонами и лезут сквозь музыку там, где чистая синусоида тонет.
  { id: "siren", label: "сирена", notes: [
    { freq: 620, to: 1150, at: 0, dur: 0.55, gain: 0.95, type: "sawtooth" },
    { freq: 1150, to: 620, at: 0.55, dur: 0.55, gain: 0.95, type: "sawtooth" },
    { freq: 620, to: 1150, at: 1.1, dur: 0.55, gain: 0.95, type: "sawtooth" },
    { freq: 1150, to: 620, at: 1.65, dur: 0.55, gain: 0.95, type: "sawtooth" },
    { freq: 620, to: 1150, at: 2.2, dur: 0.55, gain: 0.95, type: "sawtooth" },
  ] },
  { id: "buzzer", label: "трезвон", notes: beeps(12, 2000, 0.07, 0.13, "square", 0.85) },
  // от чуть слышного к громкому: услышал сразу — не бьёт, отвлёкся — всё равно дойдёт
  { id: "rising", label: "нарастающий", notes: beeps(9, 950, 0.16, 0.42, "triangle", (i) => 0.12 + i * 0.11) },
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

let keepAlive: ConstantSourceNode | null = null;

/**
 * Держит аудиоконтекст бодрствующим, пока идёт таймер.
 *
 * Уснувший контекст — вторая причина, по которой сигнал «не сыграл вообще»:
 * запланированные в него вехи умирают вместе с ним, а разбудить его потом
 * некому — жеста-то нет, вкладка в фоне. Источник молчащий (gain 0), он ничего
 * не добавляет к звуку, только не даёт подсистеме решить, что она не нужна.
 */
export function keepAudioAwake(on: boolean) {
  const c = context();
  if (!c) return;

  if (!on) {
    keepAlive?.stop();
    keepAlive = null;
    return;
  }
  if (keepAlive) return;

  if (c.state === "suspended") void c.resume();
  const src = c.createConstantSource();
  const mute = c.createGain();
  mute.gain.value = 0;
  src.connect(mute).connect(c.destination);
  src.start();
  keepAlive = src;
}

if (import.meta.client) {
  // возврат на вкладку — хороший момент поднять контекст, если он всё же лёг
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) unlockAudio();
  });
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
  // потолок: 0.35 оказалось слишком тихо — сигнал не пробивался сквозь музыку
  // и через вкладку в фоне. Запас на наушники всё же оставлен.
  master.gain.value = Math.min(1, Math.max(0, volume)) * 0.7;
  master.connect(c.destination);

  const t0 = Math.max(at ?? 0, c.currentTime + 0.02);
  for (const n of sound.notes) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = n.type ?? "sine";

    const start = t0 + n.at;
    osc.frequency.setValueAtTime(n.freq, start);
    // нота с конечной частотой едет к ней — так получается вой сирены
    if (n.to !== undefined) osc.frequency.linearRampToValueAtTime(n.to, start + n.dur);
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
