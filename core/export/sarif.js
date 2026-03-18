function mapSeverityToLevel(severity) {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "note";
}

function parseLocation(issue) {
  if (issue.file) {
    return { uri: issue.file, startLine: null };
  }
  const location = String(issue.location || "");
  const match = location.match(/^(.+):(\d+)$/);
  if (match) {
    return { uri: match[1], startLine: Number(match[2]) };
  }
  return { uri: location || "unknown", startLine: null };
}

function buildRules(issues) {
  const byId = new Map();
  for (const issue of issues) {
    if (byId.has(issue.id)) continue;
    byId.set(issue.id, {
      id: issue.id,
      name: issue.id,
      shortDescription: { text: issue.message || issue.id },
      fullDescription: { text: issue.expert_explanation || issue.simple_explanation || issue.message || issue.id },
      help: {
        text: `${issue.simple_explanation || ""}\n\n${issue.expert_explanation || ""}`.trim()
      },
      properties: {
        category: issue.category || "best_practice"
      }
    });
  }
  return [...byId.values()];
}

export function toSarif(report) {
  const issues = report.issues || [];
  const results = issues.map((issue) => {
    const loc = parseLocation(issue);
    const physicalLocation = {
      artifactLocation: { uri: loc.uri }
    };
    if (loc.startLine) {
      physicalLocation.region = { startLine: loc.startLine };
    }

    return {
      ruleId: issue.id || "UNKNOWN",
      level: mapSeverityToLevel(issue.severity),
      message: {
        text: issue.message || issue.id || "Issue detected"
      },
      properties: {
        severity: issue.severity || "low",
        category: issue.category || "best_practice",
        source: issue.source || "rule"
      },
      locations: [{ physicalLocation }]
    };
  });

  return {
    version: "2.1.0",
    $schema:
      "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "ComposeGuard",
            informationUri: "https://github.com",
            rules: buildRules(issues)
          }
        },
        invocations: [
          {
            executionSuccessful: true
          }
        ],
        results
      }
    ]
  };
}

