import { useState, useRef, useEffect } from "react";
import { analyzeText, translateText, streamAnalyzeText, uploadFile } from "./services/api";
import { t } from "./i18n";
import "./App.css";

const MIN_CHARS = 15;
const MAX_CHARS = 3000;
const MAX_TRANSLATE_CHARS = 500;

const TONES = ["formal", "casual", "positive", "negative", "persuasive", "simple"];

const ACTIONS = [
  { type: "summary_short", icon: "⚡", titleKey: "shortSummary", descKey: "shortSummaryDesc" },
  { type: "summary_long",  icon: "📄", titleKey: "longSummary",  descKey: "longSummaryDesc" },
  { type: "keywords",      icon: "🏷️", titleKey: "keywords",     descKey: "keywordsDesc" },
  { type: "sentiment",     icon: "💡", titleKey: "sentiment",    descKey: "sentimentDesc" },
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

const TYPE_ICONS = {
  summary_short: "⚡",
  summary_long:  "📄",
  keywords:      "🏷️",
  sentiment:     "💡",
  tone:          "✏️",
  translate:     "🌐",
  qa:            "❓",
};

function getTypeLabel(type, tr) {
  const map = {
    summary_short: "typeSummaryShort",
    summary_long:  "typeSummaryLong",
    keywords:      "typeKeywords",
    sentiment:     "typeSentiment",
    tone:          "typeTone",
    translate:     "typeTranslate",
    qa:            "typeQA",
  };
  return tr(map[type] ?? type);
}

const STREAM_TYPES = new Set(["summary_short", "summary_long", "tone", "qa"]);

function dataKey(type) {
  if (type === "tone") return "rewritten";
  if (type === "qa")   return "answer";
  return "summary";
}

function computeStats(text) {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, sentences: 0, paragraphs: 0, readTime: "—" };
  const words      = trimmed.split(/\s+/).length;
  const sentences  = (trimmed.match(/[^.!?]*[.!?]+/g) ?? []).length || (trimmed.length > 0 ? 1 : 0);
  const paragraphs = trimmed.split(/\n{2,}/).filter(Boolean).length || 1;
  const mins       = words / 200;
  const readTime   = mins < 1 ? `${Math.round(mins * 60)}s` : `${Math.ceil(mins)}m`;
  return { words, sentences, paragraphs, readTime };
}

function TextStats({ text, tr }) {
  const { words, sentences, paragraphs, readTime } = computeStats(text);
  const hasText = text.trim().length > 0;
  return (
    <div className={`text-stats ${hasText ? "text-stats-active" : ""}`}>
      <span className="stat-item"><span className="stat-value">{words}</span> {tr("words")}</span>
      <span className="stat-sep" />
      <span className="stat-item"><span className="stat-value">{sentences}</span> {tr("sentences")}</span>
      <span className="stat-sep" />
      <span className="stat-item"><span className="stat-value">{paragraphs}</span> {paragraphs === 1 ? tr("paragraph") : tr("paragraphs")}</span>
      <span className="stat-sep" />
      <span className="stat-item"><span className="stat-value">{readTime}</span> {tr("read")}</span>
    </div>
  );
}

function getTextHint(text, tr) {
  const len = text.trim().length;
  if (text.length === 0) return null;
  if (len < MIN_CHARS) return { message: tr("charsNeeded", MIN_CHARS - len), type: "warning" };
  if (text.length >= MAX_CHARS) return { message: tr("charLimitReached", MAX_CHARS), type: "error" };
  return null;
}

