LONG_ENOUGH = "This is a sufficiently long text for testing purposes in this application."


def test_text1_too_short(client):
    r = client.post(
        "/compare/stream",
        json={"text1": "short", "text2": LONG_ENOUGH},
    )
    assert r.status_code == 422


def test_text2_too_short(client):
    r = client.post(
        "/compare/stream",
        json={"text1": LONG_ENOUGH, "text2": "short"},
    )
    assert r.status_code == 422


def test_both_texts_too_short(client):
    r = client.post(
        "/compare/stream",
        json={"text1": "hi", "text2": "bye"},
    )
    assert r.status_code == 422


def test_compare_streams_sse(client, mock_groq):
    mock_create, _, make_stream_chunks = mock_groq
    mock_create.return_value = make_stream_chunks("Text A is shorter than Text B.")

    r = client.post(
        "/compare/stream",
        json={"text1": LONG_ENOUGH, "text2": LONG_ENOUGH + " extra content here."},
    )
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    assert b"data:" in r.content
