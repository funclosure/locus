const state = {
  snapshot: null,
  selectedCompanyId: null,
  search: "",
  status: "all",
  label: "all",
};

const elements = {
  list: document.querySelector("#companyList"),
  detail: document.querySelector("#detailPanel"),
  summary: document.querySelector("#summary"),
  search: document.querySelector("#search"),
  status: document.querySelector("#statusFilter"),
  label: document.querySelector("#labelFilter"),
};

init();

async function init() {
  try {
    const response = await fetch("/api/snapshot");
    if (!response.ok) {
      throw new Error(`Snapshot request failed with ${response.status}`);
    }
    state.snapshot = await response.json();
    state.selectedCompanyId = state.snapshot.companies[0]?.id ?? null;
    bindFilters();
    render();
  } catch (error) {
    elements.list.innerHTML = `<div class="error-state">${escapeHtml(error.message || "Unable to load Locus data.")}</div>`;
    elements.detail.innerHTML = "";
  }
}

function bindFilters() {
  const statuses = unique(state.snapshot.companies.map((company) => company.status));
  const labels = unique(state.snapshot.companies.map((company) => company.primaryLabel).filter(Boolean));
  elements.status.innerHTML = option("all", "All statuses") + statuses.map((status) => option(status, humanize(status))).join("");
  elements.label.innerHTML = option("all", "All labels") + labels.map((label) => option(label, label)).join("");

  elements.search.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  elements.status.addEventListener("change", (event) => {
    state.status = event.target.value;
    render();
  });
  elements.label.addEventListener("change", (event) => {
    state.label = event.target.value;
    render();
  });
}

function render() {
  const companies = filteredCompanies();
  const selected = companies.find((company) => company.id === state.selectedCompanyId) ?? companies[0] ?? null;
  state.selectedCompanyId = selected?.id ?? null;
  elements.summary.innerHTML = renderSummary(companies);
  elements.list.innerHTML = companies.length ? companies.map((company) => renderCompanyRow(company)).join("") : `<div class="empty-state">No matches.</div>`;
  elements.detail.innerHTML = selected ? renderDetail(selected) : `<p>Select a company to inspect notes and evidence.</p>`;

  elements.list.querySelectorAll(".company-row").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedCompanyId = Number(row.dataset.companyId);
      render();
    });
  });
  const form = elements.detail.querySelector("#progressForm");
  form?.addEventListener("submit", saveProgress);
}

function filteredCompanies() {
  const query = state.search.trim().toLowerCase();
  return state.snapshot.companies.filter((company) => {
    const searchable = [company.name, company.summary, company.primaryLabel, company.fitAssessment].filter(Boolean).join(" ").toLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (state.status === "all" || company.status === state.status) &&
      (state.label === "all" || company.primaryLabel === state.label)
    );
  });
}

function renderSummary(companies) {
  const roles = state.snapshot.roles.length;
  const evidence = state.snapshot.evidence.length;
  return [
    `<span class="metric">${companies.length} companies</span>`,
    `<span class="metric">${roles} roles</span>`,
    `<span class="metric">${evidence} evidence items</span>`,
  ].join("");
}

function renderCompanyRow(company) {
  const counts = companyCounts(company.id);
  const application = companyApplication(company.id);
  const selected = company.id === state.selectedCompanyId;
  const pillClass = company.primaryLabel?.toLowerCase().includes("ai") ? "pill ai" : company.fitScore >= 0.85 ? "pill good" : "pill";
  return `
    <button class="company-row" data-company-id="${company.id}" aria-selected="${selected}">
      <div class="row-main">
        <h2>${escapeHtml(company.name)}</h2>
        <span class="fit">${formatScore(company.fitScore)}</span>
      </div>
      <div class="row-meta">
        <span class="${pillClass}">${escapeHtml(company.primaryLabel || company.status)}</span>
        <span class="stage">${escapeHtml(humanize(application?.stage || "not_started"))}</span>
      </div>
      <div class="tag-row">
        <span class="tag">${escapeHtml(humanize(company.status))}</span>
        <span class="tag">${counts.roles} roles</span>
        <span class="tag">${counts.notes} notes</span>
        <span class="tag">${counts.evidence} sources</span>
      </div>
    </button>
  `;
}

