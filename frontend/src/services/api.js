const API_URL = "http://127.0.0.1:8000";

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

export function analyzeText(text, type, extra = {}) {
  return request("/analyze", { text, type, ...extra });
}

export function translateText(text, to_lang, from_lang = "auto") {
  return request("/translate", { text, to_lang, from_lang });
}
