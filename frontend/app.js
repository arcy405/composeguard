const fileInput = document.getElementById("fileInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const applyBtn = document.getElementById("applyBtn");
const profileSelectEl = document.getElementById("profileSelect");
const issueIdsInputEl = document.getElementById("issueIdsInput");
const safeOnlyToggleEl = document.getElementById("safeOnlyToggle");
const statusEl = document.getElementById("status");
const scoresEl = document.getElementById("scores");
const workflowOverviewEl = document.getElementById("workflowOverview");
const workflowStagesEl = document.getElementById("workflowStages");
const workflowHotspotsEl = document.getElementById("workflowHotspots");
const workflowPlanEl = document.getElementById("workflowPlan");
const scoreDeltaEl = document.getElementById("scoreDelta");
const skippedIssuesEl = document.getElementById("skippedIssues");
const severityFilterEl = document.getElementById("severityFilter");
const issueSearchEl = document.getElementById("issueSearch");
const issuesEl = document.getElementById("issues");
const fixesEl = document.getElementById("fixes");
const fileFixesEl = document.getElementById("fileFixes");
const appliedFilesEl = document.getElementById("appliedFiles");
let latestIssues = [];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderScores(scores) {
  if (!scores) {
    scoresEl.innerHTML = "<p>No score data yet.</p>";
    return;
  }

  scoresEl.innerHTML = Object.entries(scores)
    .map(
      ([key, value]) =>
        `<div class="score"><strong>${key.replaceAll("_", " ")}</strong><br/>${value}/10</div>`
    )
    .join("");
}

function renderWorkflow(workflow) {
  if (!workflow) {
    workflowOverviewEl.innerHTML = "<p>No workflow data yet.</p>";
    workflowStagesEl.innerHTML = "";
    workflowHotspotsEl.innerHTML = "<p>No issue hotspots yet.</p>";
    workflowPlanEl.innerHTML = "";
    return;
  }

  const overview = workflow.overview || {};
  workflowOverviewEl.innerHTML = [
    ["total issues", overview.total_issues || 0],
    ["critical", overview.critical || 0],
    ["high", overview.high || 0],
    ["medium", overview.medium || 0],
    ["low", overview.low || 0]
  ]
    .map(([label, value]) => `<div class="score"><strong>${escapeHtml(label)}</strong><br/>${escapeHtml(value)}</div>`)
    .join("");

  workflowStagesEl.innerHTML = (workflow.stages || [])
    .map(
      (stage) => `
        <div class="stage ${escapeHtml(stage.status || "info")}">
          <strong>${escapeHtml(stage.title || "Stage")}</strong>
          <div class="muted">${escapeHtml(stage.detail || "")}</div>
        </div>
      `
    )
    .join("");

  workflowHotspotsEl.innerHTML = (workflow.hotspots || [])
    .map(
      (spot) => `
        <div class="hotspot">
          <strong>${escapeHtml(spot.file)}</strong>
          <div class="muted">
            total: ${escapeHtml(spot.total)} |
            critical: ${escapeHtml(spot.critical)} |
            high: ${escapeHtml(spot.high)} |
            medium: ${escapeHtml(spot.medium)} |
            low: ${escapeHtml(spot.low)}
          </div>
        </div>
      `
    )
    .join("");

  workflowPlanEl.innerHTML = (workflow.remediation_workflow || [])
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
}

function renderScoreDelta(scoreDelta) {
  if (!scoreDelta) {
    scoreDeltaEl.innerHTML = "";
    return;
  }
  const before = scoreDelta.before || {};
  const after = scoreDelta.after || {};
  const delta = scoreDelta.delta || {};
  scoreDeltaEl.innerHTML = `
    <div class="score-delta-grid">
      <div class="score"><strong>Security</strong><br/>${escapeHtml(before.security)} -> ${escapeHtml(after.security)} (${escapeHtml(delta.security)})</div>
      <div class="score"><strong>Performance</strong><br/>${escapeHtml(before.performance)} -> ${escapeHtml(after.performance)} (${escapeHtml(delta.performance)})</div>
      <div class="score"><strong>Readiness</strong><br/>${escapeHtml(before.production_readiness)} -> ${escapeHtml(after.production_readiness)} (${escapeHtml(delta.production_readiness)})</div>
      <div class="score"><strong>Overall</strong><br/>${escapeHtml(before.overall)} -> ${escapeHtml(after.overall)} (${escapeHtml(delta.overall)})</div>
    </div>
  `;
}

function renderSkippedIssues(skippedIssues) {
  if (!skippedIssues?.length) {
    skippedIssuesEl.innerHTML = "";
    return;
  }
  skippedIssuesEl.innerHTML = skippedIssues
    .map(
      (item) => `
        <div class="fix">
          <strong>Skipped: ${escapeHtml(item.issue_id)}</strong>
          <div class="muted">${escapeHtml(item.reason)}</div>
        </div>
      `
    )
    .join("");
}

function renderIssues(issues) {
  latestIssues = issues || [];
  const severity = severityFilterEl?.value || "all";
  const query = (issueSearchEl?.value || "").trim().toLowerCase();
  const filtered = latestIssues.filter((issue) => {
    const severityMatch = severity === "all" ? true : issue.severity === severity;
    const text = `${issue.message || ""} ${issue.simple_explanation || ""} ${issue.expert_explanation || ""} ${issue.file || ""}`.toLowerCase();
    const queryMatch = query ? text.includes(query) : true;
    return severityMatch && queryMatch;
  });

  if (!filtered.length) {
    issuesEl.innerHTML = "<p>No issues detected.</p>";
    return;
  }

  issuesEl.innerHTML = filtered
    .map(
      (issue) => `
        <article class="issue ${issue.severity}">
          <strong>[${escapeHtml(issue.severity.toUpperCase())}] ${escapeHtml(issue.message)}</strong><br/>
          <small>${escapeHtml(issue.category)} · ${escapeHtml(issue.file || "unknown file")} · ${escapeHtml(issue.location || "n/a")} · ${escapeHtml(issue.source || "rule")}</small>
          <p>${escapeHtml(issue.simple_explanation || "")}</p>
          <details>
            <summary>Expert explanation</summary>
            <p>${escapeHtml(issue.expert_explanation || "No expert explanation.")}</p>
          </details>
        </article>
      `
    )
    .join("");
}

function renderFixes(fixes) {
  if (!fixes?.length) {
    fixesEl.innerHTML = "<p>No suggested fixes yet.</p>";
    return;
  }

  fixesEl.innerHTML = fixes
    .map(
      (fix) => `
        <div class="fix">
          <strong>Issue: ${escapeHtml(fix.issue_id || "n/a")}</strong>
          <div class="muted">Autofix confidence: ${escapeHtml(fix.confidence || "review_required")}</div>
          <div>Before</div>
          <pre>${escapeHtml(fix.before || "")}</pre>
          <div>After</div>
          <pre>${escapeHtml(fix.after || "")}</pre>
        </div>
      `
    )
    .join("");
}

function renderFileFixes(fileFixes) {
  if (!fileFixes?.length) {
    fileFixesEl.innerHTML = "<p>No file-level patches generated.</p>";
    return;
  }

  fileFixesEl.innerHTML = fileFixes
    .map(
      (entry) => `
        <div class="fix">
          <strong>${escapeHtml(entry.file)}</strong>
          <div class="muted">Issues: ${(entry.issue_ids || []).map(escapeHtml).join(", ")}</div>
          <div class="muted">Confidence: ${Object.entries(entry.confidence || {})
            .map(([key, value]) => `${escapeHtml(key)}=${escapeHtml(value)}`)
            .join(" | ")}</div>
          <div>Patch preview</div>
          <pre class="patch">${escapeHtml(entry.patch || "")}</pre>
          <details>
            <summary>Patched file content</summary>
            <pre>${escapeHtml(entry.patched_content || "")}</pre>
          </details>
        </div>
      `
    )
    .join("");
}

function renderAppliedFiles(files) {
  if (!files?.length) {
    appliedFilesEl.innerHTML = "<p>No applied file output yet.</p>";
    return;
  }

  appliedFilesEl.innerHTML = files
    .map(
      (entry, index) => `
        <div class="fix">
          <strong>${escapeHtml(entry.file)}</strong>
          <div class="muted">Applied issues: ${(entry.issue_ids || []).map(escapeHtml).join(", ")}</div>
          <div class="muted">Confidence: ${Object.entries(entry.confidence || {})
            .map(([key, value]) => `${escapeHtml(key)}=${escapeHtml(value)}`)
            .join(" | ")}</div>
          <button data-download-idx="${index}" class="secondary">Download patched file</button>
          <details>
            <summary>Preview</summary>
            <pre>${escapeHtml(entry.patched_content || "")}</pre>
          </details>
        </div>
      `
    )
    .join("");

  const buttons = appliedFilesEl.querySelectorAll("button[data-download-idx]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const idx = Number(button.getAttribute("data-download-idx"));
      const item = files[idx];
      if (!item) return;

      const blob = new Blob([item.patched_content || ""], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.file;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
  });
}

function buildBaseFormData(files) {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));
  formData.append("profile", profileSelectEl?.value || "production");
  return formData;
}

