# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-03-22

### Added

**AI analysis**
- Short summary (2–3 sentences, streaming)
- Long summary (full breakdown, streaming)
- Keyword extraction (8–10 key terms)
- Sentiment analysis (label + confidence score + explanation)
- Topic classification (main category + tags + description)
- Tone rewrite — Formal, Casual, Positive, Negative, Persuasive, Simple (streaming)
- Writing improvement — grammar, spelling, clarity (streaming)
- Q&A — answers grounded in the provided text (streaming)
- Translation to 16 languages (up to 500 characters)

**Input**
- File upload: OCR for PNG, JPG, WEBP via Groq Vision (max 4 MB)
- File upload: text extraction from PDF via pypdf (max 5 MB)
- Clipboard image paste via Ctrl+V

**UI & UX**
- Real-time text statistics: words, sentences, paragraphs, reading time, Flesch readability index
- Analysis history with copy and remove per item
- Response language selector — re-runs full history on change
- Model selector: Fast (Llama 3.1 8B) / Quality (Llama 3.3 70B)
- Server-Sent Events streaming with live cursor
- Full i18n in 16 languages: English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, Korean, Arabic, Turkish, Swedish, Ukrainian
- Dark theme, two-column layout, responsive

**Backend**
- FastAPI with `/analyze`, `/analyze/stream`, `/translate`, `/upload` endpoints
- Groq API integration with error wrapping (401, 429, 502, 503)
- Input validation at route level (min/max chars, valid types, required fields)

**Repository**
- MIT License
- CI workflow (GitHub Actions) — backend import check + frontend build
- Issue templates: bug report, feature request
- Branch protection on `main`
- Contributing guide
