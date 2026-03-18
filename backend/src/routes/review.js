import express from "express";
import multer from "multer";
import { reviewFiles } from "../services/reviewService.js";
import { toSarif } from "../../../core/export/sarif.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

function extractInputFiles(req) {
  if (Array.isArray(req.files) && req.files.length > 0) {
    return req.files.map((file) => ({
      name: file.originalname,
      content: file.buffer.toString("utf8")
    }));
  }

  if (req.body?.files && Array.isArray(req.body.files)) {
    return req.body.files.filter((x) => x?.name && typeof x.content === "string");
  }
  return [];
}

function parseBooleanLike(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseIssueIds(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_error) {
      return value
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  return null;
}

function extractOptions(req) {
  const body = req.body || {};
  return {
    profile: body.profile || "production",
    selected_issue_ids: parseIssueIds(body.issue_ids),
    safe_only: parseBooleanLike(body.safe_only, true)
  };
}

function calcDelta(before, after) {
  const keys = ["security", "performance", "production_readiness", "overall"];
  return keys.reduce((acc, key) => {
    const beforeValue = Number(before?.[key] || 0);
    const afterValue = Number(after?.[key] || 0);
    acc[key] = Math.round((afterValue - beforeValue) * 10) / 10;
    return acc;
  }, {});
}

router.post("/review", upload.array("files"), async (req, res) => {
  try {
    const files = extractInputFiles(req);
    const options = extractOptions(req);

    if (!files.length) {
      return res.status(400).json({
        error:
          "No input files found. Upload files as multipart/form-data (field name: files) or send JSON body with files[]."
      });
    }

    const report = await reviewFiles(files, {
      profile: options.profile,
      safe_only: false
    });
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/apply-fixes", upload.array("files"), async (req, res) => {
  try {
    const files = extractInputFiles(req);
    const options = extractOptions(req);
    if (!files.length) {
      return res.status(400).json({
        error:
          "No input files found. Upload files as multipart/form-data (field name: files) or send JSON body with files[]."
      });
    }

    const report = await reviewFiles(files, {
      profile: options.profile,
      selected_issue_ids: options.selected_issue_ids,
      safe_only: options.safe_only
    });
    const fixedFiles = report.file_fixes.map((entry) => ({
      file: entry.file,
      patched_content: entry.patched_content,
      issue_ids: entry.issue_ids,
      confidence: entry.confidence
    }));
    const beforeScores = report.scores;

    const patchedContentByFile = new Map(
      report.file_fixes.map((entry) => [entry.file, entry.patched_content])
    );
    const patchedFiles = files.map((file) => ({
      name: file.name,
      content: patchedContentByFile.get(file.name) || file.content
    }));
    const afterReport = await reviewFiles(patchedFiles, {
      profile: options.profile,
      safe_only: false
    });

    const requestedIds = options.selected_issue_ids || [];
    const availableIssueIds = new Set(report.issues.map((issue) => issue.id));
    const appliedIssueIds = new Set(report.file_fixes.flatMap((entry) => entry.issue_ids));
    const fixConfidenceByIssue = report.fixes.reduce((acc, fix) => {
      acc[fix.issue_id] = fix.confidence || "review_required";
      return acc;
    }, {});
    const skippedIssues = requestedIds
      .filter((issueId) => !appliedIssueIds.has(issueId))
      .map((issueId) => {
        if (!availableIssueIds.has(issueId)) {
          return { issue_id: issueId, reason: "Issue not found in current report." };
        }
        if (options.safe_only && fixConfidenceByIssue[issueId] !== "safe") {
          return {
            issue_id: issueId,
            reason: "Skipped because safe_only is enabled and fix is review_required."
          };
        }
        return { issue_id: issueId, reason: "No autofix available for this issue." };
      });

    return res.json({
      files: report.files,
      profile: report.profile,
      fixed_files: fixedFiles,
      issues_count: report.issues.length,
      applied_count: fixedFiles.length,
      skipped_issues: skippedIssues,
      workflow: report.workflow,
      score_delta: {
        before: beforeScores,
        after: afterReport.scores,
        delta: calcDelta(beforeScores, afterReport.scores)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/export/sarif", upload.array("files"), async (req, res) => {
  try {
    const files = extractInputFiles(req);
    const options = extractOptions(req);
    if (!files.length) {
      return res.status(400).json({
        error:
          "No input files found. Upload files as multipart/form-data (field name: files) or send JSON body with files[]."
      });
    }
    const report = await reviewFiles(files, {
      profile: options.profile,
      safe_only: false
    });
    return res.json({
      profile: report.profile,
      files: report.files,
      issue_count: report.issues.length,
      sarif: toSarif(report)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

