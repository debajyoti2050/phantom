import { listenToPhantomEvent } from "./event-bus";

export type UnlistenFn = () => void;

export async function listen<T = unknown>(
  event: string,
  handler: (event: { event: string; payload: T }) => void
): Promise<UnlistenFn> {
  return listenToPhantomEvent<T>(event, handler);
}
