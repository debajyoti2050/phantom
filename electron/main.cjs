const {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  safeStorage,
  screen,
  session,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { Blob } = require("node:buffer");
const initSqlJs = require("sql.js");

const DEV_URL = process.env.PHANTOM_DEV_URL || "http://127.0.0.1:1420";
const TOP_OFFSET = 54;
const MAIN_WINDOW_WIDTH = 560;
const MAIN_WINDOW_COLLAPSED_HEIGHT = 52;
const MAIN_WINDOW_EXPANDED_FALLBACK_HEIGHT = 720;

let mainWindow;
let dashboardWindow;
let responseWindow;
let lastResponseWindowState = null;
let sqlPromise;
let sqlDb;
let registeredShortcuts = new Map();
let captureImages = new Map();
let secureStorageCache;
let activeHttpRequests = new Map();
const DB_FILE_NAME = "phantom.db";
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

function isDev() {
  return !app.isPackaged;
}

function getPreloadPath() {
  return path.join(__dirname, "preload.cjs");
}

function getAppIcon() {
  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
  const iconPath = path.join(app.getAppPath(), "build", iconFile);
  if (!fs.existsSync(iconPath)) return undefined;
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

function getIndexUrl(route = "/") {
  if (isDev()) {
    return `${DEV_URL}/#${route}`;
  }
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  return `file://${indexPath.replace(/\\/g, "/")}#${route}`;
}

function sendToWindow(win, event, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("phantom:event", { event, payload });
  }
}

function emitToAll(event, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    sendToWindow(win, event, payload);
  }
}

function normalizeHttpHeaders(headers = {}) {
  if (!headers || typeof headers !== "object") return {};
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined && value !== null)
  );
}

function removeHeader(headers, name) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      delete headers[key];
    }
  }
}

function buildHttpBody(serializedBody, headers) {
  if (!serializedBody || serializedBody.kind === "none") return undefined;
  if (serializedBody.kind === "text") return serializedBody.value || "";
  if (serializedBody.kind === "blob") {
    const bytes = Buffer.from(serializedBody.base64 || "", "base64");
    return new Blob([bytes], { type: serializedBody.type || "application/octet-stream" });
  }
  if (serializedBody.kind === "formData") {
    removeHeader(headers, "content-type");
    const form = new FormData();
    for (const entry of serializedBody.entries || []) {
      if (entry.file) {
        const bytes = Buffer.from(entry.file.base64 || "", "base64");
        const blob = new Blob([bytes], {
          type: entry.file.type || "application/octet-stream",
        });
        form.append(entry.name, blob, entry.file.name || "file");
      } else {
        form.append(entry.name, entry.value ?? "");
      }
    }
    return form;
  }
  return undefined;
}

