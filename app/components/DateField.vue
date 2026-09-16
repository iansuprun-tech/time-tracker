<script setup lang="ts">
/**
 * Поле даты: чип с человеческой подписью, по клику модалка с ближайшими днями
 * и нативным календарём на дне списка — для дат, до которых «завтра»
 * не дотягивается.
 *
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
const today = localDate();

/** «Сегодня» читается сразу, «2026-09-17» — по слогам */
function label(date: string) {
  if (date === today) return "Сегодня";
  if (date === shiftDays(today, 1)) return "Завтра";
  if (date === shiftDays(today, -1)) return "Вчера";
  return formatHuman(date, date.slice(0, 4) !== today.slice(0, 4));
}

/** Ближайшие две недели закрывают почти всё одним касанием */
const options = computed(() => {
  const days = Array.from({ length: 14 }, (_, n) => shiftDays(today, n));
  // выбранная дата может быть вне диапазона — из списка она пропадать не должна
  if (!days.includes(props.modelValue)) days.unshift(props.modelValue);
  return days;
});

function choose(date: string) {
  open.value = false;
  if (date && date !== props.modelValue) emit("update:modelValue", date);
}
</script>

<template>
  <div class="contents">
    <button type="button" :class="highlight ? 'chip-set' : 'chip-attr'" @click="open = true">
      <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </svg>
      {{ label(modelValue) }}
    </button>

    <ModalSheet v-if="open" title="Когда" @close="open = false">
      <ul class="-mx-1">
        <li v-for="d in options" :key="d">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.05] dark:hover:bg-white/10"
            :class="d === modelValue ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''"
            @click="choose(d)"
          >
            <span>{{ label(d) }}</span>
            <span class="text-xs muted">{{ weekdayShort(d).toLowerCase() }}</span>
          </button>
        </li>
      </ul>

      <label class="mt-2 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-xs muted dark:border-white/10">
        другой день
        <input
          type="date"
          :value="modelValue"
          class="field min-w-0 flex-1 px-2 py-1 text-sm"
          @change="choose(($event.target as HTMLInputElement).value)"
        />
      </label>
    </ModalSheet>
  </div>
</template>
