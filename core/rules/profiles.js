const profileRuleIds = {
  startup: new Set([
    "DC001",
    "DC002",
    "DC003",
    "DC004",
    "DF001",
    "DF002",
    "DF004",
    "NG001",
    "NG002",
    "NG003",
    "NG004"
  ]),
  production: new Set([
    "DC001",
    "DC002",
    "DC003",
    "DC004",
    "DC005",
    "DC006",
    "DC007",
    "DC008",
    "DF001",
    "DF002",
    "DF003",
    "DF004",
    "DF005",
    "DF006",
    "NG001",
    "NG002",
    "NG003",
    "NG004",
    "NG005",
    "NG006",
    "NG007"
  ]),
  enterprise: null
};

export function normalizeProfile(value) {
  const profile = String(value || "production").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(profileRuleIds, profile)) return "production";
  return profile;
}

export function filterRuleIssuesByProfile(issues, profile) {
  const normalized = normalizeProfile(profile);
  const allowList = profileRuleIds[normalized];
  if (!allowList) return { issues, profile: normalized };

  return {
    profile: normalized,
    issues: issues.filter((issue) => issue.source !== "rule" || allowList.has(issue.id))
  };
}

export function enabledRuleIds(profile) {
  const normalized = normalizeProfile(profile);
  const allowList = profileRuleIds[normalized];
  if (!allowList) return "all";
  return [...allowList];
}

