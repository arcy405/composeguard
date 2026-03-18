export function parseDockerfile(content) {
  const lines = content.split(/\r?\n/);
  const instructions = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Z]+)\s+(.*)$/i);
    if (!match) return;
    instructions.push({
      line: index + 1,
      instruction: match[1].toUpperCase(),
      value: match[2]
    });
  });

  return { ok: true, data: { instructions } };
}

