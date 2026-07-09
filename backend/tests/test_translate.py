def test_translate_auto_detects_source_language(client, mock_groq):
    mock_create, make_completion, _ = mock_groq
    mock_create.return_value = make_completion("Spanish")

    r = client.post(
        "/translate",
        json={"text": "hola como estamos", "to_lang": "en", "from_lang": "auto"},
    )
    assert r.status_code == 200
    assert r.json()["translation"] != "hola como estamos"


def test_translate_same_source_and_target_is_noop(client, mock_groq):
    mock_create, make_completion, _ = mock_groq
    mock_create.return_value = make_completion("English")

    r = client.post(
        "/translate",
        json={"text": "hello there", "to_lang": "en", "from_lang": "auto"},
    )
    assert r.status_code == 200
    assert r.json()["translation"] == "hello there"


def test_translate_explicit_from_lang_skips_detection(client, mock_groq):
    mock_create, _, _ = mock_groq

    r = client.post(
        "/translate",
        json={"text": "hola como estamos", "to_lang": "en", "from_lang": "es"},
    )
    assert r.status_code == 200
    mock_create.assert_not_called()
