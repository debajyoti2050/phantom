export async function openUrl(url: string) {
  return window.phantom.openExternal(url);
}
