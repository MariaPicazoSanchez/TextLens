import { useState, useRef, useEffect } from "react";
import { analyzeText, translateText, streamAnalyzeText, uploadFile, detectLanguage, streamCompare, streamChat } from "./services/api";
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
  { type: "topic",         icon: "🗂️", titleKey: "topic",        descKey: "topicDesc" },
  { type: "improve",       icon: "✍️", titleKey: "improve",      descKey: "improveDesc" },
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
  topic:         "🗂️",
  improve:       "✍️",
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
    topic:         "typeTopic",
    improve:       "typeImprove",
  };
  return tr(map[type] ?? type);
}

const STREAM_TYPES = new Set(["summary_short", "summary_long", "tone", "qa", "improve"]);

function dataKey(type) {
  if (type === "tone" || type === "improve") return "rewritten";
  if (type === "qa")   return "answer";
  return "summary";
}

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

function fleschScore(words, sentences, syllables) {
  if (words === 0 || sentences === 0) return null;
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function computeStats(text) {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, sentences: 0, paragraphs: 0, readTime: "—", flesch: null };
  const wordList   = trimmed.split(/\s+/);
  const words      = wordList.length;
  const sentences  = (trimmed.match(/[^.!?]*[.!?]+/g) ?? []).length || 1;
  const paragraphs = trimmed.split(/\n{2,}/).filter(Boolean).length || 1;
  const mins       = words / 200;
  const readTime   = mins < 1 ? `${Math.round(mins * 60)}s` : `${Math.ceil(mins)}m`;
  const syllables  = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
  const flesch     = fleschScore(words, sentences, syllables);
  return { words, sentences, paragraphs, readTime, flesch };
}

function fleschLabel(score, tr) {
  if (score === null) return null;
  if (score >= 80) return { label: tr("readVeryEasy"), cls: "flesch-easy" };
  if (score >= 60) return { label: tr("readEasy"),    cls: "flesch-easy" };
  if (score >= 40) return { label: tr("readMedium"),  cls: "flesch-medium" };
  if (score >= 20) return { label: tr("readHard"),    cls: "flesch-hard" };
  return               { label: tr("readVeryHard"),   cls: "flesch-hard" };
}

