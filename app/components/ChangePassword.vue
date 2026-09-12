<script setup lang="ts">
const current = ref("");
const next = ref("");
const message = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  if (busy.value) return;
  error.value = "";
  message.value = "";
  busy.value = true;
  try {
    await $fetch<{ ok: boolean }>("/api/auth/password", {
      method: "POST",
      body: { current: current.value, next: next.value },
    });
    current.value = "";
    next.value = "";
    message.value = "Пароль сменён";
  } catch (e) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? "Не получилось";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card card-pad">
    <h2 class="font-medium">Пароль</h2>
    <p class="mt-0.5 text-xs muted">
      Забытый пароль меняется по ссылке из письма — на странице входа есть «Забыли пароль?».
    </p>

    <form class="mt-3 flex flex-wrap gap-2" @submit.prevent="submit">
      <input
        v-model="current"
        type="password"
        autocomplete="current-password"
        placeholder="текущий"
        class="field min-w-36 flex-1"
      />
      <input
        v-model="next"
        type="password"
        autocomplete="new-password"
        placeholder="новый, от 8 символов"
        class="field min-w-44 flex-1"
      />
      <button :disabled="busy" class="btn-soft">
        <Spinner v-if="busy" />
        Сменить
      </button>
    </form>

    <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-else-if="message" class="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{{ message }}</p>
  </section>
</template>
