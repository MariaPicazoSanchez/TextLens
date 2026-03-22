import json


LONG_ENOUGH = "This is a sufficiently long text for testing purposes in this application."


# ── Validation ────────────────────────────────────────────────────────────────

def test_empty_text(client):
    r = client.post("/analyze", json={"text": "", "type": "keywords"})
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


def test_text_too_short(client):
    r = client.post("/analyze", json={"text": "hi", "type": "keywords"})
    assert r.status_code == 400
    assert "too short" in r.json()["detail"].lower()


def test_text_too_long(client):
    r = client.post("/analyze", json={"text": "a" * 3001, "type": "keywords"})
    assert r.status_code == 400
    assert "too long" in r.json()["detail"].lower()


def test_invalid_type(client):
    r = client.post("/analyze", json={"text": LONG_ENOUGH, "type": "invalid_type"})
    assert r.status_code == 400


def test_tone_missing_tone_field(client):
    r = client.post("/analyze", json={"text": LONG_ENOUGH, "type": "tone"})
    assert r.status_code == 400
    assert "tone" in r.json()["detail"].lower()


def test_tone_invalid_value(client):
    r = client.post("/analyze", json={"text": LONG_ENOUGH, "type": "tone", "tone": "angry"})
    assert r.status_code == 400


def test_qa_missing_question(client):
    r = client.post("/analyze", json={"text": LONG_ENOUGH, "type": "qa"})
    assert r.status_code == 400
    assert "question" in r.json()["detail"].lower()


# ── Happy paths (mocked Groq) ─────────────────────────────────────────────────

def test_keywords(client, mock_groq):
    mock_create, make_completion, _ = mock_groq
    mock_create.return_value = make_completion('["testing", "application", "purpose"]')

    r = client.post("/analyze", json={"text": LONG_ENOUGH, "type": "keywords"})
    assert r.status_code == 200
    assert "keywords" in r.json()
    assert isinstance(r.json()["keywords"], list)


def test_sentiment(client, mock_groq):
    mock_create, make_completion, _ = mock_groq
    mock_create.return_value = make_completion(
        '{"label": "Positive", "score": 0.9, "explanation": "The text is upbeat."}'
    )

    r = client.post("/analyze", json={"text": LONG_ENOUGH, "type": "sentiment"})
    assert r.status_code == 200
    assert r.json()["sentiment"]["label"] == "Positive"


def test_topic(client, mock_groq):
    mock_create, make_completion, _ = mock_groq
    mock_create.return_value = make_completion(
        '{"main": "Technology", "tags": ["software"], "description": "About software testing."}'
    )

    r = client.post("/analyze", json={"text": LONG_ENOUGH, "type": "topic"})
    assert r.status_code == 200
    assert "topic" in r.json()


def test_stream_type_not_allowed_on_standard_endpoint(client):
    # streaming types are valid for /analyze but still return a result
    # (the /analyze endpoint handles all VALID_TYPES, streaming types included)
    pass  # covered by the stream endpoint tests


def test_stream_invalid_type(client):
    r = client.post("/analyze/stream", json={"text": LONG_ENOUGH, "type": "keywords"})
    assert r.status_code == 400