async function streamHttpResponse(requestId, response) {
  try {
    if (!response.body) {
      emitToAll(`http-stream:${requestId}`, { type: "end" });
      return;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      emitToAll(`http-stream:${requestId}`, {
        type: "chunk",
        chunk: Buffer.from(value).toString("base64"),
      });
    }
    emitToAll(`http-stream:${requestId}`, { type: "end" });
  } catch (error) {
    emitToAll(`http-stream:${requestId}`, {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeHttpRequests.delete(requestId);
  }
}

async function handleHttpFetch(request) {
  const requestId = request?.id;
  const url = request?.url;
  if (!requestId || !url) {
    throw new Error("HTTP request id and URL are required");
  }

  const init = request.init || {};
  const headers = normalizeHttpHeaders(init.headers);
  const body = buildHttpBody(init.body, headers);
  const controller = new AbortController();
  activeHttpRequests.set(requestId, controller);

  let response;
  try {
    response = await fetch(url, {
      method: init.method || "GET",
      headers,
      body: ["GET", "HEAD"].includes(String(init.method || "GET").toUpperCase())
        ? undefined
        : body,
      signal: controller.signal,
    });
  } catch (error) {
    activeHttpRequests.delete(requestId);
    throw error;
  }

  streamHttpResponse(requestId, response);

  return {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

function positionMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const bounds = display.workArea;
  const [width] = mainWindow.getSize();
  mainWindow.setPosition(
    Math.round(bounds.x + (bounds.width - width) / 2),
    Math.round(bounds.y + TOP_OFFSET)
  );
}

function clampMainWindowHeight(height) {
  const display = screen.getPrimaryDisplay();
  const maxHeight = Math.max(
    MAIN_WINDOW_COLLAPSED_HEIGHT,
    display.workArea.height - TOP_OFFSET - 8
  );
  const requestedHeight = Number.isFinite(Number(height))
    ? Number(height)
    : MAIN_WINDOW_EXPANDED_FALLBACK_HEIGHT;

  return Math.round(
    Math.min(
      Math.max(requestedHeight, MAIN_WINDOW_COLLAPSED_HEIGHT),
      maxHeight
    )
  );
}

function resizeMainWindow(height) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const nextHeight = clampMainWindowHeight(height);
  const [currentX, currentY] = mainWindow.getPosition();
  mainWindow.setBounds(
    {
      x: currentX,
      y: currentY,
      width: MAIN_WINDOW_WIDTH,
      height: nextHeight,
    },
    false
  );
}

function getResponseWindowBounds() {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const mainBounds =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.getBounds()
      : {
          x: Math.round(workArea.x + (workArea.width - MAIN_WINDOW_WIDTH) / 2),
          y: Math.round(workArea.y + TOP_OFFSET),
          width: MAIN_WINDOW_WIDTH,
          height: MAIN_WINDOW_COLLAPSED_HEIGHT,
        };
  const gap = 8;
  const y = mainBounds.y + MAIN_WINDOW_COLLAPSED_HEIGHT + gap;
  const maxHeight = Math.max(260, workArea.y + workArea.height - y - 12);

  return {
    x: mainBounds.x,
    y,
    width: MAIN_WINDOW_WIDTH,
    height: Math.min(560, maxHeight),
  };
}

function syncResponseWindowToMain() {
  if (responseWindow && !responseWindow.isDestroyed()) {
    responseWindow.setBounds(getResponseWindowBounds(), false);
  }
}

function createBaseWindow(label, options) {
  const appIcon = getAppIcon();
  const win = new BrowserWindow({
    ...(appIcon ? { icon: appIcon } : {}),
    ...options,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      additionalArguments: [`--phantom-window-label=${label}`],
      ...(options.webPreferences || {}),
    },
  });
  win.setMenuBarVisibility(false);
  if (["main", "dashboard", "response"].includes(label)) {
    win.setContentProtection(true);
  }
  return win;
}

function createMainWindow() {
  mainWindow = createBaseWindow("main", {
    title: "Phantom - AI Assistant",
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_COLLAPSED_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    show: true,
    skipTaskbar: true,
    alwaysOnTop: false,
    hasShadow: false,
    backgroundColor: "#00000000",
  });
  mainWindow.loadURL(getIndexUrl("/"));
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    positionMainWindow();
    mainWindow.show();
  });
  mainWindow.on("focus", () => sendToWindow(mainWindow, "focus-changed", true));
  mainWindow.on("blur", () => sendToWindow(mainWindow, "focus-changed", false));
  mainWindow.on("move", syncResponseWindowToMain);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    return dashboardWindow;
  }
  dashboardWindow = createBaseWindow("dashboard", {
    title: "Phantom - Dashboard",
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: true,
    backgroundColor: "#0a0a0a",
  });
  dashboardWindow.loadURL(getIndexUrl("/chats"));
  dashboardWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      dashboardWindow.hide();
    }
  });
  dashboardWindow.on("focus", () =>
    sendToWindow(dashboardWindow, "focus-changed", true)
  );
  dashboardWindow.on("blur", () =>
    sendToWindow(dashboardWindow, "focus-changed", false)
  );
  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });
  return dashboardWindow;
}

