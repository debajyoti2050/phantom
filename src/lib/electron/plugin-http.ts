type SerializedBody =
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

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  const record: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function removeContentType(headers: Record<string, string>) {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "content-type") {
      delete headers[key];
    }
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function serializeBody(
  body: BodyInit | null | undefined,
  headers: Record<string, string>
): Promise<SerializedBody> {
  if (!body) return { kind: "none" };

  if (typeof body === "string") {
    return { kind: "text", value: body };
  }

  if (body instanceof URLSearchParams) {
    return { kind: "text", value: body.toString() };
  }

  if (body instanceof FormData) {
    removeContentType(headers);
    const entries: Extract<SerializedBody, { kind: "formData" }>["entries"] =
      [];
    for (const [name, value] of body.entries()) {
      if (value instanceof Blob) {
        entries.push({
          name,
          file: {
            base64: await blobToBase64(value),
            type: value.type,
            name: value instanceof File ? value.name : "file",
          },
        });
      } else {
        entries.push({ name, value });
      }
    }
    return { kind: "formData", entries };
  }

  if (body instanceof Blob) {
    return {
      kind: "blob",
      base64: await blobToBase64(body),
      type: body.type,
    };
  }

  if (body instanceof ArrayBuffer) {
    return {
      kind: "blob",
      base64: await blobToBase64(new Blob([body])),
    };
  }

  if (ArrayBuffer.isView(body)) {
    return {
      kind: "blob",
      base64: await blobToBase64(new Blob([body])),
    };
  }

  return { kind: "text", value: String(body) };
}

export async function fetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const url = input instanceof Request ? input.url : String(input);
  const request = input instanceof Request ? input : undefined;
  const method = init.method || request?.method || "GET";
  const headers = headersToRecord(init.headers || request?.headers);
  const body = await serializeBody(
    init.body ?? (request ? await request.clone().blob() : undefined),
    headers
  );
  const requestId =
    globalThis.crypto?.randomUUID?.() ||
    `phantom_http_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const pending: Array<Uint8Array | "end" | Error> = [];
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let finished = false;

  const flush = () => {
    if (!controller) return;
    while (pending.length) {
      const item = pending.shift();
      if (item === "end") {
        finished = true;
        controller.close();
        return;
      }
      if (item instanceof Error) {
        finished = true;
        controller.error(item);
        return;
      }
      if (item) {
        controller.enqueue(item);
      }
    }
  };

  const unlisten = window.phantom.onEvent((event) => {
    if (event.event !== `http-stream:${requestId}`) return;
    const payload = event.payload as
      | { type: "chunk"; chunk: string }
      | { type: "end" }
      | { type: "error"; error: string };

    if (payload.type === "chunk") {
      pending.push(base64ToBytes(payload.chunk));
    } else if (payload.type === "end") {
      pending.push("end");
      unlisten();
    } else {
      pending.push(new Error(payload.error));
      unlisten();
    }
    flush();
  });

  init.signal?.addEventListener(
    "abort",
    () => {
      void window.phantom.http.abort(requestId);
      if (!finished) {
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        pending.push(abortError);
        flush();
      }
      unlisten();
    },
    { once: true }
  );

  let metadata: Awaited<ReturnType<typeof window.phantom.http.fetch>>;
  try {
    metadata = await window.phantom.http.fetch({
      id: requestId,
      url,
      init: { method, headers, body },
    });
  } catch (error) {
    unlisten();
    throw error;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      flush();
    },
    cancel() {
      finished = true;
      void window.phantom.http.abort(requestId);
      unlisten();
    },
  });

  return new Response(stream, {
    status: metadata.status,
    statusText: metadata.statusText,
    headers: metadata.headers,
  });
}
