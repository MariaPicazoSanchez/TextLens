def test_text_too_short(client):
    r = client.post("/detect", json={"text": "hi"})
    assert r.status_code == 422  # pydantic field_validator raises ValueError → 422


def test_text_exactly_threshold(client):
    # 9 chars — still too short
    r = client.post("/detect", json={"text": "123456789"})
    assert r.status_code == 422


def test_detect_happy(client, mock_groq):
    mock_create, make_completion, _ = mock_groq
    mock_create.return_value = make_completion("Spanish")

    r = client.post("/detect", json={"text": "Este es un texto de prueba largo"})
    assert r.status_code == 200
    assert r.json()["language"] == "Spanish"