function createResponseWindow() {
  if (responseWindow && !responseWindow.isDestroyed()) {
    return responseWindow;
  }

  responseWindow = createBaseWindow("response", {
    title: "Phantom - Response",
    ...getResponseWindowBounds(),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
  });

  responseWindow.loadURL(getIndexUrl("/response-overlay"));
  responseWindow.on("closed", () => {
    responseWindow = null;
  });
  responseWindow.on("blur", () => sendToWindow(responseWindow, "focus-changed", false));
  responseWindow.on("focus", () => sendToWindow(responseWindow, "focus-changed", true));

  return responseWindow;
}

function updateResponseWindow(state) {
  lastResponseWindowState = state || null;

  if (!state?.open) {
    hideResponseWindow();
    return null;
  }

  const win = createResponseWindow();
  syncResponseWindowToMain();
  win.setIgnoreMouseEvents(false);
  if (mainWindow && !mainWindow.isDestroyed()) {
    win.setAlwaysOnTop(true);
  }

  const sendState = () =>
    sendToWindow(win, "response-window-state", lastResponseWindowState);

  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", sendState);
  } else {
    sendState();
  }

  if (!win.isVisible()) {
    win.showInactive();
  }

  return null;
}

function isResponseWindowVisible() {
  return Boolean(
    responseWindow &&
      !responseWindow.isDestroyed() &&
      responseWindow.isVisible()
  );
}

function hideResponseWindow(options = {}) {
  const { preserveState = false, destroy = false } = options;
  if (!preserveState) {
    lastResponseWindowState = null;
  }
  if (responseWindow && !responseWindow.isDestroyed()) {
    responseWindow.setIgnoreMouseEvents(true, { forward: true });
    responseWindow.hide();
    if (destroy) {
      responseWindow.destroy();
      responseWindow = null;
    }
  }
}

function closeResponseWindowFromShortcut() {
  sendToWindow(mainWindow, "response-window-action", { action: "close" });
  hideResponseWindow({ destroy: true });
}

function showDashboard() {
  const win = createDashboardWindow();
  win.show();
  win.focus();
}

function toggleDashboard() {
  const win = createDashboardWindow();
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
}

function normalizeAccelerator(key) {
  if (!key || typeof key !== "string") return "";
  return key
    .split("+")
    .map((part) => {
      const value = part.trim().toLowerCase();
      const map = {
        cmd: "CommandOrControl",
        command: "CommandOrControl",
        meta: "CommandOrControl",
        ctrl: "CommandOrControl",
        control: "CommandOrControl",
        shift: "Shift",
        alt: "Alt",
        option: "Alt",
        backslash: "\\",
        up: "Up",
        down: "Down",
        left: "Left",
        right: "Right",
        escape: "Esc",
        esc: "Esc",
        space: "Space",
      };
      return map[value] || value.toUpperCase();
    })
    .join("+");
}

function moveMainWindow(direction, step = 12) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [x, y] = mainWindow.getPosition();
  const next = {
    up: [x, y - step],
    down: [x, y + step],
    left: [x - step, y],
    right: [x + step, y],
  }[direction];
  if (next) {
    mainWindow.setPosition(next[0], next[1]);
    syncResponseWindowToMain();
  }
}

function handleShortcut(actionId) {
  if (actionId === "toggle_dashboard") {
    toggleDashboard();
    return;
  }
  if (actionId === "toggle_window") {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (isResponseWindowVisible()) {
      closeResponseWindowFromShortcut();
      return;
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      hideResponseWindow({ destroy: true });
      emitToAll("toggle-window-visibility", true);
    } else {
      mainWindow.show();
      mainWindow.focus();
      emitToAll("toggle-window-visibility", false);
      sendToWindow(mainWindow, "focus-text-input", {});
    }
    return;
  }
  if (actionId === "focus_input") {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      sendToWindow(mainWindow, "focus-text-input", {});
    }
    return;
  }
  if (actionId.startsWith("move_window_")) {
    moveMainWindow(actionId.replace("move_window_", ""));
    return;
  }
  if (actionId === "audio_recording") {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      sendToWindow(mainWindow, "start-audio-recording", {});
    }
    return;
  }
  if (actionId === "screenshot") {
    emitToAll("trigger-screenshot", {});
    return;
  }
  if (actionId === "system_audio") {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      sendToWindow(mainWindow, "toggle-system-audio", {});
    }
    return;
  }
  emitToAll("custom-shortcut-triggered", { action: actionId });
}

