function severityCounts(issues) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    if (counts[issue.severity] !== undefined) {
      counts[issue.severity] += 1;
    }
  }
  return counts;
}

function fileHotspots(files, issues) {
  const map = new Map(files.map((file) => [file.name, { file: file.name, total: 0, critical: 0, high: 0, medium: 0, low: 0 }]));
  for (const issue of issues) {
    const key = issue.file || "unknown";
    if (!map.has(key)) {
      map.set(key, { file: key, total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    }
    const entry = map.get(key);
    entry.total += 1;
    if (entry[issue.severity] !== undefined) {
      entry[issue.severity] += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function highestSeverity(issues) {
  if (issues.some((x) => x.severity === "critical")) return "critical";
  if (issues.some((x) => x.severity === "high")) return "high";
  if (issues.some((x) => x.severity === "medium")) return "medium";
  if (issues.some((x) => x.severity === "low")) return "low";
  return "none";
}

function buildRemediationWorkflow({ counts, parseErrors, fileFixes }) {
  const steps = [];

  if (counts.critical > 0) {
    steps.push("Block deployment and fix all critical security findings first.");
  }
  if (parseErrors.length > 0) {
    steps.push("Resolve parser errors so all config files can be analyzed reliably.");
  }
  if (counts.high > 0) {
    steps.push("Address high severity issues and re-run review before merging.");
  }
  if (fileFixes.length > 0) {
    steps.push("Apply generated patches, validate services locally, and commit reviewed changes.");
  }
  steps.push("Run this review in CI for every pull request.");
  steps.push("Track score improvements over time to measure readiness progress.");

  return steps;
}

export function buildWorkflowReport({
  files,
  issues,
  parseErrors,
  fileFixes,
  aiConfigured,
  aiError
}) {
  const counts = severityCounts(issues);
  const ruleIssues = issues.filter((x) => x.source !== "ai");
  const maxSeverity = highestSeverity(issues);

  const stages = [
    {
      id: "intake",
      title: "Config Intake",
      status: files.length ? "healthy" : "critical",
      detail: `${files.length} file(s) uploaded`
    },
    {
      id: "parsing",
      title: "Parsing",
      status: parseErrors.length ? "warning" : "healthy",
      detail: parseErrors.length ? `${parseErrors.length} parse error(s)` : "All files parsed"
    },
    {
      id: "rules",
      title: "Rule Engine",
      status: ruleIssues.length ? "warning" : "healthy",
      detail: `${ruleIssues.length} deterministic issue(s) found`
    },
    {
      id: "ai",
      title: "AI Analysis",
      status: aiError ? "warning" : aiConfigured ? "healthy" : "info",
      detail: aiError ? "AI call failed, fallback used" : aiConfigured ? "AI insights added" : "AI key not configured"
    },
    {
      id: "patch",
      title: "Fix & Patch",
      status: fileFixes.length ? "warning" : "healthy",
      detail: `${fileFixes.length} file patch(es) generated`
    },
    {
      id: "gate",
      title: "Release Gate",
      status: maxSeverity === "critical" ? "critical" : maxSeverity === "high" ? "warning" : "healthy",
      detail:
        maxSeverity === "critical"
          ? "Do not release"
          : maxSeverity === "high"
            ? "Release blocked until high issues are fixed"
            : "Ready for controlled release"
    }
  ];

  const edges = [
    { from: "intake", to: "parsing" },
    { from: "parsing", to: "rules" },
    { from: "rules", to: "ai" },
    { from: "ai", to: "patch" },
    { from: "patch", to: "gate" }
  ];

  return {
    overview: {
      total_issues: issues.length,
      ...counts
    },
    stages,
    edges,
    hotspots: fileHotspots(files, issues),
    remediation_workflow: buildRemediationWorkflow({ counts, parseErrors, fileFixes })
  };
}

