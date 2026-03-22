import { useState } from "react";
import { analyzeText, translateText } from "./services/api";
import "./App.css";

const MIN_CHARS = 15;
const MAX_CHARS = 3000;
const MAX_TRANSLATE_CHARS = 500;

const TONES = ["formal", "casual", "positive", "negative", "persuasive", "simple"];

const ACTIONS = [
  { type: "summary_short", icon: "⚡", title: "Short summary", desc: "2-3 key sentences" },
  { type: "summary_long",  icon: "📄", title: "Long summary",  desc: "Full breakdown" },
  { type: "keywords",      icon: "🏷️", title: "Keywords",      desc: "Key terms" },
  { type: "sentiment",     icon: "💡", title: "Sentiment",     desc: "Emotional tone" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "tr", label: "Turkish" },
  { code: "sv", label: "Swedish" },
  { code: "uk", label: "Ukrainian" },
];

const TYPE_LABELS = {
  summary_short: "Short summary",
  summary_long:  "Long summary",
  keywords:      "Keywords",
  sentiment:     "Sentiment",
  tone:          "Tone rewrite",
  translate:     "Translation",
};

// Returns { message, type: 'warning' | null } for inline textarea hint
function getTextHint(text, requireMin = true) {
  const len = text.trim().length;
  if (text.length === 0) return null;
  if (requireMin && len < MIN_CHARS) return { message: `${MIN_CHARS - len} more characters needed (minimum ${MIN_CHARS})`, type: "warning" };
  if (text.length >= MAX_CHARS)      return { message: `Character limit reached (${MAX_CHARS})`, type: "error" };
  return null;
}

// Returns an error string before making an API call, or null if OK
function validateForSubmit(text, requireMin = true) {
  const trimmed = text.trim();
  if (!trimmed)                              return "The text cannot be empty.";
  if (requireMin && trimmed.length < MIN_CHARS) return `Text is too short (${trimmed.length}/${MIN_CHARS} characters). Add a bit more content.`;
  if (text.length > MAX_CHARS)               return `Text exceeds the ${MAX_CHARS} character limit.`;
  return null;
}

