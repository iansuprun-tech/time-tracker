<script setup lang="ts">
const route = useRoute();
const ownerId = computed(() => Number(route.params.id));
</script>

<template>
  <DayBoard :owner-id="ownerId" />
</template>
