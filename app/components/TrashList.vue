<script setup lang="ts">
/**
 * Корзина: что удалено и что уедет вместе с задачей, если её не вернуть.
 * Счётчики заметок и комментариев тут главное — ради них удаление и сделали
 * мягким: завести задачу заново несложно, а восстановить разговор по ней
 * нельзя ничем.
 */
const { data, refresh } = await useFetch("/api/blocks/trash");

const busyId = ref<number | null>(null);

async function restore(id: number) {
  if (busyId.value) return;
  busyId.value = id;
  try {
    await $fetch<{ ok: boolean }>("/api/blocks/restore", { method: "POST", body: { id } });
    await refresh();
  } finally {
    busyId.value = null;
  }
}

function when(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lost(item: { notes: number; comments: number }) {
  const parts: string[] = [];
  if (item.notes) parts.push(`${item.notes} ${plural(item.notes, "заметка", "заметки", "заметок")}`);
  if (item.comments) {
    parts.push(`${item.comments} ${plural(item.comments, "комментарий", "комментария", "комментариев")}`);
  }
  return parts.join(" · ");
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
</script>

<template>
  <section class="card card-pad">
    <h2 class="text-sm font-medium">Корзина</h2>
    <p class="mt-1 text-sm muted">
      Удалённые задачи лежат здесь {{ data?.keepDays ?? 30 }} дней вместе с заметками,
      комментариями и таймингами. Потом вычищаются насовсем.
    </p>

    <ul v-if="data?.items.length" class="mt-4 space-y-2">
      <li
        v-for="item in data.items"
        :key="item.id"
        class="flex flex-wrap items-center gap-3 rounded-xl border border-black/[0.06] px-3 py-2.5 dark:border-white/10"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate text-sm font-medium">{{ item.title }}</span>
            <span v-if="item.project" class="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              {{ item.project }}
            </span>
            <span v-if="item.category" class="chip">{{ item.category }}</span>
          </div>
          <p class="mt-0.5 text-xs muted">
            {{ formatHuman(item.date, false) }}
            <template v-if="item.plannedStartMin != null && item.plannedEndMin != null">
              · {{ minToHhmm(item.plannedStartMin) }}–{{ minToHhmm(item.plannedEndMin) }}
            </template>
            <template v-else-if="item.plannedMin != null">· {{ item.plannedMin }}м</template>
            · удалена {{ when(item.deletedAt) }}
            <template v-if="lost(item)"> · {{ lost(item) }}</template>
          </p>
        </div>

        <button
          type="button"
          :disabled="busyId === item.id"
          class="btn-soft shrink-0 px-4 py-2"
          @click="restore(item.id)"
        >
          <Spinner v-if="busyId === item.id" />
          Вернуть
        </button>
      </li>
    </ul>

    <p v-else class="mt-4 text-sm muted">Пусто — ничего не удаляли.</p>
  </section>
</template>
