import { useState } from "react";
import { analyzeText, translateText } from "./services/api";
import "./App.css";

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

function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const [error, setError] = useState("");
  const [selectedTone, setSelectedTone] = useState("formal");
  const [selectedLang, setSelectedLang] = useState("en");

  const handle = async (type, extra = {}) => {
    if (!text.trim()) { setError("Please enter some text first."); return; }
    setError(""); setResult(null); setActiveType(type); setLoading(true);
    try {
      const data = await analyzeText(text, type, extra);
      setResult({ type, data });
    } catch {
      setError("Connection error. Make sure the backend is running.");
    } finally {
      setLoading(false); setActiveType(null);
    }
  };

  const handleTranslate = async () => {
    if (!text.trim()) { setError("Please enter some text first."); return; }
    setError(""); setResult(null); setActiveType("translate"); setLoading(true);
    try {
      const data = await translateText(text, selectedLang);
      setResult({ type: "translate", data });
    } catch {
      setError("Translation failed. Make sure the backend is running.");
    } finally {
      setLoading(false); setActiveType(null);
    }
  };

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
              className="textarea"
              placeholder="Paste or write your text here..."
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              maxLength={500}
            />
            <p className={`char-count ${text.length >= 500 ? "char-count-limit" : ""}`}>
              {text.length} / 500
            </p>
          </div>

          {error && <div className="error-msg"><span>⚠</span> {error}</div>}

          {loading && (
            <div className="loader-wrap">
              <div className="spinner" />
              {activeType === "translate" ? "Translating..." : "Analyzing with AI..."}
            </div>
          )}

          {result && (
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

          {/* Analyze */}
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

          {/* Tone */}
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

          {/* Translate */}
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
