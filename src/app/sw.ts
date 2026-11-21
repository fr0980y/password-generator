/// <reference lib="esnext" />
/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

function isClient(
  source: ExtendableMessageEvent["source"],
): source is Client {
  return source !== null && "id" in source;
}

function handleActivationRequest(event: ExtendableMessageEvent) {
  if (event.data?.type !== "ACTIVATE_IF_SOLE_CLIENT" || !isClient(event.source)) {
    return;
  }

  // Never activate an update while another window may still use the old version.
  const requestingClient = event.source;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      if (clients.length !== 1 || clients[0].id !== requestingClient.id) {
        requestingClient.postMessage({ type: "ACTIVATION_DEFERRED" });
        return;
      }

      requestingClient.postMessage({ type: "ACTIVATION_APPROVED" });
      await self.skipWaiting();
    })(),
  );
}

self.addEventListener("message", handleActivationRequest);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: false,
  runtimeCaching: [],
  precacheOptions: {
    cleanupOutdatedCaches: true,
    navigateFallback: "/",
    navigateFallbackAllowlist: [/^\/$/],
  },
});

serwist.addEventListeners();
