import yaml from "js-yaml";

export function parseDockerCompose(content) {
  try {
    const parsed = yaml.load(content);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Compose file is empty or invalid." };
    }
    return { ok: true, data: parsed };
  } catch (error) {
    return { ok: false, error: `Compose parse error: ${error.message}` };
  }
}

