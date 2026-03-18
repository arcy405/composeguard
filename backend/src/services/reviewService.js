import { parseDockerCompose } from "../../../core/parsers/dockerCompose.js";
import { parseDockerfile } from "../../../core/parsers/dockerfile.js";
import { parseNginx } from "../../../core/parsers/nginx.js";
import {
  runDockerComposeRules,
  runDockerfileRules
} from "../../../core/rules/docker.js";
import { runNginxRules } from "../../../core/rules/nginx.js";
import { analyzeWithOpenAI } from "../../../core/ai/openai.js";
import { computeScores } from "../../../core/scoring/scoring.js";
import { buildFileFixes } from "../../../core/fixes/patchGenerator.js";
import { buildWorkflowReport } from "../../../core/workflow/workflowBuilder.js";
import {
  enabledRuleIds,
  filterRuleIssuesByProfile,
  normalizeProfile
} from "../../../core/rules/profiles.js";

function detectFileType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("docker-compose") || lower.endsWith(".yml") || lower.endsWith(".yaml")) {
    return "docker-compose";
  }
  if (lower === "dockerfile" || lower.endsWith(".dockerfile")) {
    return "dockerfile";
  }
  if (lower.includes("nginx") || lower.endsWith(".conf")) {
    return "nginx";
  }
  return "unknown";
}

function generateFixesFromRuleIssues(issues) {
  const fixes = [];

  for (const issue of issues) {
    if (issue.id === "DC001") {
      fixes.push({
        issue_id: issue.id,
        before: "image: myapp:latest",
        after: "image: myapp:1.0.0",
        confidence: "review_required"
      });
    }
    if (issue.id === "DC002") {
      fixes.push({
        issue_id: issue.id,
        before: "restart: <missing>",
        after: "restart: always",
        confidence: "safe"
      });
    }
    if (issue.id === "DC005") {
      fixes.push({
        issue_id: issue.id,
        before: "healthcheck: <missing>",
        after: "healthcheck: { test: [CMD, true], interval: 30s, timeout: 5s, retries: 3 }",
        confidence: "review_required"
      });
    }
    if (issue.id === "DF002") {
      fixes.push({
        issue_id: issue.id,
        before: "# USER <missing>",
        after: "USER appuser",
        confidence: "review_required"
      });
    }
    if (issue.id === "DF001") {
      fixes.push({
        issue_id: issue.id,
        before: "FROM node:latest",
        after: "FROM node:1.0.0",
        confidence: "review_required"
      });
    }
    if (issue.id === "NG001") {
      fixes.push({
        issue_id: issue.id,
        before: "# server_tokens directive missing",
        after: "server_tokens off;",
        confidence: "safe"
      });
    }
    if (issue.id === "DC006") {
      fixes.push({
        issue_id: issue.id,
        before: "read_only: <missing>",
        after: "read_only: true",
        confidence: "safe"
      });
    }
    if (issue.id === "DC007") {
      fixes.push({
        issue_id: issue.id,
        before: "mem_limit: <missing>",
        after: "mem_limit: 512m",
        confidence: "review_required"
      });
    }
    if (issue.id === "DC008") {
      fixes.push({
        issue_id: issue.id,
        before: "logging.options.max-size/max-file: <missing>",
        after: 'logging.options: { "max-size": "10m", "max-file": "3" }',
        confidence: "safe"
      });
    }
    if (issue.id === "DF004") {
      fixes.push({
        issue_id: issue.id,
        before: "HEALTHCHECK <missing>",
        after: "HEALTHCHECK --interval=30s --timeout=5s CMD true",
        confidence: "review_required"
      });
    }
    if (issue.id === "DF005") {
      fixes.push({
        issue_id: issue.id,
        before: "WORKDIR <missing>",
        after: "WORKDIR /app",
        confidence: "safe"
      });
    }
    if (issue.id === "NG005") {
      fixes.push({
        issue_id: issue.id,
        before: "add_header Strict-Transport-Security <missing>",
        after: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
        confidence: "review_required"
      });
    }
    if (issue.id === "NG002") {
      fixes.push({
        issue_id: issue.id,
        before: "add_header X-Frame-Options <missing>",
        after: 'add_header X-Frame-Options "DENY" always;',
        confidence: "safe"
      });
    }
    if (issue.id === "NG003") {
      fixes.push({
        issue_id: issue.id,
        before: "ssl_protocols <missing>",
        after: "ssl_protocols TLSv1.2 TLSv1.3;",
        confidence: "review_required"
      });
    }
    if (issue.id === "NG004") {
      fixes.push({
        issue_id: issue.id,
        before: "return 301 https://... <missing>",
        after: "return 301 https://$host$request_uri;",
        confidence: "review_required"
      });
    }
    if (issue.id === "NG006") {
      fixes.push({
        issue_id: issue.id,
        before: "add_header X-Content-Type-Options <missing>",
        after: 'add_header X-Content-Type-Options "nosniff" always;',
        confidence: "safe"
      });
    }
    if (issue.id === "NG007") {
      fixes.push({
        issue_id: issue.id,
        before: "proxy_read_timeout <missing>",
        after: "proxy_read_timeout 60s;",
        confidence: "review_required"
      });
    }
  }

  return fixes;
}

