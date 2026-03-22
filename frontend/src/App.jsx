import { useState } from "react";
import { analyzeText } from "./services/api";

const TONES = ["formal", "casual", "positive", "negative", "persuasive", "simple"];

function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTone, setSelectedTone] = useState("formal");

  const handle = async (type, extra = {}) => {
    if (!text.trim()) {
      setError("Please enter some text first.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await analyzeText(text, type, extra);
      setResult({ type, data });
    } catch (e) {
      setError("Request failed. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;
    const { type, data } = result;

    if (type === "summary_short" || type === "summary_long") {
      return <p>{data.summary}</p>;
    }
    if (type === "keywords") {
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {data.keywords.map((kw, i) => (
            <span key={i} style={{ background: "#e0e7ff", padding: "4px 10px", borderRadius: "12px", fontSize: "14px" }}>
              {kw}
            </span>
          ))}
        </div>
      );
    }
    if (type === "sentiment") {
      const s = data.sentiment;
      const colors = { Positive: "#d1fae5", Negative: "#fee2e2", Neutral: "#f3f4f6", Mixed: "#fef3c7" };
      return (
        <div style={{ background: colors[s.label] || "#f3f4f6", padding: "12px", borderRadius: "8px" }}>
          <strong>{s.label}</strong> — {Math.round((s.score || 0) * 100)}% confidence
          <p style={{ margin: "6px 0 0" }}>{s.explanation}</p>
        </div>
      );
    }
    if (type === "tone") {
      return <p>{data.rewritten}</p>;
    }
    return null;
  };

  return (
    <div style={{ maxWidth: "720px", margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1 style={{ marginBottom: "4px" }}>TextLens</h1>
      <p style={{ color: "#6b7280", marginBottom: "16px" }}>Analyze and transform your text</p>

      <textarea
        placeholder="Paste your text here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        style={{ width: "100%", padding: "12px", fontSize: "15px", borderRadius: "8px", border: "1px solid #d1d5db", resize: "vertical", boxSizing: "border-box" }}
      />

      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button onClick={() => handle("summary_short")} disabled={loading}>Resumen corto</button>
        <button onClick={() => handle("summary_long")} disabled={loading}>Resumen largo</button>
        <button onClick={() => handle("keywords")} disabled={loading}>Palabras clave</button>
        <button onClick={() => handle("sentiment")} disabled={loading}>Sentimiento</button>
      </div>

      <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={selectedTone}
          onChange={(e) => setSelectedTone(e.target.value)}
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db" }}
        >
          {TONES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <button onClick={() => handle("tone", { tone: selectedTone })} disabled={loading}>
          Cambiar tono
        </button>
      </div>

      {error && <p style={{ color: "#dc2626", marginTop: "12px" }}>{error}</p>}

      {loading && <p style={{ color: "#6b7280", marginTop: "16px" }}>Analizando...</p>}

      {result && (
        <div style={{ marginTop: "20px", padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 10px" }}>Resultado:</h3>
          {renderResult()}
        </div>
      )}
    </div>
  );
}

export default App;