function validateForSubmit(text, tr, requireMin = true) {
  const trimmed = text.trim();
  if (!trimmed) return tr("errEmpty");
  if (requireMin && trimmed.length < MIN_CHARS)
    return tr("errTooShort", trimmed.length, MIN_CHARS);
  if (text.length > MAX_CHARS) return tr("errTooLong", MAX_CHARS);
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

// ── Result body renderer ──
function ResultBody({ item, tr }) {
  const { type, data, streaming } = item;

  if (type === "summary_short" || type === "summary_long" || type === "tone") {
    return (
      <p className="result-text">
        {data.summary ?? data.rewritten}
        {streaming && <span className="stream-cursor" />}
      </p>
    );
  }
  if (type === "translate") {
    return (
      <>
        <p className="result-lang-note">{tr("translatedTo", item.toLang)}</p>
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
        <p className="result-text">
          {data.answer}
          {streaming && <span className="stream-cursor" />}
        </p>
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
          <span className="sentiment-score">{tr("confidence")}: <span>{pct}%</span></span>
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
function HistoryCard({ item, onRemove, tr }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyText(getPlainText(item));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`history-card ${item.updating ? "history-card-updating" : ""}`}>
      <div className="history-card-header">
        <span className="history-type-icon">{TYPE_ICONS[item.type]}</span>
        <span className="result-type-badge">{getTypeLabel(item.type, tr)}</span>
        {item.updating && <span className="updating-badge">{tr("updating")}</span>}
        <span className="history-time">{formatTime(item.timestamp)}</span>
        <div className="history-actions">
          <button className="icon-btn" title={tr("copy")} onClick={handleCopy} disabled={item.updating || item.streaming}>
            {copied ? "✓" : "⧉"}
          </button>
          <button className="icon-btn icon-btn-remove" title={tr("remove")} onClick={() => onRemove(item.id)}>
            ✕
          </button>
        </div>
      </div>
      <div className={`history-card-body ${item.updating ? "body-updating" : ""}`}>
        <ResultBody item={item} tr={tr} />
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
  const [selectedModel, setSelectedModel] = useState("fast");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [selectedTone, setSelectedTone] = useState("formal");
  const [selectedLang, setSelectedLang] = useState("en");
  const [responseLang, setResponseLang] = useState("English");
  const [question, setQuestion] = useState("");
  const historyBottomRef = useRef(null);
  const isFirstLangRender = useRef(true);

  const tr = (key, ...args) => t(key, responseLang, ...args);

  // Scroll to newest result
  useEffect(() => {
    if (history.length > 0) {
      historyBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history.length]);

  // Re-run all history items when response language changes
  useEffect(() => {
    if (isFirstLangRender.current) { isFirstLangRender.current = false; return; }
    const retranslatable = history.filter(i => i.type !== "translate" && !i.streaming);
    if (retranslatable.length === 0) return;

    (async () => {
      for (const item of retranslatable) {
        setHistory(prev => prev.map(h => h.id === item.id ? { ...h, updating: true } : h));
        try {
          const extra = { response_lang: responseLang };
          if (item.type === "tone") extra.tone = item.tone;
          if (item.type === "qa")   extra.question = item.question;
          const data = await analyzeText(item.originalText, item.type, extra);
          setHistory(prev => prev.map(h =>
            h.id === item.id ? { ...h, data, updating: false } : h
          ));
        } catch {
          setHistory(prev => prev.map(h => h.id === item.id ? { ...h, updating: false } : h));
        }
      }
    })();
  }, [responseLang]); // eslint-disable-line react-hooks/exhaustive-deps

  const showError = (message, type = "error") => setError({ message, type });
  const clearError = () => setError(null);

  const pushResult = (item) =>
    setHistory((prev) => [...prev, { ...item, id: Date.now(), timestamp: new Date() }]);

  const removeItem = (id) => setHistory((prev) => prev.filter((i) => i.id !== id));
  const clearHistory = () => setHistory([]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    const SUPPORTED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!SUPPORTED.includes(file.type)) {
      showError(tr("errFileType"), "warning");
      return;
    }
    const isImage = file.type.startsWith("image/");
    const maxMB = isImage ? 4 : 5;
    if (file.size > maxMB * 1024 * 1024) {
      showError(tr("errFileSize", isImage ? "Image" : "PDF", maxMB), "warning");
      return;
    }
    clearError();
    setUploading(true);
    try {
      const { text } = await uploadFile(file);
      setText(text.slice(0, MAX_CHARS));
    } catch (e) {
      showError(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handle = async (type, extra = {}) => {
    const err = validateForSubmit(text, tr);
    if (err) { showError(err, "warning"); return; }
    clearError(); setActiveType(type); setLoading(true);

    if (STREAM_TYPES.has(type)) {
      const id  = Date.now();
      const key = dataKey(type);

      setHistory(prev => [...prev, {
        id, type, data: { [key]: "" },
        question: extra.question,
        tone: extra.tone,
        originalText: text,
        timestamp: new Date(),
        streaming: true,
      }]);

      setLoading(false); setActiveType(null);

      streamAnalyzeText(
        text, type, { ...extra, response_lang: responseLang, model: selectedModel },
        {
          onChunk: (chunk) =>
            setHistory(prev => prev.map(item =>
              item.id === id
                ? { ...item, data: { ...item.data, [key]: item.data[key] + chunk } }
                : item
            )),
          onDone: () =>
            setHistory(prev => prev.map(item =>
              item.id === id ? { ...item, streaming: false } : item
            )),
          onError: (msg) => {
            setHistory(prev => prev.filter(item => item.id !== id));
            showError(msg);
          },
        }
      );
    } else {
      try {
        const data = await analyzeText(text, type, { ...extra, response_lang: responseLang, model: selectedModel });
        pushResult({ type, data, question: extra.question, tone: extra.tone, originalText: text });
      } catch (e) {
        showError(e.message);
      } finally {
        setLoading(false); setActiveType(null);
      }
    }
  };

  const handleTranslate = async () => {
    const err = validateForSubmit(text, tr, false);
    if (err) { showError(err, "warning"); return; }
    if (text.length > MAX_TRANSLATE_CHARS) {
      showError(tr("errTranslateLimit", MAX_TRANSLATE_CHARS, text.length), "warning");
      return;
    }
    clearError(); setActiveType("translate"); setLoading(true);
    try {
      const data = await translateText(text, selectedLang);
      const toLang = LANGUAGES.find((l) => l.code === selectedLang)?.label ?? selectedLang;
      pushResult({ type: "translate", data, toLang, originalText: text });
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false); setActiveType(null);
    }
  };

  const hint = getTextHint(text, tr);
  const textareaClass = [
    "textarea",
    hint?.type === "error" ? "textarea-error" : "",
    hint?.type === "warning" ? "textarea-warn" : "",
  ].join(" ").trim();

  const selectedLangLabel = tr("langNames")?.[selectedLang] ?? LANGUAGES.find((l) => l.code === selectedLang)?.label ?? selectedLang;
  const selectedToneLabel = tr("tones")?.[selectedTone] ?? selectedTone;

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">🔍</div>
        <h1>TextLens</h1>
        <span className="header-subtitle">{tr("poweredBy")}</span>
      </header>

      <div className="workspace">
        {/* ── Left panel ── */}
        <div className="left-panel">

          {/* Input */}
          <div className="input-section">
            <p className="section-label">{tr("inputText")}</p>
            <textarea
              className={textareaClass}
              placeholder={tr("inputPlaceholder")}
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, MAX_CHARS)); clearError(); }}
              maxLength={MAX_CHARS}
              onPaste={(e) => {
                const imageItem = [...(e.clipboardData?.items ?? [])].find(
                  (item) => item.kind === "file" && item.type.startsWith("image/")
                );
                if (imageItem) {
                  e.preventDefault();
                  handleFileUpload(imageItem.getAsFile());
                }
              }}
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
            <TextStats text={text} tr={tr} />

            <div className="upload-row">
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                style={{ display: "none" }}
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
              <button
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || loading}
              >
                {uploading
                  ? <><span className="upload-spinner" />{tr("extracting")}</>
                  : <><span className="upload-icon">📎</span>{tr("uploadBtn")}</>
                }
              </button>
              <span className="upload-hint">{tr("uploadHint")}</span>
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
                  {tr("results")} · {history.length}
                </p>
                <button className="clear-btn" onClick={clearHistory}>{tr("clearAll")}</button>
              </div>
            )}

            <div className="history-list">
              {history.length === 0 && !loading && (
                <div className="history-empty">
                  <span className="history-empty-icon">✦</span>
                  <p>{tr("emptyTitle")}</p>
                  <p>{tr("emptyDesc")}</p>
                </div>
              )}

              {history.map((item) => (
                <HistoryCard key={item.id} item={item} onRemove={removeItem} tr={tr} />
              ))}

              {loading && (
                <div className="history-card history-loading">
                  <div className="loader-wrap">
                    <div className="spinner" />
                    {activeType === "translate" ? tr("translating") : tr("analyzing")}
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
            <p className="section-label">{tr("modelLabel")}</p>
            <div className="model-chips">
              <button
                className={`model-chip ${selectedModel === "fast" ? "selected" : ""}`}
                onClick={() => setSelectedModel("fast")}
                disabled={loading}
              >
                <span className="model-chip-name">⚡ {tr("modelFast")}</span>
                <span className="model-chip-desc">{tr("modelFastDesc")}</span>
              </button>
              <button
                className={`model-chip ${selectedModel === "quality" ? "selected" : ""}`}
                onClick={() => setSelectedModel("quality")}
                disabled={loading}
              >
                <span className="model-chip-name">✨ {tr("modelQuality")}</span>
                <span className="model-chip-desc">{tr("modelQualityDesc")}</span>
              </button>
            </div>
          </div>

          <div className="panel-section">
            <p className="section-label">{tr("responseLanguage")}</p>
            <select
              className="lang-select"
              value={responseLang}
              onChange={(e) => setResponseLang(e.target.value)}
              disabled={loading}
            >
              {LANGUAGES.map(({ code, label }) => (
                <option key={label} value={label}>{tr("langNames")?.[code] ?? label}</option>
              ))}
            </select>
          </div>

          <div className="panel-section">
            <p className="section-label">{tr("analyze")}</p>
            <div className="actions">
              {ACTIONS.map(({ type, icon, titleKey, descKey }) => (
                <button
                  key={type}
                  className={`action-btn ${activeType === type ? "active" : ""}`}
                  onClick={() => handle(type)}
                  disabled={loading}
                >
                  <span className="btn-icon">{icon}</span>
                  <span className="btn-text">
                    <span className="btn-title">{tr(titleKey)}</span>
                    <span className="btn-desc">{tr(descKey)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <p className="section-label">{tr("changeTone")}</p>
            <div className="tone-chips">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  className={`tone-chip ${selectedTone === tone ? "selected" : ""}`}
                  onClick={() => setSelectedTone(tone)}
                  disabled={loading}
                >
                  {tr("tones")?.[tone] ?? tone.charAt(0).toUpperCase() + tone.slice(1)}
                </button>
              ))}
            </div>
            <button
              className="run-btn indigo"
              onClick={() => handle("tone", { tone: selectedTone })}
              disabled={loading}
            >
              {tr("rewriteBtn", selectedToneLabel)}
            </button>
          </div>

          <div className="panel-section">
            <p className="section-label">{tr("askQuestion")}</p>
            <input
              className="question-input"
              type="text"
              placeholder={tr("questionPlaceholder")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  if (!question.trim()) { showError(tr("errNoQuestion"), "warning"); return; }
                  handle("qa", { question });
                }
              }}
              disabled={loading}
            />
            <button
              className="run-btn purple"
              onClick={() => {
                if (!question.trim()) { showError(tr("errNoQuestion"), "warning"); return; }
                handle("qa", { question });
              }}
              disabled={loading}
            >
              ❓ {tr("askBtn")}
            </button>
          </div>

          <div className="panel-section">
            <p className="section-label">{tr("translate")}</p>
            <select
              className="lang-select"
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              disabled={loading}
            >
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{tr("langNames")?.[code] ?? label}</option>
              ))}
            </select>
            <button
              className="run-btn cyan"
              onClick={handleTranslate}
              disabled={loading}
            >
              {tr("translateBtn", selectedLangLabel)}
            </button>
          </div>

        </div>
      </div>

      <footer className="footer">{tr("footer")}</footer>
    </div>
  );
}
