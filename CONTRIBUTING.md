# Contributing to TextLens

Contributions are welcome via **fork and Pull Request only**. Direct pushes to `main` are not accepted — the branch is protected.

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

> **You must fork the repository.** Direct pushes to this repo are not permitted for external contributors.

1. **Fork** the repository on GitHub.

2. **Clone your fork** and create a feature branch:

   ```bash
   git clone https://github.com/your-username/TextLens.git
   cd TextLens
   git checkout -b feat/your-feature-name
   ```

3. **Make your changes.** Keep commits focused — one logical change per commit.

4. **Test manually** — start both backend and frontend and verify nothing is broken.

5. **Open a Pull Request** from your fork against the `main` branch of this repository. Include a clear description of what changed and why.

All PRs are reviewed before merging. PRs that push directly to `main` or bypass the fork workflow will be closed.

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
