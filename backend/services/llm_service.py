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
MODEL = "llama-3.1-8b-instant"


def _chat(prompt: str) -> str:
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid or missing Groq API key. Check your .env file.")
    except RateLimitError:
        raise HTTPException(status_code=429, detail="Groq rate limit reached. Wait a moment and try again.")
    except APIConnectionError:
        raise HTTPException(status_code=503, detail="Could not connect to Groq API. Check your internet connection.")
    except APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {e.message}")


def summarize(text: str, mode: str, lang: str = "English") -> dict:
    if mode == "short":
        prompt = (
            f"Summarize the following text in exactly 2-3 sentences. "
            f"Reply with only the summary, no extra commentary. Respond in {lang}.\n\n{text}"
        )
    else:
        prompt = (
            f"Write a detailed summary of the following text, covering all key points. "
            f"Reply with only the summary, no extra commentary. Respond in {lang}.\n\n{text}"
        )
    return {"summary": _chat(prompt)}


def extract_keywords(text: str, lang: str = "English") -> dict:
    prompt = (
        f"Extract the 8-10 most important keywords or key phrases from the following text. "
        f"Return ONLY a JSON array of strings, nothing else. Example: [\"keyword1\", \"keyword2\"]. "
        f"The keywords must be in {lang}.\n\n{text}"
    )
    raw = _chat(prompt)
    try:
        start = raw.index("[")
        end = raw.rindex("]") + 1
        keywords = json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        keywords = [kw.strip("- ").strip() for kw in raw.splitlines() if kw.strip()]
    return {"keywords": keywords}


def analyze_sentiment(text: str, lang: str = "English") -> dict:
    prompt = (
        f"Analyze the sentiment of the following text. "
        f"Return ONLY a JSON object with these fields: "
        f"\"label\" (one of: Positive, Negative, Neutral, Mixed), "
        f"\"score\" (confidence from 0.0 to 1.0), "
        f"\"explanation\" (one sentence explaining why, written in {lang}). "
        f"No extra text, just the JSON.\n\n{text}"
    )
    raw = _chat(prompt)
    try:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        sentiment = json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        sentiment = {"label": "Unknown", "score": 0.0, "explanation": raw}
    return {"sentiment": sentiment}


def change_tone(text: str, tone: str, lang: str = "English") -> dict:
    tone_descriptions = {
        "formal": "formal and professional",
        "casual": "casual and friendly",
        "positive": "positive and optimistic",
        "negative": "negative and critical",
        "persuasive": "persuasive and convincing",
        "simple": "simple and easy to understand for a general audience",
    }
    tone_desc = tone_descriptions.get(tone, tone)
    prompt = (
        f"Rewrite the following text in a {tone_desc} tone. "
        f"Keep the same meaning but change the style. "
        f"Reply with only the rewritten text, no commentary. Respond in {lang}.\n\n{text}"
    )
    return {"rewritten": _chat(prompt)}