function updateShortcuts(config) {
  globalShortcut.unregisterAll();
  registeredShortcuts = new Map();
  const failures = [];
  const bindings = config?.bindings || {};

  for (const [actionId, binding] of Object.entries(bindings)) {
    if (!binding?.enabled || !binding.key) continue;
    if (actionId === "move_window") {
      for (const direction of ["up", "down", "left", "right"]) {
        const key = normalizeAccelerator(`${binding.key}+${direction}`);
        const ok = globalShortcut.register(key, () =>
          handleShortcut(`move_window_${direction}`)
        );
        if (ok) {
          registeredShortcuts.set(`move_window_${direction}`, key);
        } else {
          failures.push([`move_window_${direction}`, key, "registration failed"]);
        }
      }
      continue;
    }
    const key = normalizeAccelerator(binding.key);
    const ok = globalShortcut.register(key, () => handleShortcut(actionId));
    if (ok) {
      registeredShortcuts.set(actionId, key);
    } else {
      failures.push([actionId, key, "registration failed"]);
    }
  }

  if (failures.length) {
    emitToAll("shortcut-registration-error", failures);
    console.warn(
      `Some shortcuts could not be registered: ${failures
        .map(([action, key]) => `${action} (${key})`)
        .join("; ")}`
    );
  }

  return {
    registered: Object.fromEntries(registeredShortcuts.entries()),
    failures,
  };
}

function getSecureStoragePath() {
  return path.join(app.getPath("userData"), "secure_storage.json");
}

function readSecureStorage() {
  if (secureStorageCache) return secureStorageCache;
  const file = getSecureStoragePath();
  if (!fs.existsSync(file)) {
    secureStorageCache = {};
    return secureStorageCache;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    secureStorageCache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    secureStorageCache = {};
  }
  return secureStorageCache;
}

function writeSecureStorage(data) {
  secureStorageCache = data;
  fs.mkdirSync(path.dirname(getSecureStoragePath()), { recursive: true });
  fs.writeFileSync(getSecureStoragePath(), JSON.stringify(data, null, 2));
}

function encodeSecret(value) {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      value: safeStorage.encryptString(String(value)).toString("base64"),
    };
  }
  return { encrypted: false, value: String(value) };
}

function decodeSecret(item) {
  if (!item) return undefined;
  if (item.encrypted) {
    try {
      return safeStorage.decryptString(Buffer.from(item.value, "base64"));
    } catch {
      return undefined;
    }
  }
  return item.value;
}

function getAppSettingsPath() {
  return path.join(app.getPath("userData"), "phantom-settings.json");
}

function readAppSettings() {
  try {
    const settingsPath = getAppSettingsPath();
    if (!fs.existsSync(settingsPath)) return {};
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

function writeAppSettings(settings) {
  const settingsPath = getAppSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function getInstallStorageDir() {
  return isDev() ? app.getAppPath() : path.dirname(app.getPath("exe"));
}

function getConversationStorageDir() {
  const settings = readAppSettings();
  return settings.conversationStorageDir || getInstallStorageDir();
}

function getDatabasePath() {
  return path.join(getConversationStorageDir(), DB_FILE_NAME);
}

function getLegacyDatabasePath() {
  return path.join(app.getPath("userData"), DB_FILE_NAME);
}

function ensureDatabaseFolder() {
  const folder = getConversationStorageDir();
  fs.mkdirSync(folder, { recursive: true });
}

function copyDatabaseIfMissing(sourcePath, targetPath) {
  if (
    sourcePath &&
    targetPath &&
    sourcePath !== targetPath &&
    fs.existsSync(sourcePath) &&
    !fs.existsSync(targetPath)
  ) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function getConversationStorageInfo() {
  const settings = readAppSettings();
  const folderPath = getConversationStorageDir();
  return {
    folderPath,
    databasePath: path.join(folderPath, DB_FILE_NAME),
    defaultFolderPath: getInstallStorageDir(),
    isDefault: !settings.conversationStorageDir,
  };
}

function switchConversationStorageDir(folderPath) {
  const previousPath = getDatabasePath();
  persistDb();

  const settings = readAppSettings();
  if (folderPath) {
    settings.conversationStorageDir = folderPath;
  } else {
    delete settings.conversationStorageDir;
  }
  writeAppSettings(settings);

  const nextPath = getDatabasePath();
  copyDatabaseIfMissing(previousPath, nextPath);
  sqlDb = null;
  return getConversationStorageInfo();
}

async function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(__dirname, "..", "node_modules", "sql.js", "dist", file),
    });
  }
  return sqlPromise;
}

