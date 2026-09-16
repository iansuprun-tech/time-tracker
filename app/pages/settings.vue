<script setup lang="ts">
import { SOUNDS } from "~/composables/useChimes";

const { settings, preview, reset, askNotifyPermission, notify } = useSoundSettings();

/** Состояние разрешения читаем на клиенте: на сервере Notification нет */
const permission = ref<NotificationPermission | "unsupported">("default");
onMounted(() => {
  permission.value = "Notification" in window ? Notification.permission : "unsupported";
});

/**
 * Разрешение спрашиваем по этому клику — браузер даёт его только по жесту.
 * Отказ запоминается браузером навсегда, вернуть его можно лишь в настройках
 * сайта, поэтому про это честно пишем под галкой.
 */
async function toggleNotify(on: boolean) {
  if (!on) {
    settings.value.notify = false;
    return;
  }
  const granted = await askNotifyPermission();
  permission.value = "Notification" in window ? Notification.permission : "unsupported";
  settings.value.notify = granted;
  if (granted) notify("planned", "проверка");
}

const { data: presets, refresh: reloadPresets } = await useFetch("/api/presets");
const reload = async () => {
  await reloadPresets();
};

// у «подхода» и «переработки» свои минуты, у остальных событий настраивать нечего
const MINUTE_FIELD: Partial<Record<ChimeEvent, "approachMin" | "overtimeEveryMin">> = {
  approach: "approachMin",
  overtime: "overtimeEveryMin",
};
</script>

<template>
  <main class="page">
    <h1 class="page-title mb-6">Настройки</h1>

    <div class="mb-8 space-y-4">
      <PresetList
        kind="category"
        title="Категории"
        hint="Подсказки в поле категории. Новое значение из блока попадает сюда само."
        :items="presets?.categories ?? []"
        :reload="reload"
      />
      <PresetList
        kind="project"
        title="Проекты"
        hint="К какому проекту относится задача. Новое значение из формы попадает сюда само."
        :items="presets?.projects ?? []"
        :reload="reload"
      />
      <PresetList
        kind="place"
        title="Места"
        hint="Офис, дом, коворкинг — подставляются в поле места."
        :items="presets?.places ?? []"
        :reload="reload"
      />
      <TrashList />
      <ChangePassword />
    </div>

    <h2 class="mb-1 text-lg font-semibold">Звуки таймера</h2>
    <p class="mb-6 text-sm muted">
      Звучит только на своём начатом дне и только пока вкладка открыта. Настройки живут в этом браузере.
    </p>

    <ClientOnly>
      <div class="space-y-6">
        <div class="card card-pad">
          <label class="flex items-center gap-2 text-sm">
            <input v-model="settings.enabled" type="checkbox" class="size-4" />
            <span class="font-medium">Звук включён</span>
          </label>

          <label class="mt-4 flex items-start gap-2 text-sm" :class="settings.enabled ? '' : 'opacity-40'">
            <input
              type="checkbox"
              class="mt-0.5 size-4"
              :checked="settings.notify"
              :disabled="!settings.enabled || permission === 'unsupported' || permission === 'denied'"
              @change="toggleNotify(($event.target as HTMLInputElement).checked)"
            />
            <span>
              <span class="font-medium">Уведомления системы</span>
              <span class="mt-0.5 block text-xs muted">
                <template v-if="permission === 'unsupported'">
                  Этот браузер уведомления не поддерживает.
                </template>
                <template v-else-if="permission === 'denied'">
                  Браузер запретил уведомления для сайта. Вернуть можно только в его
                  настройках сайта — галка отсюда уже не поможет.
                </template>
                <template v-else>
                  Плашка в углу экрана на каждую веху. Видна и слышна, даже когда вы
                  в другой программе, — звук вкладки там расслышать труднее. Приглушать
                  чужой звук страница не умеет: такого в браузере просто нет.
                </template>
              </span>
            </span>
          </label>

          <label class="mt-4 block text-sm" :class="settings.enabled ? '' : 'opacity-40'">
            <span class="text-black/60 dark:text-white/60">Громкость</span>
            <div class="mt-1 flex items-center gap-3">
              <input
                v-model.number="settings.volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                :disabled="!settings.enabled"
                class="flex-1"
              />
              <span class="w-10 tabular-nums text-right text-black/50 dark:text-white/50">
                {{ Math.round(settings.volume * 100) }}%
              </span>
              <button
                type="button"
                :disabled="!settings.enabled"
                class="btn-soft px-2 py-1 text-xs"
                @click="preview('chime')"
              >
                проверить
              </button>
            </div>
          </label>
        </div>

        <ul class="space-y-3" :class="settings.enabled ? '' : 'opacity-40'">
          <li
            v-for="e in CHIME_EVENTS"
            :key="e.id"
            class="card p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <label class="flex flex-1 items-center gap-2 text-sm">
                <input
                  v-model="settings.events[e.id].on"
                  type="checkbox"
                  :disabled="!settings.enabled"
                  class="size-4"
                />
                <span class="font-medium">{{ e.label }}</span>
              </label>

              <select
                v-model="settings.events[e.id].sound"
                :disabled="!settings.enabled"
                class="field py-1"
              >
                <option v-for="s in SOUNDS" :key="s.id" :value="s.id">{{ s.label }}</option>
              </select>

              <button
                type="button"
                :disabled="!settings.enabled"
                class="btn-soft px-2 py-1 text-xs"
                @click="preview(settings.events[e.id].sound)"
              >
                ▶
              </button>
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
              <span>{{ e.hint }}</span>

              <input
                v-if="MINUTE_FIELD[e.id]"
                v-model.number="settings[MINUTE_FIELD[e.id]!]"
                type="number"
                min="1"
                max="120"
                step="5"
                :disabled="!settings.enabled"
                class="field w-16 px-2 py-0.5"
              />
              <span v-if="MINUTE_FIELD[e.id]">мин</span>

              <label v-if="e.id === 'hour'" class="flex items-center gap-1.5">
                <input
                  v-model="settings.hourRepeat"
                  type="checkbox"
                  :disabled="!settings.enabled"
                  class="size-3.5"
                />
                каждый час, а не только первый
              </label>
            </div>
          </li>
        </ul>

        <button
          type="button"
          class="text-sm text-black/50 underline underline-offset-4 dark:text-white/50"
          @click="reset"
        >
          вернуть по умолчанию
        </button>
      </div>

      <template #fallback>
        <p class="text-sm text-black/40 dark:text-white/40">…</p>
      </template>
    </ClientOnly>
  </main>
</template>
