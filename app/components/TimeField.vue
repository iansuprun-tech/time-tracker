<script setup lang="ts">
/**
 * Поле времени вместо нативного input[type=time]: тот показывает «--:-- --»
 * и просит попасть в крошечные стрелки, а формат берёт из локали браузера.
 *
 * Здесь кнопка со временем, а по клику модалка: печатаешь как удобно
 * («1030», «10.30», «9») — получаешь 10:30, а рядом список получасовок,
 * чтобы обычный случай закрывался одним касанием. У поля «по» в списке
 * сразу видна длительность — «+30м», «1ч».
 */
const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  /** для поля «по»: от какого времени считать длительность в подсказках */
  fromMin?: number | null;
}>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

const open = ref(false);
const text = ref(props.modelValue);
const input = ref<HTMLInputElement | null>(null);

watch(
  () => props.modelValue,
  (v) => {
    if (v !== normalize(text.value)) text.value = v;
  },
);

/** «1030», «10.30», «10 30», «9» → «10:30» и «09:00»; мусор → пусто */
function normalize(raw: string) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const h = digits.length <= 2 ? Number(digits) : Number(digits.slice(0, digits.length - 2));
  const m = digits.length <= 2 ? 0 : Number(digits.slice(-2));
  if (h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function openModal() {
  text.value = props.modelValue;
  open.value = true;
  await nextTick();
  input.value?.focus();
  input.value?.select();
}

function commit() {
  const value = normalize(text.value);
  text.value = value;
  open.value = false;
  if (value !== props.modelValue) emit("update:modelValue", value);
}

function choose(value: string) {
  text.value = value;
  commit();
}

/** Шаг полчаса: попасть в редкое «10:07» можно руками, а не прокруткой списка */
const options = computed(() => {
  const from = props.fromMin ?? null;
  const start = from === null ? 6 * 60 : from + 15;
  const end = from === null ? 23 * 60 + 30 : Math.min(from + 8 * 60, 24 * 60);
  const step = from === null ? 30 : 15;

  const out: { value: string; hint: string }[] = [];
  for (let min = start; min <= end; min += step) {
    if (min > 24 * 60) break;
    const span = from === null ? "" : hm(min - from);
    out.push({ value: minToHhmm(min % (24 * 60)), hint: span });
  }
  return out;
});

function hm(min: number) {
  if (min < 60) return `${min}м`;
  const rest = min % 60;
  return rest ? `${Math.floor(min / 60)}ч ${rest}м` : `${Math.floor(min / 60)}ч`;
}
</script>

<template>
  <div class="contents">
    <button
      type="button"
      class="field w-[4.75rem] py-1 text-center tabular-nums"
      :class="modelValue ? '' : 'text-black/35 dark:text-white/30'"
      @click="openModal"
    >
      {{ modelValue || placeholder || "10:00" }}
    </button>

    <ModalSheet v-if="open" :title="placeholder === 'по' ? 'Время «по»' : 'Время «с»'" @close="commit">
      <input
        ref="input"
        v-model="text"
        inputmode="numeric"
        maxlength="5"
        :placeholder="placeholder ?? '10:00'"
        class="field mb-2 w-full py-2 text-center text-lg tabular-nums"
        @keydown.enter.prevent="commit"
      />

      <ul class="-mx-1">
        <li v-for="o in options" :key="o.value">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.05] dark:hover:bg-white/10"
            :class="o.value === modelValue ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''"
            @click="choose(o.value)"
          >
            <span class="tabular-nums">{{ o.value }}</span>
            <span v-if="o.hint" class="text-xs muted">{{ o.hint }}</span>
          </button>
        </li>
      </ul>
    </ModalSheet>
  </div>
</template>
