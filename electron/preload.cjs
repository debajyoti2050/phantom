const { contextBridge, ipcRenderer } = require("electron");

const windowLabelArg = process.argv.find((arg) =>
  arg.startsWith("--phantom-window-label=")
);
const windowLabel = windowLabelArg
  ? windowLabelArg.replace("--phantom-window-label=", "")
  : "main";

contextBridge.exposeInMainWorld("phantom", {
  windowLabel,
  invoke: (command, args = {}) => ipcRenderer.invoke("phantom:invoke", command, args),
  openExternal: (url) => ipcRenderer.invoke("phantom:open-external", url),
  onEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("phantom:event", listener);
    return () => ipcRenderer.removeListener("phantom:event", listener);
  },
  window: {
    openDashboard: () => ipcRenderer.invoke("phantom:invoke", "open_dashboard", {}),
    toggleDashboard: () => ipcRenderer.invoke("phantom:invoke", "toggle_dashboard", {}),
    move: (direction, step = 12) =>
      ipcRenderer.invoke("phantom:invoke", "move_window", { direction, step }),
    setAlwaysOnTop: (enabled) =>
      ipcRenderer.invoke("phantom:invoke", "set_always_on_top", { enabled }),
    setTaskbarVisible: (visible) =>
      ipcRenderer.invoke("phantom:invoke", "set_app_icon_visibility", { visible }),
    resizeOverlay: (height) =>
      ipcRenderer.invoke("phantom:invoke", "set_window_height", { height }),
  },
  shortcuts: {
    update: (config) => ipcRenderer.invoke("phantom:invoke", "update_shortcuts", { config }),
    registered: () => ipcRenderer.invoke("phantom:invoke", "get_registered_shortcuts", {}),
  },
  capture: {
    fullscreen: () => ipcRenderer.invoke("phantom:invoke", "capture_to_base64", {}),
    selectArea: () => ipcRenderer.invoke("phantom:invoke", "start_screen_capture", {}),
    close: () => ipcRenderer.invoke("phantom:invoke", "close_overlay_window", {}),
  },
  audio: {
    checkSystemAccess: () =>
      ipcRenderer.invoke("phantom:invoke", "check_system_audio_access", {}),
    requestSystemAccess: () =>
      ipcRenderer.invoke("phantom:invoke", "request_system_audio_access", {}),
    startSystemLoopback: () =>
      ipcRenderer.invoke("phantom:invoke", "start_system_audio_capture", {}),
    stopSystemLoopback: () =>
      ipcRenderer.invoke("phantom:invoke", "stop_system_audio_capture", {}),
  },
  db: {
    execute: (sql, params = []) =>
      ipcRenderer.invoke("phantom:invoke", "db_execute", { sql, params }),
    select: (sql, params = []) =>
      ipcRenderer.invoke("phantom:invoke", "db_select", { sql, params }),
  },
  http: {
    fetch: (request) => ipcRenderer.invoke("phantom:http-fetch", request),
    abort: (requestId) => ipcRenderer.invoke("phantom:http-abort", requestId),
  },
});
