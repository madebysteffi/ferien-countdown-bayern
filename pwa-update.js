/* Update lifecycle is separate from the countdown and has no UI changes. */
(() => {
  if (!("serviceWorker" in navigator)) return;

  const serviceWorker = navigator.serviceWorker;
  // First installation claims the page too; that alone needs no reload.
  let hadController = Boolean(serviceWorker.controller);
  let reloadPending = false;
  let reloading = false;
  let registration;
  let checking = false;
  let lastCheck = 0;
  const CHECK_INTERVAL = 60 * 1000;

  function reloadIfVisible() {
    if (!reloadPending || reloading || document.visibilityState !== "visible") return;
    reloading = true;
    window.location.reload();
  }

  serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) reloadPending = true;
    hadController = true;
    reloadIfVisible();
  });

  async function checkForUpdate() {
    if (!registration || checking || document.visibilityState !== "visible" ||
        !navigator.onLine || Date.now() - lastCheck < CHECK_INTERVAL) return;
    checking = true;
    lastCheck = Date.now();
    try {
      await registration.update();
    } catch (error) {
      // Offline or temporarily unavailable: keep the existing working app.
      console.warn("Update check unavailable", error);
    } finally {
      checking = false;
    }
  }

  document.addEventListener("visibilitychange", () => {
    reloadIfVisible();
    if (document.visibilityState === "visible") checkForUpdate();
  });
  window.addEventListener("pageshow", () => {
    reloadIfVisible();
    checkForUpdate();
  });
  window.addEventListener("online", checkForUpdate);

  async function register() {
    try {
      registration = await serviceWorker.register("./service-worker.js", {
        updateViaCache: "none"
      });
      await checkForUpdate();
    } catch (error) {
      console.warn("Service worker registration unavailable", error);
    }
  }

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
})();
