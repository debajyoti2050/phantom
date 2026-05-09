export {};

declare global {
  type PhantomHttpBody =
    | { kind: "none" }
    | { kind: "text"; value: string }
    | { kind: "blob"; base64: string; type?: string }
    | {
        kind: "formData";
        entries: Array<{
          name: string;
          value?: string;
          file?: { base64: string; type?: string; name?: string };
        }>;
      };

  interface Window {
    phantom: {
      windowLabel: string;
      invoke: <T = unknown>(
        command: string,
        args?: Record<string, unknown>
      ) => Promise<T>;
      openExternal: (url: string) => Promise<void>;
      onEvent: (
        callback: (event: { event: string; payload: unknown }) => void
      ) => () => void;
      window: {
        openDashboard: () => Promise<void>;
        toggleDashboard: () => Promise<void>;
        move: (direction: string, step?: number) => Promise<void>;
        setAlwaysOnTop: (enabled: boolean) => Promise<void>;
        setTaskbarVisible: (visible: boolean) => Promise<void>;
        resizeOverlay: (height: number) => Promise<void>;
      };
      shortcuts: {
        update: (config: unknown) => Promise<void>;
        registered: () => Promise<Record<string, string>>;
      };
      capture: {
        fullscreen: () => Promise<string>;
        selectArea: () => Promise<void>;
        close: () => Promise<void>;
      };
      audio: {
        checkSystemAccess: () => Promise<boolean>;
        requestSystemAccess: () => Promise<void>;
        startSystemLoopback: () => Promise<void>;
        stopSystemLoopback: () => Promise<void>;
      };
      db: {
        execute: (
          sql: string,
          params?: unknown[]
        ) => Promise<{ rowsAffected: number; lastInsertId: number }>;
        select: <T = unknown>(sql: string, params?: unknown[]) => Promise<T>;
      };
      http: {
        fetch: (request: {
          id: string;
          url: string;
          init?: {
            method?: string;
            headers?: Record<string, string>;
            body?: PhantomHttpBody;
          };
        }) => Promise<{
          status: number;
          statusText: string;
          ok: boolean;
          headers: Record<string, string>;
        }>;
        abort: (requestId: string) => Promise<void>;
      };
    };
  }
}