async function getDb() {
  if (sqlDb) return sqlDb;
  const SQL = await getSql();
  ensureDatabaseFolder();
  const dbPath = getDatabasePath();
  copyDatabaseIfMissing(getLegacyDatabasePath(), dbPath);
  if (fs.existsSync(dbPath)) {
    sqlDb = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    sqlDb = new SQL.Database();
  }
  sqlDb.run("PRAGMA foreign_keys = ON");
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      attached_files TEXT,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE TABLE IF NOT EXISTS system_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );
  `);
  persistDb();
  return sqlDb;
}

function persistDb() {
  if (!sqlDb) return;
  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(sqlDb.export()));
}

async function dbExecute(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    while (stmt.step()) {
      // exhaust statement
    }
  } finally {
    stmt.free();
  }
  const rowsAffected = db.getRowsModified();
  const lastInsert = db.exec("SELECT last_insert_rowid() AS id")[0]?.values?.[0]?.[0] || 0;
  persistDb();
  return { rowsAffected, lastInsertId: lastInsert };
}

async function dbSelect(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
  } finally {
    stmt.free();
  }
  return rows;
}

async function getScreenSourceForDisplay(display) {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
  });
  return (
    sources.find((source) => String(source.display_id) === String(display.id)) ||
    sources[0]
  );
}

async function captureDisplayBase64(display) {
  const source = await getScreenSourceForDisplay(display);
  if (!source?.thumbnail || source.thumbnail.isEmpty()) {
    throw new Error("Screen capture returned an empty image");
  }
  return source.thumbnail.toPNG().toString("base64");
}

async function startSelectionCapture() {
  captureImages.clear();
  const displays = screen.getAllDisplays();
  for (let index = 0; index < displays.length; index += 1) {
    const display = displays[index];
    const source = await getScreenSourceForDisplay(display);
    captureImages.set(index, {
      image: source.thumbnail,
      display,
    });
    const label = `capture-overlay-${index}`;
    const win = createBaseWindow(label, {
      title: "Phantom Screen Capture",
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      backgroundColor: "#00000000",
    });
    win.loadURL(getIndexUrl("/"));
    win.once("ready-to-show", () => {
      win.show();
      win.focus();
    });
  }
}

function closeCaptureWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    const label = win.webContents.getURL();
    const arg = win.webContents.mainFrame?.url || label;
    if (win !== mainWindow && win !== dashboardWindow) {
      const args = win.webContents.getLastWebPreferences?.()?.additionalArguments || [];
      if (args.some((item) => item.startsWith("--phantom-window-label=capture-overlay-"))) {
        win.destroy();
      }
    }
    void arg;
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win !== mainWindow && win !== dashboardWindow && !win.isDestroyed()) {
      win.destroy();
    }
  }
  captureImages.clear();
  emitToAll("capture-closed", {});
}

function getTargetDisplayForMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return screen.getPrimaryDisplay();
  }
  const bounds = mainWindow.getBounds();
  return screen.getDisplayMatching(bounds);
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}`;
}

const defaultModels = [
  { provider: "openai", name: "OpenAI", id: "gpt-4.1-mini", model: "gpt-4.1-mini", description: "OpenAI-compatible chat model", modality: "text,image", isAvailable: true },
  { provider: "nvidia-nim", name: "NVIDIA NIM", id: "moonshotai/kimi-k2.6", model: "moonshotai/kimi-k2.6", description: "NVIDIA hosted NIM OpenAI-compatible model", modality: "text,image", isAvailable: true },
  { provider: "openrouter", name: "OpenRouter", id: "openrouter", model: "openai/gpt-4.1-mini", description: "OpenRouter model", modality: "text,image", isAvailable: true },
  { provider: "ollama", name: "Ollama", id: "llama3.2", model: "llama3.2", description: "Local Ollama model", modality: "text", isAvailable: true },
];

