const state = {
  snapshot: null,
  selectedCompanyId: null,
  search: "",
  status: "all",
  label: "all",
};

const elements = {
  grid: document.querySelector("#companyGrid"),
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
    elements.grid.innerHTML = `<div class="error-state">${escapeHtml(error.message || "Unable to load Locus data.")}</div>`;
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
  elements.grid.innerHTML = companies.length ? companies.map((company) => renderCompanyCard(company)).join("") : `<div class="empty-state">No companies match these filters.</div>`;
  elements.detail.innerHTML = selected ? renderDetail(selected) : `<p>Select a company to inspect notes and evidence.</p>`;

  elements.grid.querySelectorAll(".company-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedCompanyId = Number(card.dataset.companyId);
      render();
    });
  });
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

function renderCompanyCard(company) {
  const counts = companyCounts(company.id);
  const selected = company.id === state.selectedCompanyId;
  const pillClass = company.primaryLabel?.toLowerCase().includes("ai") ? "pill ai" : company.fitScore >= 0.85 ? "pill good" : "pill";
  return `
    <button class="company-card" data-company-id="${company.id}" aria-selected="${selected}">
      <div class="card-topline">
        <span class="${pillClass}">${escapeHtml(company.primaryLabel || company.status)}</span>
        <span class="fit">${formatScore(company.fitScore)}</span>
      </div>
      <h2>${escapeHtml(company.name)}</h2>
      <p>${escapeHtml(company.summary || "No summary yet.")}</p>
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
  return `
    <span class="pill">${escapeHtml(company.primaryLabel || company.status)}</span>
    <h2>${escapeHtml(company.name)}</h2>
    <p>${escapeHtml(company.fitAssessment || company.summary || "No assessment yet.")}</p>
    ${renderList("Roles", roles.map((role) => `${role.title} · ${humanize(role.remotePolicy)} · ${formatScore(role.fitScore)}`))}
    ${renderList("Notes", notes.map((note) => note.body))}
    ${renderList("Evidence", evidence.map((item) => `${item.title || item.url}: ${item.snippet}`))}
  `;
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

function companyCounts(companyId) {
  return {
    roles: state.snapshot.roles.filter((role) => role.companyId === companyId).length,
    notes: state.snapshot.notes.filter((note) => note.targetType === "company" && note.targetId === companyId).length,
    evidence: state.snapshot.evidence.filter((item) => item.targetType === "company" && item.targetId === companyId).length,
  };
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
