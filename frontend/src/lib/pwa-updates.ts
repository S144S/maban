/** Register once per page; updates stay waiting until the user accepts. */
export function watchPwaUpdates(onWaiting: (worker: ServiceWorker | null) => void) {
  let disposed = false;
  let registration: ServiceWorkerRegistration | undefined;
  let lastCheck = 0;
  const cleanups: Array<() => void> = [];
  const reportWaiting = () => {
    if (!disposed) onWaiting(registration?.active ? registration.waiting : null);
  };
  const watchInstalling = () => {
    const worker = registration?.installing;
    if (!worker) return;
    const changed = () => {
      if (worker.state === "installed" || worker.state === "redundant") reportWaiting();
    };
    worker.addEventListener("statechange", changed);
    cleanups.push(() => worker.removeEventListener("statechange", changed));
  };
  const check = () => {
    if (!registration || document.visibilityState === "hidden" || !navigator.onLine) return;
    if (Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    // Connectivity failures must not interrupt the app; the next check retries.
    void registration.update().catch(() => {});
  };
  void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(result => {
      if (disposed) return;
      registration = result;
      reportWaiting();
      watchInstalling();
      result.addEventListener("updatefound", watchInstalling);
      navigator.serviceWorker.addEventListener("controllerchange", reportWaiting);
      document.addEventListener("visibilitychange", check);
      window.addEventListener("online", check);
      window.addEventListener("focus", check);
      const interval = window.setInterval(check, 60_000);
      cleanups.push(() => {
        result.removeEventListener("updatefound", watchInstalling);
        navigator.serviceWorker.removeEventListener("controllerchange", reportWaiting);
        document.removeEventListener("visibilitychange", check);
        window.removeEventListener("online", check);
        window.removeEventListener("focus", check);
        window.clearInterval(interval);
      });
      check();
    }).catch(() => {});
  return () => {
    disposed = true;
    cleanups.forEach(cleanup => cleanup());
  };
}

/** Only the consenting tab reloads; other open forms remain untouched. */
export function activatePwaUpdate(worker: ServiceWorker): Promise<void> {
  if (!navigator.onLine) return Promise.reject(new Error("An online connection is required"));
  return new Promise((resolve, reject) => {
    const container = navigator.serviceWorker;
    const cleanup = () => {
      window.clearTimeout(timeout);
      container.removeEventListener("controllerchange", activated);
    };
    const activated = () => {
      cleanup();
      resolve();
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Update activation timed out"));
    }, 15_000);
    container.addEventListener("controllerchange", activated);
    if (worker.state === "activated") {
      activated();
    } else if (worker.state === "redundant") {
      cleanup();
      reject(new Error("Update is no longer available"));
    } else {
      try {
        worker.postMessage({ type: "ACTIVATE_UPDATE" });
      } catch (error) {
        cleanup();
        reject(error);
      }
    }
  });
}
