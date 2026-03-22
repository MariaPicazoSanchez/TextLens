import os
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

os.environ.setdefault("GROQ_API_KEY", "test-key")

from main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


def _make_completion(content: str):
    """Build a minimal mock of a non-streaming ChatCompletion."""
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    completion = MagicMock()
    completion.choices = [choice]
    return completion


def _make_stream_chunks(text: str):
    """Build a list of mock SSE stream chunks from a plain text."""
    chunks = []
    for word in text.split():
        delta = MagicMock()
        delta.content = word + " "
        choice = MagicMock()
        choice.delta = delta
        chunk = MagicMock()
        chunk.choices = [choice]
        chunks.append(chunk)
    # final chunk with no content
    delta_end = MagicMock()
    delta_end.content = None
    choice_end = MagicMock()
    choice_end.delta = delta_end
    chunk_end = MagicMock()
    chunk_end.choices = [choice_end]
    chunks.append(chunk_end)
    return chunks


@pytest.fixture
def mock_groq(monkeypatch):
    """Patches services.llm_service.client.chat.completions.create."""
    mock_create = MagicMock()
    monkeypatch.setattr(
        "services.llm_service.client.chat.completions.create", mock_create
    )
    return mock_create, _make_completion, _make_stream_chunks
