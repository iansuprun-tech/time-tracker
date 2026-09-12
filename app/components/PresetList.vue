<script setup lang="ts">
/** Список шаблонов одного вида: добавить, переименовать, убрать */
const props = defineProps<{
  kind: "category" | "place";
  title: string;
  hint: string;
  items: { id: number; name: string }[];
  reload: () => Promise<void>;
}>();

const adding = ref("");
const editingId = ref<number | null>(null);
const draft = ref("");
const busy = ref(false);
const error = ref("");

async function call(fn: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await fn();
    await props.reload();
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? "Не сохранилось";
  } finally {
    busy.value = false;
  }
}

function add() {
  if (!adding.value.trim()) return;
  return call(async () => {
    await $fetch<unknown>("/api/presets", {
      method: "POST",
      body: { kind: props.kind, name: adding.value },
    });
    adding.value = "";
  });
}

function edit(item: { id: number; name: string }) {
  editingId.value = item.id;
  draft.value = item.name;
}

function save() {
  if (!draft.value.trim()) return;
  return call(async () => {
    await $fetch<{ ok: boolean }>("/api/presets/update", {
      method: "POST",
      body: { id: editingId.value, name: draft.value },
    });
    editingId.value = null;
  });
}

const remove = (id: number) =>
  call(() => $fetch<{ ok: boolean }>("/api/presets/delete", { method: "POST", body: { id } }));
</script>

<template>
  <section class="card card-pad">
    <h2 class="font-medium">{{ title }}</h2>
    <p class="mt-0.5 text-xs text-black/50 dark:text-white/50">{{ hint }}</p>

    <ul v-if="items.length" class="mt-3 space-y-1.5">
      <li v-for="item in items" :key="item.id" class="flex items-center gap-2 text-sm">
        <form v-if="editingId === item.id" class="flex flex-1 items-center gap-2" @submit.prevent="save">
          <input
            v-model="draft"
            autofocus
            class="field min-w-0 flex-1 py-1"
          />
          <button
            :disabled="busy"
            class="btn-soft px-2 py-1 text-xs"
          >
            <Spinner v-if="busy" />
            ок
          </button>
          <button
            type="button"
            class="text-xs text-black/40 dark:text-white/40"
            @click="editingId = null"
          >
            отмена
          </button>
        </form>

        <template v-else>
          <span class="flex-1 truncate">{{ item.name }}</span>
          <button
            class="text-xs text-black/50 underline underline-offset-4 dark:text-white/50"
            @click="edit(item)"
          >
            переименовать
          </button>
          <button
            :disabled="busy"
            class="btn-soft px-2 py-1 text-xs"
            @click="remove(item.id)"
          >
            ✕
          </button>
        </template>
      </li>
    </ul>

    <p v-else class="mt-3 text-sm text-black/40 dark:text-white/40">Пусто.</p>

    <form class="mt-3 flex gap-2" @submit.prevent="add">
      <input
        v-model="adding"
        placeholder="добавить"
        class="field min-w-0 flex-1 py-1"
      />
      <button
        :disabled="busy"
        class="btn-soft px-3 py-1"
      >
        <Spinner v-if="busy" />
        +
      </button>
    </form>

    <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
  </section>
</template>