const defaultPrompts = [
  {
    title: "Interview Copilot",
    prompt: "Give concise, practical answers suitable for a live technical interview.",
    modelId: "gpt-4.1-mini",
    modelName: "OpenAI-compatible",
  },
  {
    title: "Meeting Assistant",
    prompt: "Summarize what matters, suggest a brief response, and list next actions.",
    modelId: "gpt-4.1-mini",
    modelName: "OpenAI-compatible",
  },
  {
    title: "Screen Analyst",
    prompt: "Analyze the attached screenshot and explain the important details clearly.",
    modelId: "gpt-4.1-mini",
    modelName: "OpenAI-compatible vision",
  },
];

async function handleInvoke(command, args = {}) {
  switch (command) {
    case "get_app_version":
      return app.getVersion();
    case "set_window_height":
      resizeMainWindow(args.height);
      return null;
    case "open_dashboard":
      showDashboard();
      return null;
    case "toggle_dashboard":
      toggleDashboard();
      return null;
    case "update_response_window":
      return updateResponseWindow(args.state);
    case "hide_response_window":
      hideResponseWindow({ destroy: true });
      return null;
    case "get_response_window_state":
      return lastResponseWindowState;
    case "response_window_action":
      sendToWindow(mainWindow, "response-window-action", args);
      return null;
    case "move_window":
      moveMainWindow(args.direction, args.step || 12);
      return null;
    case "set_app_icon_visibility":
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSkipTaskbar(!args.visible);
      }
      return null;
    case "set_always_on_top":
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(Boolean(args.enabled));
      }
      if (responseWindow && !responseWindow.isDestroyed()) {
        responseWindow.setAlwaysOnTop(true);
      }
      return null;
    case "exit_app":
      app.quit();
      return null;
    case "check_shortcuts_registered":
      return registeredShortcuts.size > 0;
    case "get_registered_shortcuts":
      return Object.fromEntries(registeredShortcuts.entries());
    case "update_shortcuts":
      return updateShortcuts(args.config);
    case "validate_shortcut_key":
      return Boolean(normalizeAccelerator(args.key || ""));
    case "set_license_status":
    case "activate_license_api":
    case "deactivate_license_api":
      return { activated: true, is_dev_license: true, instance: { id: "local", name: "local", created_at: new Date().toISOString() } };
    case "validate_license_api":
      return { is_active: true, last_validated_at: new Date().toISOString(), is_dev_license: true };
    case "check_license_status":
      return true;
    case "mask_license_key_cmd":
      return maskKey(args.licenseKey || args.license_key || "");
    case "get_checkout_url":
      return { success: false, checkout_url: null, error: "Payment is disabled in Phantom." };
    case "secure_storage_save": {
      const data = readSecureStorage();
      for (const item of args.items || []) {
        data[item.key] = encodeSecret(item.value);
      }
      writeSecureStorage(data);
      return null;
    }
    case "secure_storage_get": {
      const data = readSecureStorage();
      return {
        license_key: decodeSecret(data.phantom_license_key),
        instance_id: decodeSecret(data.phantom_instance_id),
        selected_provider_model: decodeSecret(data.selected_provider_model),
      };
    }
    case "secure_storage_remove": {
      const data = readSecureStorage();
      for (const key of args.keys || []) {
        delete data[key];
      }
      writeSecureStorage(data);
      return null;
    }
    case "fetch_models":
      return defaultModels;
    case "fetch_prompts":
      return { prompts: defaultPrompts, total: defaultPrompts.length, last_updated: new Date().toISOString() };
    case "create_system_prompt":
      return {
        prompt_name: "Generated Prompt",
        system_prompt: `You are Phantom. Follow this user intent carefully: ${args.userPrompt || args.user_prompt || ""}`,
      };
    case "get_activity":
      return { success: true, data: [], total_tokens_used: 0 };
    case "capture_to_base64":
      return captureDisplayBase64(getTargetDisplayForMainWindow());
    case "start_screen_capture":
      await startSelectionCapture();
      return null;
    case "capture_selected_area": {
      const monitorIndex = Number(args.monitorIndex ?? args.monitor_index ?? 0);
      const stored = captureImages.get(monitorIndex);
      if (!stored) throw new Error(`No captured image for monitor ${monitorIndex}`);
      const coords = args.coords || {};
      const imageSize = stored.image.getSize();
      const rect = {
        x: Math.max(0, Math.min(Number(coords.x || 0), imageSize.width - 1)),
        y: Math.max(0, Math.min(Number(coords.y || 0), imageSize.height - 1)),
        width: Math.max(
          1,
          Math.min(Number(coords.width || 1), imageSize.width - Number(coords.x || 0))
        ),
        height: Math.max(
          1,
          Math.min(Number(coords.height || 1), imageSize.height - Number(coords.y || 0))
        ),
      };
      const base64 = stored.image.crop(rect).toPNG().toString("base64");
      emitToAll("captured-selection", base64);
      closeCaptureWindows();
      return base64;
    }
    case "close_overlay_window":
      closeCaptureWindows();
      return null;
    case "db_execute":
      return dbExecute(args.sql, args.params || []);
    case "db_select":
      return dbSelect(args.sql, args.params || []);
    case "get_conversation_storage_info":
      return getConversationStorageInfo();
    case "choose_conversation_storage_folder": {
      const result = await dialog.showOpenDialog(dashboardWindow || mainWindow, {
        title: "Choose conversation storage folder",
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || !result.filePaths?.[0]) {
        return getConversationStorageInfo();
      }
      return switchConversationStorageDir(result.filePaths[0]);
    }
    case "reset_conversation_storage_folder":
      return switchConversationStorageDir(null);
    case "open_conversation_storage_folder": {
      const info = getConversationStorageInfo();
      fs.mkdirSync(info.folderPath, { recursive: true });
      await shell.openPath(info.folderPath);
      return info;
    }
    case "check_system_audio_access":
      return true;
    case "request_system_audio_access":
      shell.openExternal("ms-settings:sound");
      return null;
    case "get_vad_config":
      return {
        enabled: true,
        hop_size: 1024,
        sensitivity_rms: 0.012,
        peak_threshold: 0.035,
        silence_chunks: 45,
        min_speech_chunks: 7,
        pre_speech_chunks: 12,
        noise_gate_threshold: 0.003,
        max_recording_duration_secs: 180,
      };
    case "update_vad_config":
    case "get_capture_status":
      return false;
    case "get_audio_sample_rate":
      return 48000;
    case "get_input_devices":
    case "get_output_devices":
      return [];
    case "start_system_audio_capture":
    case "stop_system_audio_capture":
    case "manual_stop_continuous":
      emitToAll(command.replace("start_system_audio_capture", "capture-started").replace("stop_system_audio_capture", "capture-stopped"), {});
      return null;
    default:
      throw new Error(`Unknown Phantom command: ${command}`);
  }
}

app.whenReady().then(async () => {
  app.setName("Phantom");

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
      callback({ video: sources[0], audio: "loopback" });
    });
  });

  ipcMain.handle("phantom:invoke", (_event, command, args) =>
    handleInvoke(command, args)
  );
  ipcMain.handle("phantom:open-external", (_event, url) => shell.openExternal(url));
  ipcMain.handle("phantom:http-fetch", (_event, request) =>
    handleHttpFetch(request)
  );
  ipcMain.handle("phantom:http-abort", (_event, requestId) => {
    activeHttpRequests.get(requestId)?.abort();
    activeHttpRequests.delete(requestId);
    return null;
  });

  createMainWindow();
  createDashboardWindow();
  await getDb();
});

app.on("second-instance", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  for (const controller of activeHttpRequests.values()) {
    controller.abort();
  }
  activeHttpRequests.clear();
  globalShortcut.unregisterAll();
  persistDb();
});
