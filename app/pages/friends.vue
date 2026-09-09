<script setup lang="ts">
const { data, refresh } = await useFetch("/api/friends");

const email = ref("");
const message = ref("");
const busy = ref(false);
// какая именно кнопка ждёт ответ: спиннер должен крутиться на ней одной
const acting = ref<string | null>(null);
const sending = ref(false);
const creating = ref(false);

async function call(key: string, fn: () => Promise<unknown>) {
  busy.value = true;
  acting.value = key;
  try {
    await fn();
    await refresh();
  } finally {
    busy.value = false;
    acting.value = null;
  }
}

async function request() {
  if (!email.value.trim() || sending.value) return;
  message.value = "";
  sending.value = true;
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
  } finally {
    sending.value = false;
  }
}

const inviteUrl = ref("");
const inviteCopied = ref(false);

async function createInvite() {
  if (creating.value) return;
  creating.value = true;
  try {
    const res = await $fetch<{ token: string }>("/api/invites/create", { method: "POST" });
    inviteUrl.value = `${window.location.origin}/invite-${res.token}`;
    inviteCopied.value = false;
    await copyInvite();
  } finally {
    creating.value = false;
  }
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    inviteCopied.value = true;
    setTimeout(() => (inviteCopied.value = false), 2000);
  } catch {
    // буфер недоступен — ссылка остаётся на экране, её можно выделить руками
    inviteCopied.value = false;
  }
}

const respond = (id: number, accept: boolean) =>
  call(`respond:${id}`, () =>
    $fetch<{ ok: boolean }>("/api/friends/respond", { method: "POST", body: { id, accept } }),
  );
const remove = (id: number) =>
  call(`remove:${id}`, () =>
    $fetch<{ ok: boolean }>("/api/friends/remove", { method: "POST", body: { id } }),
  );
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <h1 class="mb-6 text-xl font-semibold">Друзья</h1>

    <section class="mb-6 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-medium">Пригласить по ссылке</h2>
          <p class="text-xs text-black/50 dark:text-white/50">
            Одноразовая, живёт 7 дней. Регистрироваться заранее не нужно.
          </p>
        </div>
        <button
          :disabled="creating"
          class="inline-flex shrink-0 items-center gap-1.5 rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-60"
          @click="createInvite"
        >
          <Spinner v-if="creating" />
          Создать
        </button>
      </div>

      <div v-if="inviteUrl" class="mt-3 flex gap-2">
        <input
          :value="inviteUrl"
          readonly
          class="flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button
          class="shrink-0 rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
          @click="copyInvite"
        >
          {{ inviteCopied ? "скопировано" : "копировать" }}
        </button>
      </div>
    </section>

    <h2 class="mb-2 text-sm font-medium">Добавить по почте</h2>
    <form class="mb-2 flex gap-2" @submit.prevent="request">
      <input
        v-model="email"
        type="email"
        placeholder="почта коллеги"
        class="flex-1 rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      <button
        :disabled="sending"
        class="inline-flex items-center gap-1.5 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        <Spinner v-if="sending" />
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
            class="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-xs text-white disabled:opacity-60"
            @click="respond(f.id, true)"
          >
            <Spinner v-if="acting === 'respond:' + f.id" />
            принять
          </button>
          <button
            :disabled="busy"
            class="inline-flex items-center gap-1.5 rounded border border-black/15 px-3 py-1 text-xs disabled:opacity-60 dark:border-white/20"
            @click="respond(f.id, false)"
          >
            <Spinner v-if="acting === 'respond:' + f.id" />
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
            class="inline-flex items-center gap-1.5 rounded border border-black/15 px-3 py-1 text-xs disabled:opacity-60 dark:border-white/20"
            @click="remove(f.id)"
          >
            <Spinner v-if="acting === 'remove:' + f.id" />
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