function TextStats({ text, tr, detectedLang, detectingLang }) {
  const { words, sentences, paragraphs, readTime, flesch } = computeStats(text);
  const hasText = text.trim().length > 0;
  const fl = fleschLabel(flesch, tr);
  return (
    <div className={`text-stats ${hasText ? "text-stats-active" : ""}`}>
      <span className="stat-item"><span className="stat-value">{words}</span> {tr("words")}</span>
      <span className="stat-sep" />
      <span className="stat-item"><span className="stat-value">{sentences}</span> {tr("sentences")}</span>
      <span className="stat-sep" />
      <span className="stat-item"><span className="stat-value">{paragraphs}</span> {paragraphs === 1 ? tr("paragraph") : tr("paragraphs")}</span>
      <span className="stat-sep" />
      <span className="stat-item"><span className="stat-value">{readTime}</span> {tr("read")}</span>
      {fl && <>
        <span className="stat-sep" />
        <span className="stat-item">
          <span className="stat-value">{flesch}</span>
          <span className={`flesch-badge ${fl.cls}`}>{fl.label}</span>
        </span>
      </>}
      {detectingLang && <>
        <span className="stat-sep" />
        <span className={`lang-detect-badge detecting`}>{tr("detectingLang")}</span>
      </>}
      {!detectingLang && detectedLang && <>
        <span className="stat-sep" />
        <span className="lang-detect-badge">{tr("detectedLang", detectedLang)}</span>
      </>}
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
  if (type === "topic") return `${data.topic.main} — ${data.topic.tags?.join(", ")}\n${data.topic.description}`;
  return data.summary ?? data.rewritten ?? "";
}

// ── Result body renderer ──
function ResultBody({ item, tr }) {
  const { type, data, streaming } = item;

  if (type === "summary_short" || type === "summary_long" || type === "tone" || type === "improve") {
    return (
      <p className="result-text">
        {data.summary ?? data.rewritten}
        {streaming && <span className="stream-cursor" />}
      </p>
    );
  }
  if (type === "topic") {
    const { main, tags = [], description } = data.topic ?? {};
    return (
      <div className="topic-wrap">
        <div className="topic-top">
          <span className="topic-main-badge">{main}</span>
        </div>
        <div className="keywords-wrap" style={{ marginTop: "8px" }}>
          {tags.map((tag, i) => <span key={i} className="keyword-tag">{tag}</span>)}
        </div>
        {description && <p className="topic-description">{description}</p>}
      </div>
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

  // Right panel tabs
  const [rightTab, setRightTab] = useState("tools");

  // Language detection
  const [detectedLang, setDetectedLang] = useState(null);
  const [detectingLang, setDetectingLang] = useState(false);
  const detectDebounceRef = useRef(null);

  // Compare
  const [compareText2, setCompareText2] = useState("");
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const compareAbortRef = useRef(null);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatAbortRef = useRef(null);
  const chatBottomRef = useRef(null);

  const tr = (key, ...args) => t(key, responseLang, ...args);

  // Scroll to newest result
  useEffect(() => {
    if (history.length > 0) {
      historyBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history.length]);

  // Language detection (debounced, triggers after 2s when text > 30 chars)
  useEffect(() => {
    clearTimeout(detectDebounceRef.current);
    if (text.trim().length < 30) { setDetectedLang(null); setDetectingLang(false); return; }
    setDetectingLang(true);
    detectDebounceRef.current = setTimeout(async () => {
      try {
        const { language } = await detectLanguage(text);
        setDetectedLang(language);
      } catch { /* silent */ }
      setDetectingLang(false);
    }, 2000);
    return () => clearTimeout(detectDebounceRef.current);
  }, [text]);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

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

  const exportHistory = () => {
    if (history.length === 0) return;
    const lines = history.map((item) => {
      const label = getTypeLabel(item.type, tr);
      const time = formatTime(item.timestamp);
      const body = getPlainText(item);
      return `[${time}] ${label}\n${body}\n`;
    });
    const blob = new Blob([lines.join("\n---\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "textlens-history.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCompare = () => {
    const err = validateForSubmit(text, tr);
    if (err) { showError(err, "warning"); return; }
    if (compareText2.trim().length < MIN_CHARS) {
      showError(tr("errTooShort", compareText2.trim().length, MIN_CHARS), "warning");
      return;
    }
    clearError();
    if (compareAbortRef.current) compareAbortRef.current();
    setCompareResult("");
    setCompareLoading(true);
    compareAbortRef.current = streamCompare(
      text, compareText2,
      { response_lang: responseLang, model: selectedModel },
      {
        onChunk: (chunk) => setCompareResult((prev) => prev + chunk),
        onDone: () => { setCompareLoading(false); compareAbortRef.current = null; },
        onError: (msg) => { setCompareLoading(false); setCompareResult(null); showError(msg); },
      }
    );
  };

  const handleChat = () => {
    if (!chatInput.trim() || chatLoading) return;
    if (text.trim().length < MIN_CHARS) {
      showError(tr("chatNoContext"), "warning");
      return;
    }
    const userMsg = { role: "user", content: chatInput.trim() };
    const messagesForApi = [...chatMessages, userMsg];
    setChatMessages([...messagesForApi, { role: "assistant", content: "" }]);
    setChatInput("");
    setChatLoading(true);
    chatAbortRef.current = streamChat(
      text, messagesForApi,
      { response_lang: responseLang, model: selectedModel },
      {
        onChunk: (chunk) =>
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          }),
        onDone: () => { setChatLoading(false); chatAbortRef.current = null; },
        onError: (msg) => {
          setChatLoading(false);
          setChatMessages((prev) => prev.slice(0, -1));
          showError(msg);
        },
      }
    );
  };

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
        <div className="header-logo">
          <img src="/icono.ico" alt="TextLens" width="22" height="22" />
        </div>
        <h1>Text<span className="header-title-accent">Lens</span></h1>
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
              spellCheck={true}
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
            <TextStats text={text} tr={tr} detectedLang={detectedLang} detectingLang={detectingLang} />

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
                  : <><svg className="upload-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>{tr("uploadBtn")}</>
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
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="export-btn" onClick={exportHistory} title={tr("exportHistory")}>⬇ {tr("exportHistory")}</button>
                  <button className="clear-btn" onClick={clearHistory}>{tr("clearAll")}</button>
                </div>
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
        <div className={`right-panel ${rightTab === "chat" ? "right-panel-chat" : ""}`}>

          {/* Tab bar */}
          <div className="panel-tabs">
            <button className={`panel-tab ${rightTab === "tools" ? "panel-tab-active" : ""}`} onClick={() => setRightTab("tools")}>{tr("tabTools")}</button>
            <button className={`panel-tab ${rightTab === "compare" ? "panel-tab-active" : ""}`} onClick={() => setRightTab("compare")}>{tr("tabCompare")}</button>
            <button className={`panel-tab ${rightTab === "chat" ? "panel-tab-active" : ""}`} onClick={() => setRightTab("chat")}>{tr("tabChat")}</button>
          </div>

          {/* ── Tools tab ── */}
          {rightTab === "tools" && <>
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
          </>}

          {/* ── Compare tab ── */}
          {rightTab === "compare" && (
            <div className="compare-panel">
              <div className="panel-section" style={{ flex: "none" }}>
                <p className={`chat-context-note ${text.trim().length >= MIN_CHARS ? "chat-context-ok" : "chat-context-warn"}`}>
                  {text.trim().length >= MIN_CHARS ? `✓ ${tr("compareText1Label")}: ${tr("chatContextNote")}` : `⚠ ${tr("chatNoContext")}`}
                </p>
                <div className="compare-textarea-wrap" style={{ marginBottom: "12px" }}>
                  <label className="compare-label">{tr("compareText2Label")}</label>
                  <textarea
                    className="compare-textarea"
                    placeholder={tr("inputPlaceholder")}
                    value={compareText2}
                    onChange={(e) => setCompareText2(e.target.value.slice(0, MAX_CHARS))}
                    disabled={compareLoading}
                  />
                  <span className="compare-charcount">{compareText2.length}/{MAX_CHARS}</span>
                </div>
                <button className="run-btn indigo" onClick={handleCompare} disabled={compareLoading}>
                  {compareLoading ? tr("comparing") : tr("compareBtn")}
                </button>
              </div>
              {compareResult !== null && (
                <div className="panel-section" style={{ flex: "1", overflow: "auto" }}>
                  <p className="compare-result">
                    {compareResult}
                    {compareLoading && <span className="stream-cursor" />}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Chat tab ── */}
          {rightTab === "chat" && (
            <div className="chat-panel">
              <p className={`chat-context-note ${text.trim().length >= MIN_CHARS ? "chat-context-ok" : "chat-context-warn"}`}>
                {text.trim().length >= MIN_CHARS ? `✓ ${tr("chatContextNote")}` : `⚠ ${tr("chatNoContext")}`}
              </p>
              <div className="chat-messages">
                {chatMessages.length === 0 && (
                  <p className="chat-empty">{tr("chatPlaceholder")}</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-bubble chat-bubble-${msg.role}`}>
                    <p className="chat-bubble-text">
                      {msg.content || (msg.role === "assistant" && chatLoading && i === chatMessages.length - 1
                        ? <span className="chat-typing">{tr("chatTyping")}</span>
                        : null)}
                      {msg.role === "assistant" && msg.content && chatLoading && i === chatMessages.length - 1 && <span className="stream-cursor" />}
                    </p>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  type="text"
                  placeholder={tr("chatPlaceholder")}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleChat(); }}
                  disabled={chatLoading}
                />
                <button className="chat-send-btn" onClick={handleChat} disabled={chatLoading || !chatInput.trim()}>
                  {tr("chatSendBtn")}
                </button>
              </div>
              {chatMessages.length > 0 && (
                <button className="clear-btn" style={{ marginTop: "4px" }} onClick={() => {
                  if (chatAbortRef.current) chatAbortRef.current();
                  setChatMessages([]);
                  setChatLoading(false);
                }}>
                  {tr("chatClearBtn")}
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      <footer className="footer">{tr("footer")}</footer>
    </div>
  );
}
