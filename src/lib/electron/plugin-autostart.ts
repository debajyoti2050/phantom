const KEY = "phantom_autostart_enabled";

export async function enable() {
  localStorage.setItem(KEY, "true");
}

export async function disable() {
  localStorage.setItem(KEY, "false");
}
