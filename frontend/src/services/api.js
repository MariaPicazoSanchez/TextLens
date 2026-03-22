const API_URL = "http://127.0.0.1:8000";

export async function analyzeText(text, type, extra = {}) {
  const response = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, type, ...extra }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Server error");
  }

  return response.json();
}

export async function translateText(text, to_lang, from_lang = "auto") {
  const response = await fetch(`${API_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, to_lang, from_lang }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Server error");
  }

  return response.json();
}
