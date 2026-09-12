<script setup lang="ts">
type Comment = {
  id: number;
  targetType: string;
  targetId: number;
  text: string;
  authorId: number;
  authorName: string;
  createdAt: string;
};

const props = defineProps<{
  targetType: "day" | "block";
  targetId: number;
  comments: Comment[];
  compact?: boolean;
}>();
const emit = defineEmits<{ added: [] }>();

const text = ref("");
const busy = ref(false);

const mine = computed(() =>
  props.comments.filter((c) => c.targetType === props.targetType && c.targetId === props.targetId),
);

function when(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function submit() {
  if (!text.value.trim() || busy.value) return;
  busy.value = true;
  try {
    await $fetch<{ ok: boolean }>("/api/comments", {
      method: "POST",
      body: { targetType: props.targetType, targetId: props.targetId, text: text.value },
    });
    text.value = "";
    emit("added");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div :class="compact ? 'text-xs' : 'text-sm'">
    <ul v-if="mine.length" class="mb-2 space-y-2">
      <li
        v-for="c in mine"
        :key="c.id"
        class="rounded bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.06]"
      >
        <div class="flex items-baseline gap-2">
          <span class="font-medium">{{ c.authorName }}</span>
          <span class="text-[11px] muted">{{ when(c.createdAt) }}</span>
        </div>
        <p class="whitespace-pre-wrap">{{ c.text }}</p>
      </li>
    </ul>

    <form class="flex gap-2" @submit.prevent="submit">
      <input
        v-model="text"
        placeholder="комментарий"
        class="field flex-1 py-1"
      />
      <button
        :disabled="busy"
        class="btn-soft px-2 py-1"
      >
        <Spinner v-if="busy" />
        ок
      </button>
    </form>
  </div>
</template>
