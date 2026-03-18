export function parseNginx(content) {
  const lines = content.split(/\r?\n/);
  const directives = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    if (trimmed.endsWith("{") || trimmed === "}" || trimmed === "};") return;
    directives.push({
      line: index + 1,
      raw: trimmed
    });
  });

  return { ok: true, data: { directives, raw: content } };
}