analyzeBtn.addEventListener("click", async () => {
  const files = fileInput.files;
  if (!files.length) {
    statusEl.textContent = "Please select at least one file.";
    return;
  }

  analyzeBtn.disabled = true;
  applyBtn.disabled = true;
  statusEl.textContent = "Analyzing...";

  try {
    const formData = buildBaseFormData(files);

    const response = await fetch("/api/review", {
      method: "POST",
      body: formData
    });

    const report = await response.json();
    if (!response.ok) {
      throw new Error(report.error || "Request failed");
    }

    renderScores(report.scores);
    renderWorkflow(report.workflow);
    renderIssues(report.issues);
    renderFixes(report.fixes);
    renderFileFixes(report.file_fixes);
    statusEl.textContent = `Done. Reviewed ${report.files.length} file(s) using ${report.profile} profile.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
  } finally {
    analyzeBtn.disabled = false;
    applyBtn.disabled = false;
  }
});

applyBtn.addEventListener("click", async () => {
  const files = fileInput.files;
  if (!files.length) {
    statusEl.textContent = "Please select at least one file.";
    return;
  }

  analyzeBtn.disabled = true;
  applyBtn.disabled = true;
  statusEl.textContent = "Applying fixes...";

  try {
    const formData = buildBaseFormData(files);
    formData.append("safe_only", safeOnlyToggleEl?.checked ? "true" : "false");
    formData.append("issue_ids", issueIdsInputEl?.value || "");
    const response = await fetch("/api/apply-fixes", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to apply fixes.");
    }

    renderAppliedFiles(payload.fixed_files);
    renderScoreDelta(payload.score_delta);
    renderSkippedIssues(payload.skipped_issues);
    renderWorkflow(payload.workflow);
    statusEl.textContent = `Applied fixes for ${payload.applied_count} file(s) with ${payload.profile} profile.`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
  } finally {
    analyzeBtn.disabled = false;
    applyBtn.disabled = false;
  }
});

renderScores(null);
renderWorkflow(null);
renderIssues([]);
renderFixes([]);
renderFileFixes([]);
renderAppliedFiles([]);
renderScoreDelta(null);
renderSkippedIssues([]);

severityFilterEl?.addEventListener("change", () => renderIssues(latestIssues));
issueSearchEl?.addEventListener("input", () => renderIssues(latestIssues));

