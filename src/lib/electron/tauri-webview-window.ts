import { listenToPhantomEvent } from "./event-bus";

export function getCurrentWebviewWindow() {
  return {
    label: window.phantom.windowLabel,
    async onFocusChanged(
      handler: (event: { payload: boolean }) => void
    ): Promise<() => void> {
      return listenToPhantomEvent<boolean>("focus-changed", (event) =>
        handler({ payload: event.payload })
      );
    },
  };
}
