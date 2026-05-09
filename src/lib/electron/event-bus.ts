type PhantomEventPayload<T = unknown> = {
  event: string;
  payload: T;
};

type Handler<T = unknown> = (event: PhantomEventPayload<T>) => void;

const listeners = new Map<string, Set<Handler>>();

let ipcInitialized = false;

function ensureIpcListener() {
  if (ipcInitialized || !window.phantom?.onEvent) return;
  ipcInitialized = true;
  window.phantom.onEvent(({ event, payload }) => {
    emitPhantomEvent(event, payload);
  });
}

export function emitPhantomEvent<T = unknown>(event: string, payload: T) {
  const eventListeners = listeners.get(event);
  if (!eventListeners) return;
  for (const handler of eventListeners) {
    handler({ event, payload });
  }
}

export function listenToPhantomEvent<T = unknown>(
  event: string,
  handler: Handler<T>
) {
  ensureIpcListener();
  const eventListeners = listeners.get(event) || new Set<Handler>();
  eventListeners.add(handler as Handler);
  listeners.set(event, eventListeners);
  return () => {
    eventListeners.delete(handler as Handler);
    if (eventListeners.size === 0) {
      listeners.delete(event);
    }
  };
}
