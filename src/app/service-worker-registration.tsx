"use client";

import { useEffect } from "react";

/**
 * Activates a waiting service worker if it is the only client and reloads the page.
 * @param waitingWorker {ServiceWorker} The waiting service worker to be activated.
 * @returns void
 */
function activateWaitingWorkerOnLaunch(waitingWorker: ServiceWorker) {
  let activationApproved = false;

  const reloadIfActivated = () => {
    if (!activationApproved || waitingWorker.state !== "activated") {
      return;
    }

    navigator.serviceWorker.removeEventListener("message", onMessage);
    waitingWorker.removeEventListener("statechange", reloadIfActivated);
    window.location.reload();
  };

  /**
   * Handles messages from the waiting service worker regarding activation approval or deferral.
   * @param event {MessageEvent<unknown>} The message event from the service worker.
   * @returns void
   */
  const onMessage = (event: MessageEvent<unknown>) => {
    if (
      event.source !== waitingWorker ||
      typeof event.data !== "object" ||
      event.data === null ||
      !("type" in event.data)
    ) {
      return;
    }

    if (event.data.type === "ACTIVATION_DEFERRED") {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      waitingWorker.removeEventListener("statechange", reloadIfActivated);
      return;
    }

    if (event.data.type === "ACTIVATION_APPROVED") {
      activationApproved = true;
      reloadIfActivated();
    }
  };

  navigator.serviceWorker.addEventListener("message", onMessage);
  waitingWorker.addEventListener("statechange", reloadIfActivated);
  waitingWorker.postMessage({ type: "ACTIVATE_IF_SOLE_CLIENT" });
}

/**
 * Registers the service worker and checks for updates on page load.
 * @returns null
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (registration.waiting) {
          activateWaitingWorkerOnLaunch(registration.waiting);
        }

        return registration.update();
      })
      .catch((error: unknown) => {
        console.error("Service worker registration or update check failed.", error);
      });
  }, []);

  return null;
}
