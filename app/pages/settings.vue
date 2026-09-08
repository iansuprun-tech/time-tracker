<script setup lang="ts">
import { SOUNDS } from "~/composables/useChimes";

const { settings, preview, reset } = useSoundSettings();

// у «подхода» и «переработки» свои минуты, у остальных событий настраивать нечего
const MINUTE_FIELD: Partial<Record<ChimeEvent, "approachMin" | "overtimeEveryMin">> = {
  approach: "approachMin",
  overtime: "overtimeEveryMin",
};
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <h1 class="mb-1 text-xl font-semibold">Звуки таймера</h1>
    <p class="mb-6 text-sm text-black/50 dark:text-white/50">
      Звучит только на своём начатом дне и только пока вкладка открыта. Настройки живут в этом браузере.
    </p>

    <ClientOnly>
      <div class="space-y-6">
        <div class="rounded-lg border border-black/10 p-4 dark:border-white/15">
          <label class="flex items-center gap-2 text-sm">
            <input v-model="settings.enabled" type="checkbox" class="size-4" />
            <span class="font-medium">Звук включён</span>
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
                class="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
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
            class="rounded-lg border border-black/10 p-3 dark:border-white/15"
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
                class="rounded border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              >
                <option v-for="s in SOUNDS" :key="s.id" :value="s.id">{{ s.label }}</option>
              </select>

              <button
                type="button"
                :disabled="!settings.enabled"
                class="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
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
                class="w-16 rounded border border-black/15 bg-transparent px-1 py-0.5 dark:border-white/20"
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
