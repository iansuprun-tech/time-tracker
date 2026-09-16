<script setup lang="ts">
/**
 * Незакрытые задачи сегодняшнего дня в боковой панели — чтобы переключить
 * таймер и отметить сделанное, не возвращаясь в «Мой день».
 *
 * Здесь же чинится тихая дыра: вехи таймера звучали только пока открыт свой
 * день, потому что только там был смонтирован `ElapsedTimer`. Ушёл в календарь —
 * и день шёл молча. Теперь звонит панель, а на самом «Моём дне» её нет,
 * так что вдвоём они не звучат.
 */
const today = localDate();

// без await: компонент клиентский, блокировать отрисовку страницы ему нечем
const { data, refresh } = useFetch("/api/day", {
  key: "today-dock",
  query: { date: today },
});

const busyId = ref<number | null>(null);
const listOpen = ref(false);

/** закрытое место в панели не занимает: к вечеру она стала бы списком зачёркнутого */
const tasks = computed(() => {
  const all = (data.value?.blocks ?? []).filter(
    (b) => b.status !== "done" && b.status !== "dropped",
  );
  // идущая — первой: на неё смотрят чаще всего
  return [...all].sort((a, b) => Number(Boolean(b.runningSince)) - Number(Boolean(a.runningSince)));
});

const running = computed(() => tasks.value.find((b) => b.runningSince) ?? null);
const started = computed(() => data.value?.day.status === "started");

const { unlock, chime } = useSoundSettings();

async function call(id: number, fn: () => Promise<unknown>) {
  if (busyId.value) return;
  busyId.value = id;
  try {
    await fn();
    await refresh();
  } finally {
    busyId.value = null;
  }
}

function toggleTimer(block: { id: number; runningSince: string | null }) {
  // клик — единственный момент, когда браузер разрешает открыть звук
  unlock();
  if (block.runningSince) {
    return call(block.id, () => $fetch<{ ok: boolean }>("/api/timer/stop", { method: "POST" }));
  }
  chime("start");
  return call(block.id, () =>
    $fetch<{ ok: boolean }>("/api/timer/start", { method: "POST", body: { blockId: block.id } }),
  );
}

const markDone = (id: number) =>
  call(id, () =>
    $fetch<{ ok: boolean }>("/api/blocks/update", { method: "POST", body: { id, status: "done" } }),
  );
</script>

<template>
  <!-- в боковой панели: только на широком экране, там для списка есть место -->
  <div v-if="started && tasks.length" class="hidden min-h-0 flex-1 flex-col md:flex">
    <div class="px-5 pb-1 pt-4 text-[11px] uppercase tracking-wide text-emerald-100/40">
      Сегодня · {{ tasks.length }}
    </div>

    <ul class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
      <li
        v-for="b in tasks"
        :key="b.id"
        class="rounded-lg px-3 py-2 transition-colors"
        :class="b.runningSince ? 'bg-emerald-800/60' : 'hover:bg-emerald-900/60'"
      >
        <div class="flex items-start gap-1.5">
          <span
            v-if="b.runningSince"
            class="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-300"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate text-sm text-emerald-50/90" :title="b.title">
            {{ b.title }}
          </span>
        </div>

        <div class="mt-1 flex items-center gap-1.5">
          <span class="flex-1 text-xs tabular-nums text-emerald-100/50">
            <ElapsedTimer
              v-if="b.runningSince"
              :since="b.runningSince"
              :base-min="b.trackedMin"
              :planned-min="b.plannedMin"
              :title="b.title"
              chime
            />
            <template v-else-if="b.plannedMin">{{ b.plannedMin }}м</template>
          </span>

          <button
            type="button"
            :disabled="busyId === b.id"
            class="grid size-7 shrink-0 place-items-center rounded-md transition-colors disabled:opacity-50"
            :class="
              b.runningSince
                ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200'
                : 'bg-emerald-700/70 text-emerald-50 hover:bg-emerald-600'
            "
            :aria-label="b.runningSince ? 'Остановить' : 'Запустить'"
            @click="toggleTimer(b)"
          >
            <Spinner v-if="busyId === b.id" />
            <svg v-else-if="b.runningSince" viewBox="0 0 24 24" class="size-3.5" fill="currentColor">
              <rect x="7" y="6" width="4" height="12" rx="1" />
              <rect x="13" y="6" width="4" height="12" rx="1" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="size-3.5" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </button>

          <button
            type="button"
            :disabled="busyId === b.id"
            class="grid size-7 shrink-0 place-items-center rounded-md text-emerald-100/60 transition-colors hover:bg-emerald-800 hover:text-white disabled:opacity-50"
            aria-label="Отметить готовым"
            @click="markDone(b.id)"
          >
            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
        </div>
      </li>
    </ul>
  </div>

  <!--
    На телефоне панель ложится полосой сверху, списку там не место.
    Вместо него полоска внизу с идущей задачей; по нажатию раскрывается весь список.
  -->
  <Teleport to="body">
    <div v-if="running" class="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div class="flex items-center gap-2 rounded-xl bg-emerald-900 px-3 py-2.5 text-emerald-50 shadow-2xl">
        <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="listOpen = true">
          <span class="size-1.5 shrink-0 rounded-full bg-emerald-300" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-sm">{{ running.title }}</span>
          <span class="shrink-0 text-xs tabular-nums text-emerald-100/70">
            <ElapsedTimer
              :since="running.runningSince!"
              :base-min="running.trackedMin"
              :planned-min="running.plannedMin"
              :title="running.title"
            />
          </span>
        </button>

        <button
          type="button"
          :disabled="busyId === running.id"
          class="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-300 text-emerald-950 transition-colors hover:bg-emerald-200 disabled:opacity-50"
          aria-label="Остановить"
          @click="toggleTimer(running)"
        >
          <Spinner v-if="busyId === running.id" />
          <svg v-else viewBox="0 0 24 24" class="size-4" fill="currentColor">
            <rect x="7" y="6" width="4" height="12" rx="1" />
            <rect x="13" y="6" width="4" height="12" rx="1" />
          </svg>
        </button>
      </div>
    </div>
  </Teleport>

  <ModalSheet v-if="listOpen" title="Сегодня" @close="listOpen = false">
    <ul class="-mx-1">
      <li v-for="b in tasks" :key="b.id" class="flex items-center gap-2 rounded-lg px-3 py-2.5">
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm">{{ b.title }}</span>
          <span class="text-xs muted">
            <ElapsedTimer
              v-if="b.runningSince"
              :since="b.runningSince"
              :base-min="b.trackedMin"
              :planned-min="b.plannedMin"
              :title="b.title"
            />
            <template v-else-if="b.plannedMin">{{ b.plannedMin }}м</template>
          </span>
        </span>

        <button
          type="button"
          :disabled="busyId === b.id"
          class="btn-soft shrink-0 px-3 py-1.5 text-xs"
          @click="toggleTimer(b)"
        >
          <Spinner v-if="busyId === b.id" />
          {{ b.runningSince ? "Стоп" : "Старт" }}
        </button>
        <button
          type="button"
          :disabled="busyId === b.id"
          class="btn-soft shrink-0 px-3 py-1.5 text-xs"
          aria-label="Отметить готовым"
          @click="markDone(b.id)"
        >
          ✓
        </button>
      </li>
    </ul>
  </ModalSheet>
</template>
