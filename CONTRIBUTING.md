# Contributing

Thanks for your interest in contributing to ComposeGuard.

## Project Scope

This project reviews DevOps configuration files (Docker Compose, Dockerfile, Nginx) using:

- deterministic rules
- optional AI analysis
- autofix generation
- workflow visualization
- CLI and CI integration

## Development Setup

1. Fork the repository.
2. Create a feature branch from `main`.
3. Install dependencies:

```bash
npm install
```

4. Run locally:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Contribution Types

Good contributions include:

- New rules under `core/rules/`
- Safer autofix strategies under `core/fixes/`
- Parser robustness improvements under `core/parsers/`
- CLI enhancements in `bin/devops-ai.js` (exposed as `composeguard`)
- UI/UX improvements in `frontend/`
- Docs and examples updates

## Pull Request Guidelines

- Keep PRs focused and small when possible.
- Add or update docs for behavior changes.
- Preserve API response compatibility when possible.
- Include a short test plan in your PR description.
- Do not commit secrets, tokens, or private config files.

## Coding Conventions

- Use clear, descriptive names.
- Keep logic modular and reusable.
- Prefer deterministic behavior for rule checks and fixes.
- Treat autofixes conservatively; use confidence levels when uncertain.

## Rule Contribution Checklist

When adding a rule:

- Add a unique rule ID (for example `DC009`, `DF007`, `NG008`).
- Include severity and category.
- Provide simple and expert explanations.
- Add fix metadata when autofix is feasible.
- Ensure rule output works with profile filtering.

## Reporting Issues

When opening issues, include:

- File sample (sanitized)
- Expected behavior
- Actual behavior
- Steps to reproduce
- Logs or API response snippets if relevant

## Code of Conduct

By participating, you agree to follow `CODE_OF_CONDUCT.md`.

