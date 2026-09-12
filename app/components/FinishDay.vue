<script setup lang="ts">
const props = defineProps<{ date: string; mood: number | null; dayNote: string | null }>();
const emit = defineEmits<{ finished: [] }>();

const MOODS = [
  { value: 1, emoji: "😞", label: "тяжело" },
  { value: 2, emoji: "😕", label: "так себе" },
  { value: 3, emoji: "😐", label: "ровно" },
  { value: 4, emoji: "🙂", label: "хорошо" },
  { value: 5, emoji: "😄", label: "отлично" },
];

const mood = ref<number | null>(props.mood);
const dayNote = ref(props.dayNote ?? "");
const busy = ref(false);

async function finish() {
  busy.value = true;
  try {
    await $fetch<{ ok: boolean }>("/api/day/finish", {
      method: "POST",
      body: { date: props.date, mood: mood.value, dayNote: dayNote.value },
    });
    emit("finished");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card card-pad">
    <h2 class="mb-3 font-medium">Как прошёл день?</h2>

    <div class="mb-3 flex gap-2">
      <button
        v-for="m in MOODS"
        :key="m.value"
        :title="m.label"
        class="flex-1 rounded-lg border py-2 text-xl transition"
        :class="
          mood === m.value
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-black/10 dark:border-white/15'
        "
        @click="mood = mood === m.value ? null : m.value"
      >
        {{ m.emoji }}
      </button>
    </div>

    <textarea
      v-model="dayNote"
      rows="3"
      placeholder="что запомнилось, что мешало, что понял"
      class="field mb-3 w-full"
    />

    <button
      :disabled="busy"
      class="btn-primary w-full py-3"
      @click="finish"
    >
      <Spinner v-if="busy" />
      Завершить день
    </button>
  </section>
</template>
