# TextLens

TextLens is a web app that analyzes and transforms text using AI. Paste any text and get summaries, keywords, sentiment analysis, or a rewrite in a different tone — all powered by the Groq API (free).

## Features

- **Short summary** — condenses the text into 2-3 sentences
- **Long summary** — detailed summary covering all key points
- **Keywords** — extracts the 8-10 most relevant keywords/phrases
- **Sentiment analysis** — detects if the tone is Positive, Negative, Neutral or Mixed, with a confidence score and explanation
- **Tone change** — rewrites the text in a selected tone: Formal, Casual, Positive, Negative, Persuasive, or Simple

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Python + FastAPI |
| AI | Groq API (Llama 3.1 8B) |

## Prerequisites

- Node.js
- Python 3.9+
- A free Groq API key → [console.groq.com](https://console.groq.com)

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-username/TextLens.git
cd TextLens
```

### 2. Backend

```bash
cd backend

# Create and activate a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Open .env and set your key:
# GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Start the server
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will open at `http://localhost:5173`.

## Project structure

```
TextLens/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   └── analyze.py        # /analyze endpoint
│   └── services/
│       └── llm_service.py    # Groq API calls
└── frontend/
    └── src/
        ├── App.jsx            # Main UI
        └── services/
            └── api.js         # Fetch calls to backend
```

## API

### `POST /analyze`

| Field | Type | Description |
|---|---|---|
| `text` | string | The text to analyze |
| `type` | string | One of: `summary_short`, `summary_long`, `keywords`, `sentiment`, `tone` |
| `tone` | string | Required when `type` is `tone`. One of: `formal`, `casual`, `positive`, `negative`, `persuasive`, `simple` |
