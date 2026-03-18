import Ajv from "ajv";
import { aiResponseSchema } from "./schema.js";

const ajv = new Ajv();
const validate = ajv.compile(aiResponseSchema);

function buildPrompt(files) {
  const fileDump = files
    .map(
      (file) =>
        `FILE: ${file.name}\nTYPE: ${file.type}\nCONTENT:\n${file.content}\n---`
    )
    .join("\n");

  return [
    "You are a DevOps config reviewer.",
    "Analyze the files for security, performance, reliability, and production-readiness issues.",
    "Return strict JSON with exactly this shape:",
    JSON.stringify(
      {
        issues: [
          {
            id: "AI001",
            severity: "low|medium|high|critical",
            category: "security|performance|reliability|best_practice|maintainability",
            message: "text",
            simple_explanation: "text",
            expert_explanation: "text",
            location: "path or key",
            source: "ai"
          }
        ],
        suggestions: ["text"],
        fixes: [{ issue_id: "AI001", before: "text", after: "text" }]
      },
      null,
      2
    ),
    "Do not include markdown fences or any non-JSON text.",
    "",
    fileDump
  ].join("\n");
}

export async function analyzeWithOpenAI(files) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      issues: [],
      suggestions: [
        "OPENAI_API_KEY not set. Only deterministic rule results are shown."
      ],
      fixes: []
    };
  }

  const prompt = buildPrompt(files);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Return strict JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content || "{}";
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`AI returned invalid JSON: ${error.message}`);
  }

  if (!validate(parsed)) {
    throw new Error(`AI JSON schema validation failed: ${ajv.errorsText(validate.errors)}`);
  }

  parsed.issues = parsed.issues.map((issue) => ({ ...issue, source: "ai" }));
  return parsed;
}

