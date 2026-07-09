from translate import Translator
from services.llm_service import detect_language

# The `translate` library has no real auto-detection: if `from_lang` is left
# out it silently assumes the source text is already English. So "auto" is
# resolved here via Groq's language detection instead.
_LANGUAGE_NAME_TO_CODE = {
	"english": "en", "spanish": "es", "french": "fr", "german": "de",
	"italian": "it", "portuguese": "pt", "dutch": "nl", "polish": "pl",
	"russian": "ru", "chinese": "zh", "japanese": "ja", "korean": "ko",
	"arabic": "ar", "turkish": "tr", "swedish": "sv", "ukrainian": "uk",
}


def _detect_source_lang(text: str) -> str | None:
	try:
		name = detect_language(text)["language"].strip().lower()
		return _LANGUAGE_NAME_TO_CODE.get(name)
	except Exception:
		return None


def translate_text(text: str, to_lang: str = "es", from_lang: str = "auto") -> str:
	"""
	Traduce el texto dado al idioma especificado.
	:param text: Texto a traducir
	:param to_lang: Idioma destino (ej: 'es', 'en', 'fr')
	:param from_lang: Idioma origen (por defecto 'auto', se detecta con Groq)
	:return: Texto traducido
	"""
	try:
		source_lang = from_lang if from_lang and from_lang != "auto" else _detect_source_lang(text)

		if source_lang == to_lang:
			return text

		if source_lang:
			translator = Translator(to_lang=to_lang, from_lang=source_lang)
		else:
			translator = Translator(to_lang=to_lang)

		return translator.translate(text)
	except Exception as e:
		return f"Error en la traducción: {e}"
