<script setup lang="ts">
const props = defineProps<{ since: string; baseMin: number }>();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onUnmounted(() => clearInterval(timer));

// сервер отдаёт точку отсчёта, клиент только рисует —
// иначе после сна ноутбука накапливается расхождение
const label = computed(() => {
  const sec = Math.max(0, Math.floor((now.value - new Date(props.since).getTime()) / 1000));
  const total = props.baseMin * 60 + sec;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
});
</script>

<template>
  <span class="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{{ label }}</span>
</template>
