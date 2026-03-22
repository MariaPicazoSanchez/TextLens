# TextLens

## Overview

TextLens is a full-stack web application that leverages the **Groq API** (Llama 3.1 / 3.3) to perform a wide range of AI-driven text operations through a clean, responsive dark-theme interface. Responses stream token-by-token in real time. The UI is fully localized in **16 languages**.

---

## Features

### AI analysis

| Feature | Description |
|---|---|
| **Short summary** | Condenses text into 2–3 key sentences |
| **Long summary** | Full structured breakdown of the content |
| **Keywords** | Extracts the 8–10 most relevant terms |
| **Sentiment analysis** | Label (Positive / Negative / Neutral / Mixed), confidence score and explanation |
| **Topic classification** | Main category + specific tags + one-line description |
| **Tone rewrite** | Rewrites text in Formal, Casual, Positive, Negative, Persuasive or Simple tone |
| **Writing improvement** | Fixes grammar, spelling, punctuation and clarity while preserving style |
| **Q&A** | Answers any question grounded exclusively in the provided text |
| **Translation** | Translates text into any of 16 supported languages (up to 500 characters) |

### Input methods

| Feature | Description |
|---|---|
| **File upload** | Extracts text from PNG, JPG, WEBP images (OCR via Groq Vision) and PDF files |
| **Clipboard paste** | Paste images directly from clipboard with Ctrl+V |

### UI & UX

- **Streaming responses** — summaries, rewrites, Q&A and writing improvement stream token-by-token via SSE
- **Analysis history** — all results accumulate in a scrollable panel; copy or remove individual items
- **Real-time text statistics** — word count, sentence count, paragraphs, estimated reading time and Flesch readability index
- **Response language selector** — re-runs the entire history in the new language automatically
- **Model selector** — switch between Fast (Llama 3.1 8B Instant) and Quality (Llama 3.3 70B Versatile)
- **Full i18n** — all UI labels localized in 16 languages with English fallback

---

## Tech stack

### Backend

| | |
|---|---|
| **Runtime** | Python 3.10+ |
| **Framework** | FastAPI |
| **AI provider** | Groq API (`groq` SDK) |
| **LLM models** | `llama-3.1-8b-instant` · `llama-3.3-70b-versatile` · `meta-llama/llama-4-scout-17b-16e-instruct` (OCR) |
| **PDF extraction** | pypdf |
| **File uploads** | python-multipart |
| **Streaming** | Server-Sent Events (SSE) via `StreamingResponse` |

### Frontend

| | |
|---|---|
| **Framework** | React 19 + Vite |
| **Styling** | Plain CSS (dark theme, CSS Grid two-column layout) |
| **Streaming client** | Fetch + `ReadableStream` + SSE line parsing |
| **i18n** | Static dictionary (`i18n.js`) — 16 language packs, English fallback |

---

## Project structure

```
TextLens/
├── backend/
│   ├── main.py                        # FastAPI app, CORS, router registration
│   ├── requirements.txt
│   ├── .env                           # GROQ_API_KEY (not committed)
│   ├── .env.example
│   ├── routes/
│   │   ├── analyze.py                 # POST /analyze  &  POST /analyze/stream
│   │   ├── translate.py               # POST /translate
│   │   └── upload.py                  # POST /upload (OCR + PDF extraction)
│   └── services/
│       ├── llm_service.py             # Groq prompts, streaming, error wrapping
│       └── traslation_service.py      # translate library wrapper
└── frontend/
    ├── index.html
    ├── package.json
    └── src/
        ├── App.jsx                    # Main component — all state and UI
        ├── App.css                    # Dark theme styles
        ├── i18n.js                    # 16-language static dictionary + t() helper
        └── services/
            └── api.js                 # analyzeText, translateText, streamAnalyzeText, uploadFile
```

---

## Getting started

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- A free [Groq API key](https://console.groq.com)

---

### 1 — Clone the repository

```bash
git clone https://github.com/your-username/TextLens.git
cd TextLens
```

---

### 2 — Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and set your key:
# GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Start the development server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000`.
Interactive docs: `http://127.0.0.1:8000/docs`

---

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API reference

### `POST /analyze`

Runs a standard (non-streaming) analysis.

**Request body**

```json
{
  "text": "string",
  "type": "summary_short | summary_long | keywords | sentiment | topic | improve | tone | qa",
  "tone": "formal | casual | positive | negative | persuasive | simple",
  "question": "string",
  "response_lang": "English",
  "model": "fast | quality"
}
```

**Validation**

- `text`: minimum 15 characters, maximum 3 000 characters
- `tone`: required when `type` is `tone`
- `question`: required when `type` is `qa`

---

### `POST /analyze/stream`

Same request body as `/analyze`. Returns an SSE stream.
Streamable types: `summary_short`, `summary_long`, `tone`, `qa`, `improve`.

```
data: {"chunk": "token..."}
data: {"chunk": "token..."}
data: [DONE]
```

On error: `data: {"error": "message"}`

---

### `POST /translate`

```json
{
  "text": "string",
  "to_lang": "es",
  "from_lang": "auto"
}
```

Maximum 500 characters. Returns `{ "translation": "string" }`.

---

### `POST /upload`

Multipart form upload — field name: `file`.

| Format | Max size | Method |
|---|---|---|
| `image/png`, `image/jpeg`, `image/webp` | 4 MB | Groq Vision OCR |
| `application/pdf` | 5 MB | pypdf text extraction |

Returns `{ "text": "extracted content" }`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | API key from [console.groq.com](https://console.groq.com) |

---

## Readability index

TextLens computes the **Flesch Reading Ease** score in real time:

| Score | Level |
|---|---|
| 80 – 100 | Very easy |
| 60 – 79 | Easy |
| 40 – 59 | Medium |
| 20 – 39 | Difficult |
| 0 – 19 | Very hard |

> The Flesch formula is calibrated for English. Scores for other languages are indicative.

---

## Supported languages

English · Spanish · French · German · Italian · Portuguese · Dutch · Polish · Russian · Chinese · Japanese · Korean · Arabic · Turkish · Swedish · Ukrainian

---

## License

MIT
