const severityPenalty = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

function clampScore(value) {
  return Math.max(0, Math.min(10, value));
}

export function computeScores(issues) {
  let security = 10;
  let performance = 10;
  let productionReadiness = 10;

  for (const issue of issues) {
    const penalty = severityPenalty[issue.severity] || 1;
    if (issue.category === "security") security -= penalty;
    if (issue.category === "performance") performance -= penalty;
    if (issue.category === "reliability" || issue.category === "best_practice") {
      productionReadiness -= penalty;
    }
  }

  security = clampScore(security);
  performance = clampScore(performance);
  productionReadiness = clampScore(productionReadiness);

  const overall = clampScore(
    Math.round(((security + performance + productionReadiness) / 3) * 10) / 10
  );

  return {
    security,
    performance,
    production_readiness: productionReadiness,
    overall
  };
}

