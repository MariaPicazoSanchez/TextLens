CONTEXT = "This is the document context for the chat session used in testing."
USER_MSG = {"role": "user", "content": "What is the main topic?"}


def test_empty_messages_still_accepted(client, mock_groq):
    """Empty messages list is valid — context alone is enough."""
    mock_create, _, make_stream_chunks = mock_groq
    mock_create.return_value = make_stream_chunks("The main topic is testing.")

    r = client.post(
        "/chat/stream",
        json={"context": CONTEXT, "messages": []},
    )
    assert r.status_code == 200


def test_chat_streams_sse(client, mock_groq):
    mock_create, _, make_stream_chunks = mock_groq
    mock_create.return_value = make_stream_chunks("The main topic is testing.")

    r = client.post(
        "/chat/stream",
        json={"context": CONTEXT, "messages": [USER_MSG]},
    )
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    assert b"data:" in r.content


def test_chat_with_history(client, mock_groq):
    mock_create, _, make_stream_chunks = mock_groq
    mock_create.return_value = make_stream_chunks("Yes, that is correct.")

    messages = [
        {"role": "user", "content": "Is this a test?"},
        {"role": "assistant", "content": "Yes."},
        {"role": "user", "content": "Are you sure?"},
    ]
    r = client.post(
        "/chat/stream",
        json={"context": CONTEXT, "messages": messages},
    )
    assert r.status_code == 200


def test_chat_missing_context_field(client):
    r = client.post("/chat/stream", json={"messages": [USER_MSG]})
    assert r.status_code == 422


def test_chat_missing_messages_field(client):
    r = client.post("/chat/stream", json={"context": CONTEXT})
    assert r.status_code == 422