function renderDetail(company) {
  const roles = state.snapshot.roles.filter((role) => role.companyId === company.id);
  const notes = state.snapshot.notes.filter((note) => note.targetType === "company" && note.targetId === company.id);
  const evidence = state.snapshot.evidence.filter((item) => item.targetType === "company" && item.targetId === company.id);
  const application = companyApplication(company.id);
  return `
    <div class="detail-header">
      <div>
        <span class="pill">${escapeHtml(company.primaryLabel || company.status)}</span>
        <h2>${escapeHtml(company.name)}</h2>
        <p>${escapeHtml(company.fitAssessment || company.summary || "No assessment yet.")}</p>
      </div>
      <div class="score-block">
        <span>${formatScore(company.fitScore)}</span>
        <small>fit score</small>
      </div>
    </div>
    ${renderProgressForm(company, application)}
    ${renderList("Roles", roles.map((role) => `${role.title} · ${humanize(role.remotePolicy)} · ${formatScore(role.fitScore)}`))}
    ${renderList("Notes", notes.map((note) => note.body))}
    ${renderList("Evidence", evidence.map((item) => `${item.title || item.url}: ${item.snippet}`))}
  `;
}

function renderProgressForm(company, application) {
  return `
    <section class="detail-section progress-section">
      <div class="section-heading">
        <h3>Application progress</h3>
        <span class="stage strong">${escapeHtml(humanize(application?.stage || "researching"))}</span>
      </div>
      <form id="progressForm" class="progress-form" data-company-id="${company.id}">
        <label>
          <span>Stage</span>
          <select name="stage">
            ${applicationStageOptions(application?.stage || "researching")}
          </select>
        </label>
        <label>
          <span>Next action</span>
          <input name="nextAction" value="${escapeAttribute(application?.nextAction || "")}" placeholder="What should happen next?" />
        </label>
        <label>
          <span>Next action date</span>
          <input name="nextActionAt" type="date" value="${escapeAttribute(application?.nextActionAt || "")}" />
        </label>
        <label>
          <span>Last contacted</span>
          <input name="lastContactedAt" type="date" value="${escapeAttribute(application?.lastContactedAt || "")}" />
        </label>
        <label class="full">
          <span>Progress notes</span>
          <textarea name="notes" rows="3" placeholder="Current application context">${escapeHtml(application?.notes || "")}</textarea>
        </label>
        <button class="save-button" type="submit">Save progress</button>
        <span id="progressStatus" class="save-status" aria-live="polite"></span>
      </form>
    </section>
  `;
}

async function saveProgress(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("#progressStatus");
  const formData = new FormData(form);
  status.textContent = "Saving...";
  const response = await fetch("/api/applications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      targetType: "company",
      targetId: Number(form.dataset.companyId),
      stage: formData.get("stage"),
      nextAction: emptyToNull(formData.get("nextAction")),
      nextActionAt: emptyToNull(formData.get("nextActionAt")),
      lastContactedAt: emptyToNull(formData.get("lastContactedAt")),
      notes: emptyToNull(formData.get("notes")),
    }),
  });
  if (!response.ok) {
    status.textContent = "Save failed";
    return;
  }
  const parsed = await response.json();
  const index = state.snapshot.applications.findIndex(
    (application) => application.targetType === parsed.application.targetType && application.targetId === parsed.application.targetId,
  );
  if (index >= 0) {
    state.snapshot.applications[index] = parsed.application;
  } else {
    state.snapshot.applications.push(parsed.application);
  }
  status.textContent = "Saved";
  render();
}

function renderList(title, items) {
  return `
    <section class="detail-section">
      <h3>${title}</h3>
      <ul class="detail-list">
        ${items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>None yet.</li>"}
      </ul>
    </section>
  `;
}

function companyApplication(companyId) {
  return state.snapshot.applications.find((application) => application.targetType === "company" && application.targetId === companyId) || null;
}

function companyCounts(companyId) {
  return {
    roles: state.snapshot.roles.filter((role) => role.companyId === companyId).length,
    notes: state.snapshot.notes.filter((note) => note.targetType === "company" && note.targetId === companyId).length,
    evidence: state.snapshot.evidence.filter((item) => item.targetType === "company" && item.targetId === companyId).length,
  };
}

function applicationStageOptions(selected) {
  return ["researching", "warm_intro", "reached_out", "applied", "interviewing", "offer", "rejected", "paused"]
    .map((stage) => `<option value="${stage}" ${stage === selected ? "selected" : ""}>${escapeHtml(humanize(stage))}</option>`)
    .join("");
}

function option(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function humanize(value) {
  return String(value).replaceAll("_", " ");
}

function formatScore(score) {
  return typeof score === "number" ? `${Math.round(score * 100)}%` : "unscored";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function emptyToNull(value) {
  const stringValue = String(value || "").trim();
  return stringValue ? stringValue : null;
}
