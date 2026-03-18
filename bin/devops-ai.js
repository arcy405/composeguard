#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const scanPatterns = [
  /^docker-compose.*\.ya?ml$/i,
  /^dockerfile$/i,
  /\.dockerfile$/i,
  /^nginx.*\.conf$/i
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const files = [];
  const options = {
    api: "http://127.0.0.1:3000",
    failOn: null,
    outDir: ".composeguard-fixed",
    profile: "production",
    issueIds: null,
    safeOnly: true,
    format: "text",
    output: null
  };

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--api") {
      options.api = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--fail-on") {
      options.failOn = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out-dir") {
      options.outDir = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--profile") {
      options.profile = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--issue-ids") {
      options.issueIds = args[i + 1]
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === "--safe-only") {
      options.safeOnly = ["1", "true", "yes", "on"].includes(
        String(args[i + 1]).toLowerCase()
      );
      i += 1;
      continue;
    }
    if (arg === "--format") {
      options.format = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output") {
      options.output = args[i + 1];
      i += 1;
      continue;
    }
    files.push(arg);
  }

  return { command, files, options };
}

function severityRank(level) {
  const rank = { low: 1, medium: 2, high: 3, critical: 4 };
  return rank[level] || 0;
}

function printUsage() {
  console.log("Usage:");
  console.log(
    "  composeguard review <file1> <file2> ... [--api URL] [--fail-on low|medium|high|critical] [--profile startup|production|enterprise]"
  );
  console.log(
    "  composeguard apply <file1> <file2> ... [--api URL] [--out-dir DIR] [--profile startup|production|enterprise] [--issue-ids DC001,NG001] [--safe-only true|false]"
  );
  console.log(
    "  composeguard scan <target-dir> [--api URL] [--profile startup|production|enterprise] [--format text|json|sarif] [--output report-file] [--fail-on low|medium|high|critical]"
  );
  console.log("  (legacy alias: devops-ai)");
}

async function walkForConfigFiles(rootDir) {
  const discovered = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (
          [
            "node_modules",
            ".git",
            ".devops-ai-fixed",
            ".devops-ai-fixed-p0",
            ".composeguard-fixed"
          ].includes(
            entry.name
          )
        ) {
          continue;
        }
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (scanPatterns.some((pattern) => pattern.test(entry.name))) {
        discovered.push(absolute);
      }
    }
  }

  await walk(path.resolve(rootDir));
  return discovered;
}

function printTextReview(report) {
  console.log("== DevOps Review Report ==");
  console.log(`Files: ${report.files.join(", ")}`);
  console.log(`Profile: ${report.profile}`);
  console.log(
    `Scores: security=${report.scores.security}, performance=${report.scores.performance}, readiness=${report.scores.production_readiness}, overall=${report.scores.overall}`
  );
  console.log(`Issues: ${report.issues.length}`);
  for (const issue of report.issues) {
    console.log(
      `- [${issue.severity.toUpperCase()}] ${issue.id}: ${issue.message} (${
        issue.file || issue.location || "unknown"
      })`
    );
  }
}

function maybeFailOnThreshold(report, failOn) {
  if (!failOn) return;
  const threshold = severityRank(failOn);
  const violating = report.issues.some((issue) => severityRank(issue.severity) >= threshold);
  if (violating) {
    console.error(
      `Failing because at least one issue meets fail threshold: ${failOn}`
    );
    process.exit(2);
  }
}

async function requestApi(options, endpoint, payloadFiles) {
  const response = await fetch(`${options.api}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: payloadFiles,
      profile: options.profile,
      issue_ids: options.issueIds,
      safe_only: options.safeOnly
    })
  });
  const json = await response.json();
  if (!response.ok) {
    console.error(`Review failed: ${json.error || "unknown error"}`);
    process.exit(1);
  }
  return json;
}

async function run() {
  const { command, files, options } = parseArgs(process.argv);
  if (!["review", "apply", "scan"].includes(command) || files.length === 0) {
    printUsage();
    process.exit(1);
  }

  let targetFiles = files;
  if (command === "scan") {
    targetFiles = await walkForConfigFiles(files[0]);
    if (!targetFiles.length) {
      console.log("No supported DevOps config files found.");
      process.exit(0);
    }
    console.log(`Discovered ${targetFiles.length} config file(s).`);
  }

  const payloadFiles = await Promise.all(
    targetFiles.map(async (file) => ({
      name:
        command === "scan"
          ? path.relative(path.resolve(files[0]), path.resolve(file))
          : path.basename(file),
      content: await fs.readFile(file, "utf8")
    }))
  );

  if (command === "scan") {
    if (options.format === "sarif") {
      const sarifBundle = await requestApi(options, "/api/export/sarif", payloadFiles);
      const output = JSON.stringify(sarifBundle.sarif, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, output, "utf8");
        console.log(`Wrote ${options.output}`);
      } else {
        console.log(output);
      }
      return;
    }

    const report = await requestApi(options, "/api/review", payloadFiles);
    if (options.format === "json") {
      const output = JSON.stringify(report, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, output, "utf8");
        console.log(`Wrote ${options.output}`);
      } else {
        console.log(output);
      }
      maybeFailOnThreshold(report, options.failOn);
      return;
    }

    printTextReview(report);
    maybeFailOnThreshold(report, options.failOn);
    return;
  }

  const endpoint = command === "apply" ? "/api/apply-fixes" : "/api/review";
  const report = await requestApi(options, endpoint, payloadFiles);

  if (command === "review") {
    printTextReview(report);
    maybeFailOnThreshold(report, options.failOn);
    return;
  }

  await fs.mkdir(options.outDir, { recursive: true });
  for (const item of report.fixed_files || []) {
    const target = path.join(options.outDir, item.file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, item.patched_content || "", "utf8");
    console.log(`Wrote ${target}`);
  }
  if (report.score_delta?.delta) {
    const d = report.score_delta.delta;
    console.log(
      `Score delta: security=${d.security}, performance=${d.performance}, readiness=${d.production_readiness}, overall=${d.overall}`
    );
  }
  if (report.skipped_issues?.length) {
    console.log("Skipped issues:");
    for (const item of report.skipped_issues) {
      console.log(`- ${item.issue_id}: ${item.reason}`);
    }
  }
  console.log(`Applied fixes to ${report.applied_count || 0} file(s).`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

