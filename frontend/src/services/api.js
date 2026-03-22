const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

// Wake up the backend on load (Render free plan sleeps after inactivity)
fetch(`${API_URL}/ping`).catch(() => {});

const HTTP_ERRORS = {
  401: "Invalid API key. Check the GROQ_API_KEY in your .env file.",
  429: "Too many requests. Wait a moment and try again.",
  502: "External service error. Try again in a moment.",
  503: "Could not connect to Groq API. Check your internet connection.",
};

async function request(path, body) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 8000?");
  }

  if (!response.ok) {
    const known = HTTP_ERRORS[response.status];
    if (known) throw new Error(known);
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Unexpected error (${response.status}).`);
  }

  return response.json();
}

export async function uploadFile(file) {
  const form = new FormData();
  form.append("file", file);
  let response;
  try {
    response = await fetch(`${API_URL}/upload`, { method: "POST", body: form });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 8000?");
  }
  if (!response.ok) {
    const known = HTTP_ERRORS[response.status];
    if (known) throw new Error(known);
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Unexpected error (${response.status}).`);
  }
  return response.json();
}

export function analyzeText(text, type, extra = {}) {
  return request("/analyze", { text, type, ...extra });
}

export function translateText(text, to_lang, from_lang = "auto") {
  return request("/translate", { text, to_lang, from_lang });
}

export function detectLanguage(text) {
  return request("/detect", { text });
}

/**
 * Streams a comparison of two texts via SSE.
 */
export function streamCompare(text1, text2, extra, { onChunk, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    let response;
    try {
      response = await fetch(`${API_URL}/compare/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text1, text2, ...extra }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name !== "AbortError")
        onError("Cannot reach the server. Is the backend running on port 8000?");
      return;
    }

    if (!response.ok) {
      const known = HTTP_ERRORS[response.status];
      if (known) { onError(known); return; }
      const data = await response.json().catch(() => ({}));
      onError(data.detail || `Unexpected error (${response.status}).`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) { onError(parsed.error); return; }
          if (parsed.chunk) onChunk(parsed.chunk);
        } catch { /* ignore */ }
      }
    }
    onDone();
  })();

  return () => controller.abort();
}

/**
 * Streams a chat response via SSE.
 */
export function streamChat(context, messages, extra, { onChunk, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    let response;
    try {
      response = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, messages, ...extra }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name !== "AbortError")
        onError("Cannot reach the server. Is the backend running on port 8000?");
      return;
    }

    if (!response.ok) {
      const known = HTTP_ERRORS[response.status];
      if (known) { onError(known); return; }
      const data = await response.json().catch(() => ({}));
      onError(data.detail || `Unexpected error (${response.status}).`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) { onError(parsed.error); return; }
          if (parsed.chunk) onChunk(parsed.chunk);
        } catch { /* ignore */ }
      }
    }
    onDone();
  })();

  return () => controller.abort();
}

/**
 * Streams an analysis response via SSE.
 * Calls onChunk(str) for each token, onDone() when finished, onError(msg) on failure.
 * Returns an abort function () => void.
 */
export function streamAnalyzeText(text, type, extra, { onChunk, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    let response;
    try {
      response = await fetch(`${API_URL}/analyze/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type, ...extra }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name !== "AbortError")
        onError("Cannot reach the server. Is the backend running on port 8000?");
      return;
    }

    if (!response.ok) {
      const known = HTTP_ERRORS[response.status];
      if (known) { onError(known); return; }
      const data = await response.json().catch(() => ({}));
      onError(data.detail || `Unexpected error (${response.status}).`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) { onError(parsed.error); return; }
          if (parsed.chunk) onChunk(parsed.chunk);
        } catch { /* ignore malformed lines */ }
      }
    }
    onDone();
  })();

  return () => controller.abort();
}
