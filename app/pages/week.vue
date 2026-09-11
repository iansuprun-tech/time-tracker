<script setup lang="ts">
const route = useRoute();
// чужая неделя открывается тем же экраном: /week?userId=7
const ownerId = computed(() => (route.query.userId ? Number(route.query.userId) : undefined));
</script>

<template>
  <WeekCalendar :key="ownerId ?? 0" :owner-id="ownerId" />
</template>
