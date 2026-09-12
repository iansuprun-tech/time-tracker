<script setup lang="ts">
definePageMeta({ layout: false });

const email = ref("");
const sent = ref(false);
const error = ref("");
const busy = ref(false);

async function submit() {
  if (!email.value.trim() || busy.value) return;
  error.value = "";
  busy.value = true;
  try {
    await $fetch("/api/auth/forgot", { method: "POST", body: { email: email.value } });
    sent.value = true;
  } catch (e) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? "Не получилось отправить";
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
      <h1 class="mb-2 text-lg font-semibold">Забыли пароль</h1>

      <template v-if="sent">
        <p class="text-sm muted">
          Если такой адрес у нас есть, письмо со ссылкой уже в пути. Ссылка живёт час
          и работает один раз.
        </p>
      </template>

      <template v-else>
        <p class="mb-4 text-sm muted">Пришлём ссылку для смены пароля.</p>
        <form class="space-y-3" @submit.prevent="submit">
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="почта"
            class="field w-full"
          />
          <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
          <button :disabled="busy" class="btn-primary w-full py-3">
            <Spinner v-if="busy" />
            Прислать ссылку
          </button>
        </form>
      </template>
    </div>

    <p class="mt-4 text-center text-sm muted">
      <NuxtLink to="/login" class="underline underline-offset-4">Вернуться ко входу</NuxtLink>
    </p>
  </main>
</template>
