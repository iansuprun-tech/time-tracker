const PUBLIC = ["/login", "/register"];

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();

  if (!loggedIn.value && !PUBLIC.includes(to.path)) return navigateTo("/login");
  if (loggedIn.value && PUBLIC.includes(to.path)) return navigateTo("/");
});
