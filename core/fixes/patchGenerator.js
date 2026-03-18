import yaml from "js-yaml";
import { parseDockerCompose } from "../parsers/dockerCompose.js";
import { parseDockerfile } from "../parsers/dockerfile.js";
import { parseNginx } from "../parsers/nginx.js";

function toLines(text) {
  return text.split(/\r?\n/);
}

function buildLcsTable(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  return dp;
}

function buildLineOps(originalLines, updatedLines) {
  const dp = buildLcsTable(originalLines, updatedLines);
  const ops = [];
  let i = 0;
  let j = 0;

  while (i < originalLines.length && j < updatedLines.length) {
    if (originalLines[i] === updatedLines[j]) {
      ops.push({ type: "context", line: originalLines[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "remove", line: originalLines[i], oldLine: i + 1, newLine: null });
      i += 1;
    } else {
      ops.push({ type: "add", line: updatedLines[j], oldLine: null, newLine: j + 1 });
      j += 1;
    }
  }

  while (i < originalLines.length) {
    ops.push({ type: "remove", line: originalLines[i], oldLine: i + 1, newLine: null });
    i += 1;
  }
  while (j < updatedLines.length) {
    ops.push({ type: "add", line: updatedLines[j], oldLine: null, newLine: j + 1 });
    j += 1;
  }

  return ops;
}

function buildHunks(ops, contextSize = 3) {
  const changeIndices = ops
    .map((op, index) => (op.type === "context" ? -1 : index))
    .filter((index) => index >= 0);

  if (!changeIndices.length) return [];

  const windows = changeIndices.map((idx) => ({
    start: Math.max(0, idx - contextSize),
    end: Math.min(ops.length - 1, idx + contextSize)
  }));

  const merged = [];
  for (const window of windows) {
    const last = merged[merged.length - 1];
    if (!last || window.start > last.end + 1) {
      merged.push({ ...window });
    } else {
      last.end = Math.max(last.end, window.end);
    }
  }

  return merged.map((range) => ops.slice(range.start, range.end + 1));
}

function hunkRange(hunkOps, key) {
  const lines = hunkOps
    .map((op) => op[key])
    .filter((value) => Number.isInteger(value));

  if (!lines.length) {
    return { start: 0, count: 0 };
  }
  const start = Math.min(...lines);
  const end = Math.max(...lines);
  return { start, count: end - start + 1 };
}

function buildUnifiedPatch(original, updated, fileName) {
  if (original === updated) return "";

  const originalLines = toLines(original);
  const updatedLines = toLines(updated);
  const ops = buildLineOps(originalLines, updatedLines);
  const hunks = buildHunks(ops, 3);
  const output = [`--- a/${fileName}`, `+++ b/${fileName}`];

  for (const hunk of hunks) {
    const oldRange = hunkRange(hunk, "oldLine");
    const newRange = hunkRange(hunk, "newLine");
    output.push(
      `@@ -${oldRange.start},${oldRange.count} +${newRange.start},${newRange.count} @@`
    );
    for (const op of hunk) {
      if (op.type === "context") output.push(` ${op.line}`);
      if (op.type === "remove") output.push(`-${op.line}`);
      if (op.type === "add") output.push(`+${op.line}`);
    }
  }

  return output.join("\n");
}

function applyComposeFixes(content, issueIds) {
  const parsed = parseDockerCompose(content);
  if (!parsed.ok) return content;
  const data = parsed.data;
  const services = data.services || {};

  for (const service of Object.values(services)) {
    if (issueIds.has("DC001") && typeof service.image === "string") {
      service.image = service.image.replace(/:latest$/, ":1.0.0");
    }
    if (issueIds.has("DC002") && !service.restart) {
      service.restart = "always";
    }
    if (issueIds.has("DC005") && !service.healthcheck) {
      service.healthcheck = { test: ["CMD", "true"], interval: "30s", timeout: "5s", retries: 3 };
    }
    if (issueIds.has("DC006") && service.read_only !== true) {
      service.read_only = true;
    }
    if (issueIds.has("DC007") && !service.mem_limit && !service.deploy?.resources?.limits?.memory) {
      service.mem_limit = "512m";
    }
    if (issueIds.has("DC008")) {
      service.logging = service.logging || { driver: "json-file" };
      service.logging.options = service.logging.options || {};
      service.logging.options["max-size"] = service.logging.options["max-size"] || "10m";
      service.logging.options["max-file"] = service.logging.options["max-file"] || "3";
    }
  }

  return yaml.dump(data, { noRefs: true, lineWidth: 120 });
}

function applyDockerfileFixes(content, issueIds) {
  let updated = content;

  if (issueIds.has("DF001")) {
    updated = updated.replace(
      /^FROM\s+([^\s:]+):latest$/m,
      "FROM $1:1.0.0"
    );
  }
  if (issueIds.has("DF005") && !/^\s*WORKDIR\s+/m.test(updated)) {
    updated = `${updated.trimEnd()}\nWORKDIR /app\n`;
  }
  if (issueIds.has("DF002") && !/^\s*USER\s+/m.test(updated)) {
    updated = `${updated.trimEnd()}\nUSER appuser\n`;
  }
  if (issueIds.has("DF004") && !/^\s*HEALTHCHECK\s+/m.test(updated)) {
    updated = `${updated.trimEnd()}\nHEALTHCHECK --interval=30s --timeout=5s CMD true\n`;
  }

  return updated;
}

function appendDirectiveIfMissing(content, directiveLine, detectionFragment) {
  if (content.toLowerCase().includes(detectionFragment.toLowerCase())) return content;
  return `${content.trimEnd()}\n  ${directiveLine}\n`;
}

function applyNginxFixes(content, issueIds) {
  const parsed = parseNginx(content);
  if (!parsed.ok) return content;
  let updated = content;

  if (issueIds.has("NG001")) {
    updated = appendDirectiveIfMissing(updated, "server_tokens off;", "server_tokens off");
  }
  if (issueIds.has("NG002")) {
    updated = appendDirectiveIfMissing(updated, 'add_header X-Frame-Options "DENY" always;', "add_header x-frame-options");
  }
  if (issueIds.has("NG003")) {
    updated = appendDirectiveIfMissing(updated, "ssl_protocols TLSv1.2 TLSv1.3;", "ssl_protocols");
  }
  if (issueIds.has("NG004") && !updated.toLowerCase().includes("return 301 https://")) {
    updated = `${updated.trimEnd()}\n  return 301 https://$host$request_uri;\n`;
  }
  if (issueIds.has("NG005")) {
    updated = appendDirectiveIfMissing(
      updated,
      'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
      "add_header strict-transport-security"
    );
  }
  if (issueIds.has("NG006")) {
    updated = appendDirectiveIfMissing(updated, 'add_header X-Content-Type-Options "nosniff" always;', "add_header x-content-type-options");
  }
  if (issueIds.has("NG007")) {
    updated = appendDirectiveIfMissing(updated, "proxy_read_timeout 60s;", "proxy_read_timeout");
  }

  return `${updated.trimEnd()}\n`;
}

export function buildFileFixes(files, issues, options = {}) {
  const selectedIssueIds = Array.isArray(options.selected_issue_ids)
    ? new Set(options.selected_issue_ids)
    : null;
  const safeOnly = Boolean(options.safe_only);
  const fixConfidenceByIssue = options.fix_confidence_by_issue || {};

  const byFile = new Map();
  for (const issue of issues) {
    if (!issue.file) continue;
    if (!byFile.has(issue.file)) byFile.set(issue.file, []);
    byFile.get(issue.file).push(issue);
  }

  const fileFixes = [];
  for (const file of files) {
    const rawFileIssues = byFile.get(file.name) || [];
    const fileIssues = rawFileIssues.filter((issue) => {
      if (selectedIssueIds && !selectedIssueIds.has(issue.id)) return false;
      const confidence = fixConfidenceByIssue[issue.id] || "review_required";
      if (safeOnly && confidence !== "safe") return false;
      return true;
    });

    if (!fileIssues.length) continue;
    const ids = new Set(fileIssues.map((x) => x.id));
    let patched = file.content;

    if (file.type === "docker-compose") {
      patched = applyComposeFixes(file.content, ids);
    } else if (file.type === "dockerfile") {
      patched = applyDockerfileFixes(file.content, ids);
    } else if (file.type === "nginx") {
      patched = applyNginxFixes(file.content, ids);
    }

    if (patched !== file.content) {
      fileFixes.push({
        file: file.name,
        issue_ids: [...ids],
        confidence: [...ids].reduce((acc, issueId) => {
          acc[issueId] = fixConfidenceByIssue[issueId] || "review_required";
          return acc;
        }, {}),
        patch: buildUnifiedPatch(file.content, patched, file.name),
        patched_content: patched
      });
    }
  }

  return fileFixes;
}

