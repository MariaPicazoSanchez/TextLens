def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert "groq" in data
    assert "last_success_at" in data["groq"]
    assert "last_error_at" in data["groq"]
