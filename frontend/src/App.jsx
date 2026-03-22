import { useState, useRef, useEffect } from "react";
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
  qa:            "Q&A",
};

const TYPE_ICONS = {
  summary_short: "⚡",
  summary_long:  "📄",
  keywords:      "🏷️",
  sentiment:     "💡",
  tone:          "✏️",
  translate:     "🌐",
  qa:            "❓",
};

function getTextHint(text) {
  const len = text.trim().length;
  if (text.length === 0) return null;
  if (len < MIN_CHARS) return { message: `${MIN_CHARS - len} more characters needed`, type: "warning" };
  if (text.length >= MAX_CHARS) return { message: `Character limit reached (${MAX_CHARS})`, type: "error" };
  return null;
}

function validateForSubmit(text, requireMin = true) {
  const trimmed = text.trim();
  if (!trimmed) return "The text cannot be empty.";
  if (requireMin && trimmed.length < MIN_CHARS)
    return `Text is too short (${trimmed.length}/${MIN_CHARS} characters). Add a bit more content.`;
  if (text.length > MAX_CHARS) return `Text exceeds the ${MAX_CHARS} character limit.`;
  return null;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function copyText(str) {
  navigator.clipboard.writeText(str).catch(() => {});
}

function getPlainText(item) {
  const { type, data } = item;
  if (type === "keywords") return data.keywords.join(", ");
  if (type === "sentiment") return `${data.sentiment.label} (${Math.round((data.sentiment.score || 0) * 100)}%)\n${data.sentiment.explanation}`;
  if (type === "qa") return `Q: ${item.question}\nA: ${data.answer}`;
  if (type === "translate") return data.translation;
  return data.summary ?? data.rewritten ?? "";
}

// ── Result body renderer (shared between history items) ──
function ResultBody({ item }) {
  const { type, data } = item;

  if (type === "summary_short" || type === "summary_long" || type === "tone") {
    return <p className="result-text">{data.summary ?? data.rewritten}</p>;
  }
  if (type === "translate") {
    return (
      <>
        <p className="result-lang-note">Translated to {item.toLang}</p>
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
  if (type === "qa") {
    return (
      <div className="qa-wrap">
        <p className="qa-question">❓ {item.question}</p>
        <p className="result-text">{data.answer}</p>
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
}

// ── Single history card ──
function HistoryCard({ item, onRemove }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyText(getPlainText(item));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="history-card">
      <div className="history-card-header">
        <span className="history-type-icon">{TYPE_ICONS[item.type]}</span>
        <span className="result-type-badge">{TYPE_LABELS[item.type]}</span>
        <span className="history-time">{formatTime(item.timestamp)}</span>
        <div className="history-actions">
          <button className="icon-btn" title="Copy" onClick={handleCopy}>
            {copied ? "✓" : "⧉"}
          </button>
          <button className="icon-btn icon-btn-remove" title="Remove" onClick={() => onRemove(item.id)}>
            ✕
          </button>
        </div>
      </div>
      <div className="history-card-body">
        <ResultBody item={item} />
      </div>
    </div>
  );
}

// ── Main app ──
export default function App() {
  const [text, setText] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const [error, setError] = useState(null);
  const [selectedTone, setSelectedTone] = useState("formal");
  const [selectedLang, setSelectedLang] = useState("en");
  const [responseLang, setResponseLang] = useState("English");
  const [question, setQuestion] = useState("");
  const historyBottomRef = useRef(null);

  // Scroll to newest result
  useEffect(() => {
    if (history.length > 0) {
      historyBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history.length]);

  const showError = (message, type = "error") => setError({ message, type });
  const clearError = () => setError(null);

  const pushResult = (item) =>
    setHistory((prev) => [...prev, { ...item, id: Date.now(), timestamp: new Date() }]);

  const removeItem = (id) => setHistory((prev) => prev.filter((i) => i.id !== id));
  const clearHistory = () => setHistory([]);

  const handle = async (type, extra = {}) => {
    const err = validateForSubmit(text);
    if (err) { showError(err, "warning"); return; }
    clearError(); setActiveType(type); setLoading(true);
    try {
      const data = await analyzeText(text, type, { ...extra, response_lang: responseLang });
      pushResult({ type, data, question: extra.question });
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false); setActiveType(null);
    }
  };

  const handleTranslate = async () => {
    const err = validateForSubmit(text, false);
    if (err) { showError(err, "warning"); return; }
    if (text.length > MAX_TRANSLATE_CHARS) {
      showError(`Translation is limited to ${MAX_TRANSLATE_CHARS} characters (current: ${text.length}).`, "warning");
      return;
    }
    clearError(); setActiveType("translate"); setLoading(true);
    try {
      const data = await translateText(text, selectedLang);
      const toLang = LANGUAGES.find((l) => l.code === selectedLang)?.label ?? selectedLang;
      pushResult({ type: "translate", data, toLang });
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">🔍</div>
        <h1>TextLens</h1>
        <span className="header-subtitle">Powered by Groq · Llama 3.1</span>
      </header>

      <div className="workspace">
        {/* ── Left panel ── */}
        <div className="left-panel">

          {/* Input */}
          <div className="input-section">
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

          {/* Feedback */}
          {error && (
            <div className={`feedback-msg feedback-${error.type}`}>
              <span className="feedback-icon">{error.type === "warning" ? "⚠" : "✕"}</span>
              {error.message}
            </div>
          )}

          {/* History */}
          <div className="history-section">
            {history.length > 0 && (
              <div className="history-header">
                <p className="section-label" style={{ margin: 0 }}>
                  Results · {history.length}
                </p>
                <button className="clear-btn" onClick={clearHistory}>Clear all</button>
              </div>
            )}

            <div className="history-list">
              {history.length === 0 && !loading && (
                <div className="history-empty">
                  <span className="history-empty-icon">✦</span>
                  <p>Results will appear here</p>
                  <p>You can run multiple analyses on the same text</p>
                </div>
              )}

              {history.map((item) => (
                <HistoryCard key={item.id} item={item} onRemove={removeItem} />
              ))}

              {loading && (
                <div className="history-card history-loading">
                  <div className="loader-wrap">
                    <div className="spinner" />
                    {activeType === "translate" ? "Translating..." : "Analyzing with AI..."}
                  </div>
                </div>
              )}

              <div ref={historyBottomRef} />
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
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
            <p className="section-label">Ask a question</p>
            <input
              className="question-input"
              type="text"
              placeholder="What is the main topic?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  if (!question.trim()) { showError("Write a question first.", "warning"); return; }
                  handle("qa", { question });
                }
              }}
              disabled={loading}
            />
            <button
              className="run-btn purple"
              onClick={() => {
                if (!question.trim()) { showError("Write a question first.", "warning"); return; }
                handle("qa", { question });
              }}
              disabled={loading}
            >
              ❓ Ask →
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
              🌐 Translate to {LANGUAGES.find((l) => l.code === selectedLang)?.label} →
            </button>
          </div>

        </div>
      </div>

      <footer className="footer">TextLens — AI-powered text analysis</footer>
    </div>
  );
}
