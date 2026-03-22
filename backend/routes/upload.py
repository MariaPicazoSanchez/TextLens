import base64
import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from groq import AuthenticationError, RateLimitError, APIConnectionError, APIStatusError
from services.llm_service import client

router = APIRouter()

MAX_IMAGE_BYTES = 4 * 1024 * 1024   # 4 MB
MAX_PDF_BYTES   = 5 * 1024 * 1024   # 5 MB

SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
OCR_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def _ocr_image(content: bytes, content_type: str) -> str:
    b64 = base64.standard_b64encode(content).decode()
    try:
        response = client.chat.completions.create(
            model=OCR_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{content_type};base64,{b64}"},
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract all text from this image exactly as it appears. "
                            "Return only the raw text, preserving line breaks. "
                            "No commentary, no formatting additions."
                        ),
                    },
                ],
            }],
            max_tokens=2048,
        )
    except AuthenticationError:
        raise HTTPException(401, "Invalid or missing Groq API key.")
    except RateLimitError:
        raise HTTPException(429, "Groq rate limit reached. Wait a moment and try again.")
    except APIConnectionError:
        raise HTTPException(503, "Could not connect to Groq API.")
    except APIStatusError as e:
        raise HTTPException(502, f"Groq API error ({e.status_code}): {e.message}")

    return response.choices[0].message.content.strip()


def _extract_pdf(content: bytes) -> str:
    try:
        import pypdf
    except ImportError:
        raise HTTPException(500, "pypdf is not installed. Run: pip install pypdf")

    reader = pypdf.PdfReader(io.BytesIO(content))
    if len(reader.pages) == 0:
        raise HTTPException(400, "The PDF has no readable pages.")

    pages_text = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            pages_text.append(t.strip())

    text = "\n\n".join(pages_text).strip()
    if not text:
        raise HTTPException(400, "No text could be extracted from the PDF. It may be a scanned image-only PDF.")
    return text


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content_type = (file.content_type or "").split(";")[0].strip()

    if content_type in SUPPORTED_IMAGE_TYPES:
        content = await file.read()
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(400, f"Image is too large ({len(content) // 1024} KB). Maximum is 4 MB.")
        text = _ocr_image(content, content_type)

    elif content_type == "application/pdf":
        content = await file.read()
        if len(content) > MAX_PDF_BYTES:
            raise HTTPException(400, f"PDF is too large ({len(content) // 1024} KB). Maximum is 5 MB.")
        text = _extract_pdf(content)

    else:
        raise HTTPException(400, f"Unsupported file type '{content_type}'. Use PNG, JPG, WEBP, or PDF.")

    if not text:
        raise HTTPException(422, "No text could be extracted from the file.")

    return {"text": text}
