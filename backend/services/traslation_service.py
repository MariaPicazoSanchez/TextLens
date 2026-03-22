from translate import Translator

def translate_text(text: str, to_lang: str = "es", from_lang: str = "auto") -> str:
	"""
	Traduce el texto dado al idioma especificado.
	:param text: Texto a traducir
	:param to_lang: Idioma destino (ej: 'es', 'en', 'fr')
	:param from_lang: Idioma origen (por defecto 'auto')
	:return: Texto traducido
	"""
	try:
		if from_lang and from_lang != "auto":
			translator = Translator(to_lang=to_lang, from_lang=from_lang)
		else:
			translator = Translator(to_lang=to_lang)
		translation = translator.translate(text)
		return translation
	except Exception as e:
		return f"Error en la traducción: {e}"
