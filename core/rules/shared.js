export function buildIssue({
  id,
  severity,
  category,
  message,
  simple,
  expert,
  location,
  file = null
}) {
  return {
    id,
    severity,
    category,
    message,
    simple_explanation: simple,
    expert_explanation: expert,
    location,
    file,
    source: "rule"
  };
}

