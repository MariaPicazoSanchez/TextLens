import io


def test_unsupported_file_type(client):
    data = io.BytesIO(b"hello world")
    r = client.post("/upload", files={"file": ("test.txt", data, "text/plain")})
    assert r.status_code == 400
    assert "unsupported" in r.json()["detail"].lower()


def test_image_too_large(client):
    large_content = b"x" * (4 * 1024 * 1024 + 1)  # 4 MB + 1 byte
    r = client.post(
        "/upload",
        files={"file": ("big.png", io.BytesIO(large_content), "image/png")},
    )
    assert r.status_code == 400
    assert "too large" in r.json()["detail"].lower()


def test_pdf_too_large(client):
    large_content = b"x" * (5 * 1024 * 1024 + 1)  # 5 MB + 1 byte
    r = client.post(
        "/upload",
        files={"file": ("big.pdf", io.BytesIO(large_content), "application/pdf")},
    )
    assert r.status_code == 400
    assert "too large" in r.json()["detail"].lower()


def test_empty_pdf(client):
    # minimal PDF with no text pages
    empty_pdf = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
        b"xref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n"
        b"0000000058 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n110\n%%EOF"
    )
    r = client.post(
        "/upload",
        files={"file": ("empty.pdf", io.BytesIO(empty_pdf), "application/pdf")},
    )
    assert r.status_code == 400
