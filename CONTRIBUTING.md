# Contributing to TextLens

Thank you for your interest in contributing! This document explains how to get the project running locally and how to submit changes.

---

## Development setup

Follow the steps in the [README](./README.md#getting-started) to run both the backend and the frontend locally.

Make sure you have a valid `GROQ_API_KEY` in `backend/.env` before starting.

---

## Project structure

```
backend/    FastAPI API — routes, services, Groq integration
frontend/   React + Vite UI — components, styles, i18n
```

---

## How to contribute

1. **Fork** the repository and create a new branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes.** Keep commits focused — one logical change per commit.

3. **Test manually** — start both backend and frontend and verify nothing is broken.

4. **Open a Pull Request** against `main` with a clear description of what changed and why.

---

## Guidelines

### Backend

- Add new analysis types in `backend/services/llm_service.py` (prompt + function) and register them in `backend/routes/analyze.py`.
- Keep prompts deterministic (`temperature=0.3`) and always include a `Respond in {lang}` instruction.
- Wrap all Groq calls in `_wrap_errors` or the `_chat_stream` try/except block so HTTP errors stay consistent.

### Frontend

- All user-visible strings must go through `i18n.js`. Add the key to every language block (or at least English — the fallback handles the rest).
- New result types need an entry in `TYPE_ICONS`, `getTypeLabel`, `dataKey`, `getPlainText` and a case in `ResultBody`.
- Streaming types must be added to `STREAM_TYPES` (frontend) and `STREAM_TYPES` (backend route).

### Style

- Follow the existing code style — no linter is enforced, but keep indentation and naming consistent.
- Do not commit `node_modules/`, `__pycache__/`, `.env`, or `.venv`.

---

## Reporting issues

Please use the GitHub issue templates:

- **Bug report** — unexpected behaviour, errors, or broken features.
- **Feature request** — ideas for new analysis types, UI improvements, or integrations.

---

## License

By contributing you agree that your changes will be released under the [MIT License](./LICENSE).
