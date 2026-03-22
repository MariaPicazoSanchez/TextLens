import { useState } from "react";
import { analyzeText } from "./services/api";
import "./App.css";

const TONES = ["formal", "casual", "positive", "negative", "persuasive", "simple"];

const ACTIONS = [
  { type: "summary_short", icon: "⚡", title: "Resumen corto",  desc: "2-3 frases clave" },
  { type: "summary_long",  icon: "📄", title: "Resumen largo",  desc: "Análisis detallado" },
  { type: "keywords",      icon: "🏷️", title: "Palabras clave", desc: "Términos relevantes" },
  { type: "sentiment",     icon: "💡", title: "Sentimiento",    desc: "Tono emocional" },
];

const TYPE_LABELS = {
  summary_short: "Resumen corto",
  summary_long:  "Resumen largo",
  keywords:      "Palabras clave",
  sentiment:     "Sentimiento",
  tone:          "Cambio de tono",
};

function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const [error, setError] = useState("");
  const [selectedTone, setSelectedTone] = useState("formal");

  const handle = async (type, extra = {}) => {
    if (!text.trim()) {
      setError("Por favor, introduce algún texto primero.");
      return;
    }
    setError("");
    setResult(null);
    setActiveType(type);
    setLoading(true);
    try {
      const data = await analyzeText(text, type, extra);
      setResult({ type, data });
    } catch {
      setError("Error al conectar con el servidor. Comprueba que el backend está activo y que tu API key es correcta.");
    } finally {
      setLoading(false);
      setActiveType(null);
    }
  };

  const renderResult = () => {
    if (!result) return null;
    const { type, data } = result;

    if (type === "summary_short" || type === "summary_long" || type === "tone") {
      const text = data.summary ?? data.rewritten;
      return <p className="result-text">{text}</p>;
    }

    if (type === "keywords") {
      return (
        <div className="keywords-wrap">
          {data.keywords.map((kw, i) => (
            <span key={i} className="keyword-tag">{kw}</span>
          ))}
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
            <span className="sentiment-score">Confianza: <span>{pct}%</span></span>
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
      {/* Header */}
      <header className="header">
        <div className="header-logo">🔍</div>
        <h1>TextLens</h1>
        <span className="header-subtitle">Powered by Groq · Llama 3.1</span>
      </header>

      <main className="main">
        {/* Input */}
        <div className="card">
          <p className="card-label">Texto de entrada</p>
          <textarea
            className="textarea"
            placeholder="Pega o escribe tu texto aquí..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
          />
          <p className="char-count">{text.length} caracteres</p>
        </div>

        {/* Actions */}
        <div className="card">
          <p className="card-label">Analizar</p>
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
        <div className="card">
          <p className="card-label">Cambiar tono</p>
          <div className="tone-row">
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
              className="tone-btn"
              onClick={() => handle("tone", { tone: selectedTone })}
              disabled={loading}
            >
              Reescribir →
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="error-msg">
            <span>⚠</span> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loader-wrap">
            <div className="spinner" />
            Analizando con IA...
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="result-card">
            <div className="result-header">
              <span className="result-type-badge">{TYPE_LABELS[result.type]}</span>
            </div>
            <div className="result-body">
              {renderResult()}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">TextLens — análisis de texto con IA</footer>
    </div>
  );
}

export default App;
