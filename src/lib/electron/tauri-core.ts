import { emitPhantomEvent } from "./event-bus";

let systemAudioStream: MediaStream | null = null;
let systemAudioRecorder: MediaRecorder | null = null;
let systemAudioChunks: Blob[] = [];

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(String(reader.result || "").split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function startSystemAudioCapture() {
  if (systemAudioRecorder?.state === "recording") {
    throw new Error("Capture already running");
  }

  systemAudioStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  });
  for (const track of systemAudioStream.getVideoTracks()) {
    track.enabled = false;
  }

  const audioTracks = systemAudioStream.getAudioTracks();
  if (!audioTracks.length) {
    systemAudioStream.getTracks().forEach((track) => track.stop());
    systemAudioStream = null;
    throw new Error("No system audio track was captured.");
  }

  const audioOnlyStream = new MediaStream(audioTracks);
  systemAudioChunks = [];
  systemAudioRecorder = new MediaRecorder(audioOnlyStream, {
    mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : undefined,
  });
  systemAudioRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      systemAudioChunks.push(event.data);
    }
  };
  systemAudioRecorder.onstop = async () => {
    if (!systemAudioChunks.length) {
      emitPhantomEvent("audio-encoding-error", "No audio recorded");
      return;
    }
    const blob = new Blob(systemAudioChunks, { type: systemAudioChunks[0].type });
    const base64 = await blobToBase64(blob);
    emitPhantomEvent("speech-detected", base64);
    emitPhantomEvent("continuous-recording-stopped", {});
  };
  systemAudioRecorder.start();
  emitPhantomEvent("capture-started", 48000);
  emitPhantomEvent("continuous-recording-start", 180);
}

async function stopSystemAudioCapture() {
  if (systemAudioRecorder?.state === "recording") {
    systemAudioRecorder.stop();
  }
  systemAudioRecorder = null;
  systemAudioStream?.getTracks().forEach((track) => track.stop());
  systemAudioStream = null;
  emitPhantomEvent("capture-stopped", {});
}

export async function invoke<T = unknown>(
  command: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  if (command === "start_system_audio_capture") {
    await startSystemAudioCapture();
    return undefined as T;
  }
  if (
    command === "stop_system_audio_capture" ||
    command === "manual_stop_continuous"
  ) {
    await stopSystemAudioCapture();
    return undefined as T;
  }
  return window.phantom.invoke(command, args) as Promise<T>;
}
