# Security Policy

## Supported Versions

This project is currently pre-1.0 and developed on the `main` branch.
Security fixes are applied to the latest code first.

## Reporting a Vulnerability

Please do **not** open public GitHub issues for sensitive vulnerabilities.

Instead:

1. Share a private report with maintainers.
2. Include clear reproduction steps, affected files, and impact.
3. Include any proof-of-concept only if necessary.

When reporting, please provide:

- Vulnerability type
- Attack scenario
- Severity/impact assessment
- Suggested mitigation (if known)

## Response Expectations

- Initial acknowledgment target: within 72 hours
- Triage and validation: as soon as possible
- Fix timeline: based on severity and maintainers' availability

## Responsible Disclosure

- Do not publicly disclose details until a fix is available.
- Once fixed, maintainers may publish an advisory with credit (if requested).

## Security Notes for Contributors

- Never commit API keys, tokens, credentials, or private certs.
- Keep `.env` out of version control; use `.env.example`.
- Sanitize user-provided config snippets before sharing publicly.
- Prefer deterministic checks over risky auto-remediation when uncertain.

