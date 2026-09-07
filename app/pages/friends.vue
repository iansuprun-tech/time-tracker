<script setup lang="ts">
const { data, refresh } = await useFetch("/api/friends");

const email = ref("");
const message = ref("");
const busy = ref(false);

async function call(fn: () => Promise<unknown>) {
  busy.value = true;
  try {
    await fn();
    await refresh();
  } finally {
    busy.value = false;
  }
}

async function request() {
  if (!email.value.trim()) return;
  message.value = "";
  try {
    const res = await $fetch<{ status: string }>("/api/friends/request", {
      method: "POST",
      body: { email: email.value },
    });
    message.value = res.status === "accepted" ? "Уже друзья — заявка была встречной" : "Заявка отправлена";
    email.value = "";
    await refresh();
  } catch (e) {
    message.value = (e as { data?: { message?: string } })?.data?.message ?? "Не получилось";
  }
}

const respond = (id: number, accept: boolean) =>
  call(() => $fetch<{ ok: boolean }>("/api/friends/respond", { method: "POST", body: { id, accept } }));
const remove = (id: number) =>
  call(() => $fetch<{ ok: boolean }>("/api/friends/remove", { method: "POST", body: { id } }));
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <h1 class="mb-6 text-xl font-semibold">Друзья</h1>

    <form class="mb-2 flex gap-2" @submit.prevent="request">
      <input
        v-model="email"
        type="email"
        placeholder="почта коллеги"
        class="flex-1 rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      <button class="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
        Добавить
      </button>
    </form>
    <p v-if="message" class="mb-6 text-sm text-black/60 dark:text-white/60">{{ message }}</p>

    <section v-if="data?.incoming.length" class="mb-6">
      <h2 class="mb-2 text-sm font-medium">Входящие заявки</h2>
      <ul class="space-y-2">
        <li
          v-for="f in data.incoming"
          :key="f.id"
          class="flex items-center gap-3 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15"
        >
          <span class="flex-1">{{ f.name }} <span class="text-black/40 dark:text-white/40">{{ f.email }}</span></span>
          <button
            :disabled="busy"
            class="rounded bg-emerald-600 px-3 py-1 text-xs text-white"
            @click="respond(f.id, true)"
          >
            принять
          </button>
          <button
            :disabled="busy"
            class="rounded border border-black/15 px-3 py-1 text-xs dark:border-white/20"
            @click="respond(f.id, false)"
          >
            отклонить
          </button>
        </li>
      </ul>
    </section>

    <section class="mb-6">
      <h2 class="mb-2 text-sm font-medium">Мои друзья</h2>
      <ul v-if="data?.friends.length" class="space-y-2">
        <li
          v-for="f in data.friends"
          :key="f.id"
          class="flex items-center gap-3 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15"
        >
          <NuxtLink :to="`/u-${f.userId}`" class="flex-1 underline underline-offset-4">
            {{ f.name }}
          </NuxtLink>
          <button
            :disabled="busy"
            class="rounded border border-black/15 px-3 py-1 text-xs dark:border-white/20"
            @click="remove(f.id)"
          >
            удалить
          </button>
        </li>
      </ul>
      <p v-else class="text-sm text-black/40 dark:text-white/40">
        Пока никого. Добавьте коллегу по почте — после подтверждения увидите его дни.
      </p>
    </section>

    <section v-if="data?.outgoing.length">
      <h2 class="mb-2 text-sm font-medium">Отправленные заявки</h2>
      <ul class="space-y-2 text-sm text-black/60 dark:text-white/60">
        <li v-for="f in data.outgoing" :key="f.id">{{ f.name }} — ждём ответа</li>
      </ul>
    </section>
  </main>
</template>
