import { buildIssue } from "./shared.js";

function hasDirective(raw, fragment) {
  return raw.toLowerCase().includes(fragment.toLowerCase());
}

export function runNginxRules(parsedNginx) {
  const issues = [];
  const raw = parsedNginx?.raw || "";

  if (!hasDirective(raw, "server_tokens off")) {
    issues.push(
      buildIssue({
        id: "NG001",
        severity: "medium",
        category: "security",
        message: "Nginx does not disable server tokens.",
        simple: "Version disclosure can help attackers fingerprint your stack.",
        expert:
          "Suppressing version banners reduces reconnaissance value and should be combined with patch hygiene and WAF controls.",
        location: "nginx.conf"
      })
    );
  }

  if (!hasDirective(raw, "add_header x-frame-options")) {
    issues.push(
      buildIssue({
        id: "NG002",
        severity: "medium",
        category: "security",
        message: "Missing X-Frame-Options header.",
        simple: "Your app may be vulnerable to clickjacking.",
        expert:
          "Frame embedding restrictions mitigate UI redress attacks. Consider CSP frame-ancestors for modern policy control.",
        location: "nginx.conf"
      })
    );
  }

  if (!hasDirective(raw, "ssl_protocols")) {
    issues.push(
      buildIssue({
        id: "NG003",
        severity: "high",
        category: "security",
        message: "No explicit TLS protocol policy found.",
        simple: "TLS settings are not explicitly hardened.",
        expert:
          "Declare secure protocol baselines and ciphers explicitly to avoid weak defaults and inconsistent runtime posture.",
        location: "nginx.conf"
      })
    );
  }

  if (hasDirective(raw, "listen 80;") && !hasDirective(raw, "return 301 https://")) {
    issues.push(
      buildIssue({
        id: "NG004",
        severity: "low",
        category: "best_practice",
        message: "HTTP listener found without explicit HTTPS redirect.",
        simple: "Users might connect without encryption.",
        expert:
          "Force HTTPS to prevent downgrade or accidental plaintext transport. Keep strict redirect and HSTS in place.",
        location: "nginx.conf"
      })
    );
  }

  if (!hasDirective(raw, "add_header strict-transport-security")) {
    issues.push(
      buildIssue({
        id: "NG005",
        severity: "medium",
        category: "security",
        message: "Missing HSTS header configuration.",
        simple: "Browsers may allow future plaintext connections.",
        expert:
          "HSTS enforces HTTPS for subsequent requests and mitigates downgrade opportunities in user agents.",
        location: "nginx.conf"
      })
    );
  }

  if (!hasDirective(raw, "add_header x-content-type-options")) {
    issues.push(
      buildIssue({
        id: "NG006",
        severity: "low",
        category: "security",
        message: "Missing X-Content-Type-Options header.",
        simple: "Browsers may MIME-sniff responses unexpectedly.",
        expert:
          "nosniff prevents client-side type confusion and reduces exploitability of incorrectly typed responses.",
        location: "nginx.conf"
      })
    );
  }

  if (!hasDirective(raw, "proxy_read_timeout")) {
    issues.push(
      buildIssue({
        id: "NG007",
        severity: "low",
        category: "reliability",
        message: "proxy_read_timeout is not explicitly set.",
        simple: "Long-running upstream responses may time out unexpectedly.",
        expert:
          "Explicit timeout policy aligns reverse proxy behavior with upstream SLAs and avoids brittle default timeout behavior.",
        location: "nginx.conf"
      })
    );
  }

  return issues;
}

