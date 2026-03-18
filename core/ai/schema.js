export const aiResponseSchema = {
  type: "object",
  required: ["issues", "suggestions", "fixes"],
  additionalProperties: false,
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "severity",
          "category",
          "message",
          "simple_explanation",
          "expert_explanation",
          "location"
        ],
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          severity: { type: "string" },
          category: { type: "string" },
          message: { type: "string" },
          simple_explanation: { type: "string" },
          expert_explanation: { type: "string" },
          location: { type: "string" }
        }
      }
    },
    suggestions: {
      type: "array",
      items: { type: "string" }
    },
    fixes: {
      type: "array",
      items: {
        type: "object",
        required: ["issue_id", "before", "after"],
        additionalProperties: true,
        properties: {
          issue_id: { type: "string" },
          before: { type: "string" },
          after: { type: "string" }
        }
      }
    }
  }
};

