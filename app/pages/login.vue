<script setup lang="ts">
definePageMeta({ layout: false });

const { fetch: refreshSession } = useUserSession();

const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    await $fetch("/api/auth/login", { method: "POST", body: { email: email.value, password: password.value } });
    await refreshSession();
    await navigateTo("/");
  } catch (e) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? "Не получилось войти";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="mx-auto max-w-sm px-4 py-16">
    <h1 class="mb-6 text-xl font-semibold">Вход</h1>

    <form class="space-y-3" @submit.prevent="submit">
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
        autocomplete="current-password"
        placeholder="пароль"
        class="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <button
        :disabled="busy"
        class="inline-flex w-full items-center justify-center gap-2 rounded bg-black px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        <Spinner v-if="busy" />
        Войти
      </button>
    </form>

    <p class="mt-4 text-sm text-black/50 dark:text-white/50">
      Нет аккаунта?
      <NuxtLink to="/register" class="underline underline-offset-4">Зарегистрироваться</NuxtLink>
    </p>
  </main>
</template>
