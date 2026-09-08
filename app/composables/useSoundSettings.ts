import { effectScope } from "vue";
import { SOUNDS, playSound, unlockAudio, type SoundId } from "./useChimes";

export type ChimeEvent = "start" | "hour" | "approach" | "planned" | "overtime";

export const CHIME_EVENTS: { id: ChimeEvent; label: string; hint: string }[] = [
  { id: "start", label: "Старт", hint: "таймер пошёл" },
  { id: "hour", label: "Круглый час", hint: "60, 120, 180 минут по блоку" },
  { id: "approach", label: "Подход к плану", hint: "за столько минут до планового времени" },
  { id: "planned", label: "План выбран", hint: "плановое время блока прошло" },
  { id: "overtime", label: "Переработка", hint: "повтор с этим шагом уже сверх плана" },
];

export type SoundSettings = {
  enabled: boolean;
  /** 0..1 */
  volume: number;
  /** false = звонит только первый час, дальше тишина */
  hourRepeat: boolean;
  approachMin: number;
  overtimeEveryMin: number;
  events: Record<ChimeEvent, { on: boolean; sound: SoundId }>;
};

const DEFAULTS: SoundSettings = {
  enabled: true,
  volume: 0.6,
  hourRepeat: true,
  approachMin: 10,
  overtimeEveryMin: 15,
  events: {
    start: { on: true, sound: "tick" },
    hour: { on: true, sound: "ping" },
    approach: { on: true, sound: "double" },
    planned: { on: true, sound: "chime" },
    overtime: { on: false, sound: "alarm" },
  },
};

const KEY = "tt.sounds.v1";

const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/** Настройки могли быть записаны прошлой версией — читаем их по полю, а не целиком */
function fromStorage(raw: unknown): SoundSettings {
  const r = (raw ?? {}) as Partial<SoundSettings>;
  const events = {} as SoundSettings["events"];
  for (const e of CHIME_EVENTS) {
    const got = r.events?.[e.id];
    events[e.id] = {
      on: typeof got?.on === "boolean" ? got.on : DEFAULTS.events[e.id].on,
      sound: SOUNDS.some((s) => s.id === got?.sound) ? got!.sound : DEFAULTS.events[e.id].sound,
    };
  }
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULTS.enabled,
    volume: clamp(r.volume, 0, 1, DEFAULTS.volume),
    hourRepeat: typeof r.hourRepeat === "boolean" ? r.hourRepeat : DEFAULTS.hourRepeat,
    approachMin: clamp(r.approachMin, 1, 120, DEFAULTS.approachMin),
    overtimeEveryMin: clamp(r.overtimeEveryMin, 1, 120, DEFAULTS.overtimeEveryMin),
    events,
  };
}

let ready = false;

export function useSoundSettings() {
  const settings = useState<SoundSettings>("sound-settings", () => fromStorage(null));

  if (import.meta.client && !ready) {
    ready = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) settings.value = fromStorage(JSON.parse(raw));
    } catch {
      // приватный режим или битый json — остаются настройки по умолчанию
    }
    // scope отвязан от компонента: иначе наблюдатель умрёт с первой же страницей, которая его завела
    effectScope(true).run(() => {
      watch(
        settings,
        (v) => {
          try {
            localStorage.setItem(KEY, JSON.stringify(v));
          } catch {
            // место кончилось или запись запрещена — настройки просто не переживут перезагрузку
          }
        },
        { deep: true },
      );
    });
    // таймер мог идти ещё до открытия страницы: тогда звук откроет первый же жест, любой
    addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
    addEventListener("keydown", unlockAudio, { once: true, capture: true });
  }

  /** Прозвучит ли событие при нынешних настройках */
  function willChime(event: ChimeEvent) {
    return settings.value.enabled && settings.value.events[event].on;
  }

  function chime(event: ChimeEvent) {
    if (!willChime(event)) return;
    playSound(settings.value.events[event].sound, settings.value.volume);
  }

  /** Положить звук в аудиопоток заранее, на момент по часам аудиоконтекста. Возвращает отмену. */
  function scheduleChime(event: ChimeEvent, at: number) {
    if (!willChime(event)) return null;
    return playSound(settings.value.events[event].sound, settings.value.volume, at);
  }

  /** Прослушать звук на странице настроек — мимо галок «включено» */
  function preview(sound: SoundId) {
    unlockAudio();
    playSound(sound, settings.value.volume);
  }

  function reset() {
    settings.value = fromStorage(null);
  }

  return { settings, chime, willChime, scheduleChime, preview, reset, unlock: unlockAudio };
}
