<script setup lang="ts">
/**
 * Поле даты: кнопка с человеческой подписью, список ближайших дней и
 * нативный календарь на дне списка — для дат, до которых «завтра» не дотягивается.
 * Нативный input[type=date] в одиночку не годится: он показывает «дд.мм.гггг»
 * и требует попасть в календарь ради завтрашнего дня, а это обычный случай.
 */
const props = defineProps<{
  modelValue: string;
  /** дата уводит блок не туда, где мы стоим, — это должно быть видно без чтения */
  highlight?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const today = localDate();

/** «Сегодня» читается сразу, «2026-09-17» — по слогам */
function label(date: string) {
  if (date === today) return "Сегодня";
  if (date === shiftDays(today, 1)) return "Завтра";
  if (date === shiftDays(today, -1)) return "Вчера";
  return formatHuman(date, date.slice(0, 4) !== today.slice(0, 4));
}

/** Ближайшая неделя закрывает почти всё одним кликом */
const options = computed(() => {
  const days = Array.from({ length: 7 }, (_, n) => shiftDays(today, n));
  // выбранная дата может быть вне недели — из списка она пропадать не должна
  if (!days.includes(props.modelValue)) days.unshift(props.modelValue);
  return days;
});

function choose(date: string) {
  open.value = false;
  if (date && date !== props.modelValue) emit("update:modelValue", date);
}

function onDocumentPointer(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener("pointerdown", onDocumentPointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocumentPointer));
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="btn-soft gap-1.5 px-2.5 py-1 text-xs"
      :class="[
        open ? 'border-emerald-500/60' : '',
        highlight ? 'border-emerald-500/60 text-emerald-700 dark:text-emerald-400' : '',
      ]"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </svg>
      {{ label(modelValue) }}
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-black/10 bg-white py-1 shadow-lg dark:border-white/15 dark:bg-neutral-800"
    >
      <ul>
        <li v-for="d in options" :key="d">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 px-2.5 py-1 text-left text-xs transition-colors hover:bg-black/[0.05] dark:hover:bg-white/10"
            :class="d === modelValue ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''"
            @click="choose(d)"
          >
            <span>{{ label(d) }}</span>
            <span class="muted">{{ weekdayShort(d).toLowerCase() }}</span>
          </button>
        </li>
      </ul>

      <label class="mt-1 flex items-center gap-2 border-t border-black/10 px-2.5 pb-1 pt-2 text-[11px] muted dark:border-white/15">
        другой день
        <input
          type="date"
          :value="modelValue"
          class="field min-w-0 flex-1 px-1.5 py-0.5 text-xs"
          @change="choose(($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
  </div>
</template>