function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const [error, setError] = useState(null); // { message, type: 'error' | 'warning' }
  const [selectedTone, setSelectedTone] = useState("formal");
  const [selectedLang, setSelectedLang] = useState("en");
  const [responseLang, setResponseLang] = useState("English");

  const showError = (message, type = "error") => setError({ message, type });
  const clearError = () => setError(null);

  const handle = async (type, extra = {}) => {
    const err = validateForSubmit(text);
    if (err) { showError(err, "warning"); return; }
    clearError(); setResult(null); setActiveType(type); setLoading(true);
    try {
      const data = await analyzeText(text, type, { ...extra, response_lang: responseLang });
      setResult({ type, data });
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false); setActiveType(null);
    }
  };

  const handleTranslate = async () => {
    const err = validateForSubmit(text, false); // translation allows short text
    if (err) { showError(err, "warning"); return; }
    if (text.length > MAX_TRANSLATE_CHARS) {
      showError(`Translation is limited to ${MAX_TRANSLATE_CHARS} characters. Your text has ${text.length}.`, "warning");
      return;
    }
    clearError(); setResult(null); setActiveType("translate"); setLoading(true);
    try {
      const data = await translateText(text, selectedLang);
      setResult({ type: "translate", data });
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false); setActiveType(null);
    }
  };

  const hint = getTextHint(text);
  const textareaClass = [
    "textarea",
    hint?.type === "error" ? "textarea-error" : "",
    hint?.type === "warning" ? "textarea-warn" : "",
  ].join(" ").trim();

  const renderResult = () => {
    if (!result) return null;
    const { type, data } = result;

    if (type === "summary_short" || type === "summary_long" || type === "tone") {
      return <p className="result-text">{data.summary ?? data.rewritten}</p>;
    }
    if (type === "translate") {
      const langLabel = LANGUAGES.find((l) => l.code === selectedLang)?.label ?? selectedLang;
      return (
        <>
          <p className="result-lang-note">Translated to {langLabel}</p>
          <p className="result-text">{data.translation}</p>
        </>
      );
    }
    if (type === "keywords") {
      return (
        <div className="keywords-wrap">
          {data.keywords.map((kw, i) => <span key={i} className="keyword-tag">{kw}</span>)}
        </div>
      );
    }
    if (type === "sentiment") {
      const s = data.sentiment;
      const pct = Math.round((s.score || 0) * 100);
      return (
        <div className="sentiment-wrap">
          <div className="sentiment-top">
            <span className={`sentiment-badge ${s.label}`}>{s.label}</span>
            <span className="sentiment-score">Confidence: <span>{pct}%</span></span>
          </div>
          <div className="confidence-bar-bg">
            <div className="confidence-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="sentiment-explanation">{s.explanation}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">🔍</div>
        <h1>TextLens</h1>
        <span className="header-subtitle">Powered by Groq · Llama 3.1</span>
      </header>

      <div className="workspace">
        {/* ── Left: input + result ── */}
        <div className="left-panel">
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <p className="section-label">Input text</p>
            <textarea
              className={textareaClass}
              placeholder="Paste or write your text here..."
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, MAX_CHARS)); clearError(); }}
              maxLength={MAX_CHARS}
            />
            <div className="textarea-footer">
              {hint
                ? <span className={`hint hint-${hint.type}`}>{hint.message}</span>
                : <span />
              }
              <span className={`char-count ${text.length >= MAX_CHARS ? "char-count-limit" : ""}`}>
                {text.length} / {MAX_CHARS}
              </span>
            </div>
          </div>

          {error && (
            <div className={`feedback-msg feedback-${error.type}`}>
              <span className="feedback-icon">{error.type === "warning" ? "⚠" : "✕"}</span>
              {error.message}
            </div>
          )}

          {loading && (
            <div className="loader-wrap">
              <div className="spinner" />
              {activeType === "translate" ? "Translating..." : "Analyzing with AI..."}
            </div>
          )}

          {result && !loading && (
            <div className="result-area">
              <p className="section-label">Result</p>
              <div className="result-card">
                <div className="result-header">
                  <span className="result-type-badge">{TYPE_LABELS[result.type]}</span>
                </div>
                <div className="result-body">{renderResult()}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: controls ── */}
        <div className="right-panel">

          <div className="panel-section">
            <p className="section-label">Response language</p>
            <select
              className="lang-select"
              value={responseLang}
              onChange={(e) => setResponseLang(e.target.value)}
              disabled={loading}
            >
              {LANGUAGES.map(({ label }) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </div>

          <div className="panel-section">
            <p className="section-label">Analyze</p>
            <div className="actions">
              {ACTIONS.map(({ type, icon, title, desc }) => (
                <button
                  key={type}
                  className={`action-btn ${activeType === type ? "active" : ""}`}
                  onClick={() => handle(type)}
                  disabled={loading}
                >
                  <span className="btn-icon">{icon}</span>
                  <span className="btn-text">
                    <span className="btn-title">{title}</span>
                    <span className="btn-desc">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <p className="section-label">Change tone</p>
            <div className="tone-chips">
              {TONES.map((t) => (
                <button
                  key={t}
                  className={`tone-chip ${selectedTone === t ? "selected" : ""}`}
                  onClick={() => setSelectedTone(t)}
                  disabled={loading}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <button
              className="run-btn indigo"
              onClick={() => handle("tone", { tone: selectedTone })}
              disabled={loading}
            >
              Rewrite in {selectedTone} tone →
            </button>
          </div>

          <div className="panel-section">
            <p className="section-label">Translate</p>
            <select
              className="lang-select"
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              disabled={loading}
            >
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <button
              className="run-btn cyan"
              onClick={handleTranslate}
              disabled={loading}
            >
              🌐 Translate to {LANGUAGES.find(l => l.code === selectedLang)?.label} →
            </button>
          </div>

        </div>
      </div>

      <footer className="footer">TextLens — AI-powered text analysis</footer>
    </div>
  );
}

export default App;
