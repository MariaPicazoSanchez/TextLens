import os
import json
from groq import Groq, AuthenticationError, RateLimitError, APIConnectionError, APIStatusError
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

_api_key = os.environ.get("GROQ_API_KEY")
if not _api_key:
    raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")

client = Groq(api_key=_api_key)

MODELS = {
    "fast":    "llama-3.1-8b-instant",
    "quality": "llama-3.3-70b-versatile",
}
DEFAULT_MODEL = "fast"

# ── Prompts ──────────────────────────────────────────────────────────────────

def _summary_prompt(text: str, mode: str, lang: str) -> str:
    if mode == "short":
        return (f"Summarize the following text in exactly 2-3 sentences. "
                f"Reply with only the summary, no extra commentary. Respond in {lang}.\n\n{text}")
    return (f"Write a detailed summary of the following text, covering all key points. "
            f"Reply with only the summary, no extra commentary. Respond in {lang}.\n\n{text}")

def _tone_prompt(text: str, tone: str, lang: str) -> str:
    descriptions = {
        "formal": "formal and professional", "casual": "casual and friendly",
        "positive": "positive and optimistic", "negative": "negative and critical",
        "persuasive": "persuasive and convincing",
        "simple": "simple and easy to understand for a general audience",
    }
    tone_desc = descriptions.get(tone, tone)
    return (f"Rewrite the following text in a {tone_desc} tone. "
            f"Keep the same meaning but change the style. "
            f"Reply with only the rewritten text, no commentary. Respond in {lang}.\n\n{text}")

def _topic_prompt(text: str, lang: str) -> str:
    return (f"Classify the main topic of the following text. "
            f"Return ONLY a JSON object with these fields: "
            f"\"main\" (one broad category, e.g. Technology, Politics, Science, Health, Business, Sports, Culture, Education, Environment, Law, Other), "
            f"\"tags\" (array of 3-5 specific topic tags), "
            f"\"description\" (one sentence describing what the text is about, written in {lang}). "
            f"No extra text, just the JSON.\n\n{text}")

def _improve_prompt(text: str, lang: str) -> str:
    return (f"Improve the writing of the following text. Fix grammar, spelling, punctuation, and clarity. "
            f"Improve sentence structure and flow where needed, but keep the original meaning, tone, and style. "
            f"Reply with only the improved text, no commentary, no explanations. Respond in {lang}.\n\n{text}")

def _qa_prompt(text: str, question: str, lang: str) -> str:
    return (f"Answer the following question based exclusively on the text provided. "
            f"If the answer cannot be found in the text, say so clearly. "
            f"Be concise and direct. Respond in {lang}.\n\n"
            f"Text:\n{text}\n\nQuestion: {question}")

# ── Error wrapper ─────────────────────────────────────────────────────────────

def _wrap_errors(fn):
    """Decorator that maps Groq exceptions to HTTPException."""
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except AuthenticationError:
            raise HTTPException(401, "Invalid or missing Groq API key. Check your .env file.")
        except RateLimitError:
            raise HTTPException(429, "Groq rate limit reached. Wait a moment and try again.")
        except APIConnectionError:
            raise HTTPException(503, "Could not connect to Groq API. Check your internet connection.")
        except APIStatusError as e:
            raise HTTPException(502, f"Groq API error: {e.message}")
    return wrapper

# ── Standard (non-streaming) ──────────────────────────────────────────────────

@_wrap_errors
def _chat(prompt: str, model_key: str = DEFAULT_MODEL) -> str:
    response = client.chat.completions.create(
        model=MODELS.get(model_key, MODELS[DEFAULT_MODEL]),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def summarize(text: str, mode: str, lang: str = "English", model: str = DEFAULT_MODEL) -> dict:
    return {"summary": _chat(_summary_prompt(text, mode, lang), model)}


def extract_keywords(text: str, lang: str = "English", model: str = DEFAULT_MODEL) -> dict:
    prompt = (f"Extract the 8-10 most important keywords or key phrases from the following text. "
              f"Return ONLY a JSON array of strings, nothing else. Example: [\"keyword1\", \"keyword2\"]. "
              f"The keywords must be in {lang}.\n\n{text}")
    raw = _chat(prompt, model)
    try:
        keywords = json.loads(raw[raw.index("["):raw.rindex("]") + 1])
    except (ValueError, json.JSONDecodeError):
        keywords = [kw.strip("- ").strip() for kw in raw.splitlines() if kw.strip()]
    return {"keywords": keywords}


def analyze_sentiment(text: str, lang: str = "English", model: str = DEFAULT_MODEL) -> dict:
    prompt = (f"Analyze the sentiment of the following text. "
              f"Return ONLY a JSON object with these fields: "
              f"\"label\" (one of: Positive, Negative, Neutral, Mixed), "
              f"\"score\" (confidence from 0.0 to 1.0), "
              f"\"explanation\" (one sentence explaining why, written in {lang}). "
              f"No extra text, just the JSON.\n\n{text}")
    raw = _chat(prompt, model)
    try:
        sentiment = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
    except (ValueError, json.JSONDecodeError):
        sentiment = {"label": "Unknown", "score": 0.0, "explanation": raw}
    return {"sentiment": sentiment}


def answer_question(text: str, question: str, lang: str = "English", model: str = DEFAULT_MODEL) -> dict:
    return {"answer": _chat(_qa_prompt(text, question, lang), model)}


def change_tone(text: str, tone: str, lang: str = "English", model: str = DEFAULT_MODEL) -> dict:
    return {"rewritten": _chat(_tone_prompt(text, tone, lang), model)}


def classify_topic(text: str, lang: str = "English", model: str = DEFAULT_MODEL) -> dict:
    raw = _chat(_topic_prompt(text, lang), model)
    try:
        topic = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
    except (ValueError, json.JSONDecodeError):
        topic = {"main": "Unknown", "tags": [], "description": raw}
    return {"topic": topic}


def improve_writing(text: str, lang: str = "English", model: str = DEFAULT_MODEL) -> dict:
    return {"rewritten": _chat(_improve_prompt(text, lang), model)}

# ── Streaming ─────────────────────────────────────────────────────────────────

def _chat_stream(prompt: str, model_key: str = DEFAULT_MODEL):
    """Yields raw text chunks from Groq. Raises HTTPException on API errors."""
    try:
        stream = client.chat.completions.create(
            model=MODELS.get(model_key, MODELS[DEFAULT_MODEL]),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except AuthenticationError:
        raise HTTPException(401, "Invalid or missing Groq API key. Check your .env file.")
    except RateLimitError:
        raise HTTPException(429, "Groq rate limit reached. Wait a moment and try again.")
    except APIConnectionError:
        raise HTTPException(503, "Could not connect to Groq API. Check your internet connection.")
    except APIStatusError as e:
        raise HTTPException(502, f"Groq API error: {e.message}")


def improve_writing_stream(text: str, lang: str = "English", model: str = DEFAULT_MODEL):
    return _chat_stream(_improve_prompt(text, lang), model)


def summarize_stream(text: str, mode: str, lang: str = "English", model: str = DEFAULT_MODEL):
    return _chat_stream(_summary_prompt(text, mode, lang), model)


def change_tone_stream(text: str, tone: str, lang: str = "English", model: str = DEFAULT_MODEL):
    return _chat_stream(_tone_prompt(text, tone, lang), model)


def answer_question_stream(text: str, question: str, lang: str = "English", model: str = DEFAULT_MODEL):
    return _chat_stream(_qa_prompt(text, question, lang), model)
