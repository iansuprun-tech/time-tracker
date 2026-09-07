<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const token = String(route.params.token);
const { loggedIn, fetch: refreshSession } = useUserSession();

const { data: info, error: infoError } = await useAsyncData(`invite-${token}`, () =>
  $fetch<{ inviterName: string; used: boolean; expired: boolean }>("/api/invites/info", {
    method: "POST",
    body: { token },
  }),
);

const name = ref("");
const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);
// у кого уже есть аккаунт — переключается на вход
const hasAccount = ref(false);

const broken = computed(() => Boolean(infoError.value) || info.value?.used || info.value?.expired);
const brokenReason = computed(() => {
  if (infoError.value) return "Ссылка не найдена.";
  if (info.value?.used) return "Этой ссылкой уже воспользовались.";
  if (info.value?.expired) return "Срок действия ссылки истёк.";
  return "";
});

async function accept() {
  await $fetch<{ ok: boolean }>("/api/invites/accept", { method: "POST", body: { token } });
  await navigateTo("/friends");
}

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    if (loggedIn.value) {
      await accept();
      return;
    }

    const url = hasAccount.value ? "/api/auth/login" : "/api/auth/register";
    const body = hasAccount.value
      ? { email: email.value, password: password.value }
      : { name: name.value, email: email.value, password: password.value };

    await $fetch(url, { method: "POST", body });
    await refreshSession();
    await accept();
  } catch (e) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? "Не получилось";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="mx-auto max-w-sm px-4 py-16">
    <template v-if="broken">
      <h1 class="mb-2 text-xl font-semibold">Ссылка не работает</h1>
      <p class="mb-6 text-sm text-black/60 dark:text-white/60">{{ brokenReason }}</p>
      <NuxtLink to="/" class="underline underline-offset-4">На главную</NuxtLink>
    </template>

    <template v-else>
      <h1 class="mb-2 text-xl font-semibold">{{ info?.inviterName }} приглашает вас</h1>
      <p class="mb-6 text-sm text-black/60 dark:text-white/60">
        Вы сможете видеть дни друг друга и оставлять комментарии.
      </p>

      <form class="space-y-3" @submit.prevent="submit">
        <template v-if="!loggedIn">
          <input
            v-if="!hasAccount"
            v-model="name"
            placeholder="имя"
            class="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="почта"
            class="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
          <input
            v-model="password"
            type="password"
            :autocomplete="hasAccount ? 'current-password' : 'new-password'"
            :placeholder="hasAccount ? 'пароль' : 'пароль, минимум 8 символов'"
            class="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
        </template>

        <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

        <button
          :disabled="busy"
          class="w-full rounded bg-emerald-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {{ loggedIn ? "Принять приглашение" : hasAccount ? "Войти и принять" : "Создать аккаунт и принять" }}
        </button>
      </form>

      <p v-if="!loggedIn" class="mt-4 text-sm text-black/50 dark:text-white/50">
        <button class="underline underline-offset-4" @click="hasAccount = !hasAccount">
          {{ hasAccount ? "У меня ещё нет аккаунта" : "У меня уже есть аккаунт" }}
        </button>
      </p>
    </template>
  </main>
</template>
