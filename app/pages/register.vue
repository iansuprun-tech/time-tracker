<script setup lang="ts">
definePageMeta({ layout: false });

const { fetch: refreshSession } = useUserSession();

const name = ref("");
const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    await $fetch("/api/auth/register", {
      method: "POST",
      body: { name: name.value, email: email.value, password: password.value },
    });
    await refreshSession();
    await navigateTo("/");
  } catch (e) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? "Не получилось зарегистрироваться";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="mx-auto flex w-full max-w-sm flex-col justify-center px-4 py-16">
      <div class="mb-6 flex items-center justify-center gap-2.5">
        <svg viewBox="0 0 24 24" class="size-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
        <span class="text-lg font-semibold tracking-tight">Трекер дня</span>
      </div>

    <div class="card card-pad">
      <h1 class="mb-4 text-lg font-semibold">Регистрация</h1>

    <form class="space-y-3" @submit.prevent="submit">
      <input
        v-model="name"
        placeholder="имя"
        class="field w-full"
      />
      <input
        v-model="email"
        type="email"
        autocomplete="email"
        placeholder="почта"
        class="field w-full"
      />
      <input
        v-model="password"
        type="password"
        autocomplete="new-password"
        placeholder="пароль, минимум 8 символов"
        class="field w-full"
      />
      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <button
        :disabled="busy"
        class="btn-primary w-full py-3"
      >
        <Spinner v-if="busy" />
        Создать аккаунт
      </button>
    </form>
    </div>

    <p class="mt-4 text-sm muted">
      Уже есть аккаунт?
      <NuxtLink to="/login" class="underline underline-offset-4">Войти</NuxtLink>
    </p>
  </main>
</template>