function buildFixConfidenceMap(fixes) {
  const map = {};
  for (const fix of fixes) {
    map[fix.issue_id] = fix.confidence || "review_required";
  }
  return map;
}

export async function reviewFiles(inputFiles, options = {}) {
  const profile = normalizeProfile(options.profile);
  const selectedIssueIds = Array.isArray(options.selected_issue_ids)
    ? options.selected_issue_ids
    : null;
  const safeOnly = options.safe_only === undefined ? false : Boolean(options.safe_only);

  const normalizedFiles = inputFiles.map((file) => ({
    name: file.name,
    content: file.content,
    type: detectFileType(file.name)
  }));

  let issues = [];
  const parseErrors = [];

  for (const file of normalizedFiles) {
    if (file.type === "docker-compose") {
      const parsed = parseDockerCompose(file.content);
      if (!parsed.ok) {
        parseErrors.push({ file: file.name, error: parsed.error });
        continue;
      }
      const fileIssues = runDockerComposeRules(parsed.data).map((issue) => ({
        ...issue,
        file: file.name
      }));
      issues = issues.concat(fileIssues);
    } else if (file.type === "dockerfile") {
      const parsed = parseDockerfile(file.content);
      const fileIssues = runDockerfileRules(parsed.data).map((issue) => ({
        ...issue,
        file: file.name
      }));
      issues = issues.concat(fileIssues);
    } else if (file.type === "nginx") {
      const parsed = parseNginx(file.content);
      const fileIssues = runNginxRules(parsed.data).map((issue) => ({
        ...issue,
        file: file.name
      }));
      issues = issues.concat(fileIssues);
    }
  }

  let ai = { issues: [], suggestions: [], fixes: [] };
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  let aiError = null;
  try {
    ai = await analyzeWithOpenAI(normalizedFiles);
  } catch (error) {
    aiError = error.message;
    ai.suggestions = [`AI analysis unavailable: ${error.message}`];
  }

  const aiIssues = ai.issues.map((issue) => ({
    ...issue,
    file: issue.file || null
  }));
  const profiled = filterRuleIssuesByProfile([...issues, ...aiIssues], profile);
  const combinedIssues = profiled.issues;
  const ruleFixes = generateFixesFromRuleIssues(issues);
  const combinedFixes = [...ruleFixes, ...ai.fixes];
  const fixConfidenceByIssue = buildFixConfidenceMap(combinedFixes);
  const fileFixes = buildFileFixes(normalizedFiles, combinedIssues, {
    selected_issue_ids: selectedIssueIds,
    safe_only: safeOnly,
    fix_confidence_by_issue: fixConfidenceByIssue
  });
  const scores = computeScores(combinedIssues);
  const workflow = buildWorkflowReport({
    files: normalizedFiles,
    issues: combinedIssues,
    parseErrors,
    fileFixes,
    aiConfigured,
    aiError
  });

  return {
    files: normalizedFiles.map((x) => x.name),
    profile: profiled.profile,
    enabled_rule_ids: enabledRuleIds(profiled.profile),
    issues: combinedIssues,
    suggestions: ai.suggestions,
    fixes: combinedFixes,
    file_fixes: fileFixes,
    parse_errors: parseErrors,
    scores,
    workflow
  };
}

