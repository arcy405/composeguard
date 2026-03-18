# ComposeGuard (Phase 2)

ComposeGuard is a hybrid DevOps config reviewer that combines deterministic rules with optional AI analysis.

## What it does

- Reviews `docker-compose.yml`, `Dockerfile`, and `nginx.conf`
- Returns severity-based issues and practical explanations
- Suggests quick fixes (`before`/`after`)
- Generates file-level patched outputs and patch previews
- Uses line-level unified diff patch previews
- Includes a DevOps workflow visualizer with issue hotspots and remediation steps
- Supports policy profiles (`startup`, `production`, `enterprise`)
- Supports selective apply by issue IDs with fix confidence (`safe` vs `review_required`)
- Returns score delta after apply (`before`, `after`, `delta`)
- Produces scores for security, performance, and production readiness
- Includes a CLI for local/CI usage
- Includes GitHub Actions integration for PR checks
- Supports SARIF export for code scanning workflows
- Supports repository scan mode via CLI

## Stack

- Backend: Node.js + Express
- Rule parsing: `js-yaml` + lightweight text parsing
- AI layer: OpenAI Chat Completions (optional via `OPENAI_API_KEY`)
- Frontend: simple static web UI served by Express

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## API

`POST /api/review` as `multipart/form-data` with field name `files`.

`POST /api/apply-fixes` with the same input format to return patched file contents.

`POST /api/export/sarif` with the same input format to return SARIF payload.

Optional request fields for both endpoints:

- `profile`: `startup|production|enterprise` (default `production`)
- `issue_ids`: array of issue IDs (or comma-separated string)
- `safe_only`: boolean (`true` by default on apply route)

Example response:

```json
{
  "files": ["docker-compose.yml"],
  "issues": [],
  "suggestions": [],
  "fixes": [],
  "file_fixes": [
    {
      "file": "docker-compose.yml",
      "issue_ids": ["DC001"],
      "patch": "--- a/docker-compose.yml\n+++ b/docker-compose.yml\n...",
      "patched_content": "..."
    }
  ],
  "scores": {
    "security": 10,
    "performance": 10,
    "production_readiness": 10,
    "overall": 10
  }
}
```

## CLI

```bash
composeguard review docker-compose.yml Dockerfile nginx.conf --api http://127.0.0.1:3000 --profile enterprise --fail-on high
composeguard apply docker-compose.yml Dockerfile nginx.conf --api http://127.0.0.1:3000 --profile production --issue-ids DC002,NG001 --safe-only true --out-dir .composeguard-fixed
composeguard scan . --api http://127.0.0.1:3000 --profile enterprise --format sarif --output composeguard-report.sarif
```

- `--api` defaults to `http://127.0.0.1:3000`
- `--fail-on` exits non-zero when matching severity or above is found (`low|medium|high|critical`)
- `--out-dir` controls where patched files are written for `apply` (default `.composeguard-fixed`)
- `--profile` sets policy profile (`startup|production|enterprise`)
- `--issue-ids` applies only selected issue IDs for `apply`
- `--safe-only` applies only `safe` confidence fixes for `apply` (default `true`)
- `scan` discovers supported files recursively (`docker-compose`, `Dockerfile`, `*.dockerfile`, `nginx*.conf`)
- `--format` for `scan`: `text|json|sarif`
- `--output` writes `scan` results to file

Note: `devops-ai` remains available as a backward-compatible CLI alias.

## GitHub Action

The repository contains `.github/workflows/devops-review.yml`.

On pull requests, it:

- starts reviewer API
- detects changed config files (`docker-compose`, `Dockerfile`, `nginx*.conf`)
- runs CLI review
- fails the workflow on `high`/`critical` findings

## Optional AI

Set these env vars:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)

Without API key, deterministic rule analysis still works.

# composeguard
