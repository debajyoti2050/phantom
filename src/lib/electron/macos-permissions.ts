export async function checkScreenRecordingPermission() {
  return window.phantom.invoke<boolean>("check_screen_recording_permission");
}

export async function requestScreenRecordingPermission() {
  return window.phantom.invoke("request_screen_recording_permission");
}
