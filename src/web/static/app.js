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
  profile: document.querySelector("#profileRail"),
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
    elements.profile.innerHTML = renderProfile();
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
  elements.list.innerHTML = companies.length ? companies.map((company) => renderIndexRow(company)).join("") : `<div class="empty-state">No matches.</div>`;
  elements.detail.innerHTML = selected ? renderDetail(selected) : `<div class="reading-inner"><p class="lede">Select a company to inspect notes and evidence.</p></div>`;

  elements.list.querySelectorAll(".index-row").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedCompanyId = Number(row.dataset.companyId);
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
  return [count(companies.length, "company", "companies"), count(state.snapshot.roles.length, "role"), count(state.snapshot.evidence.length, "source")].join(
    " · ",
  );
}

function renderIndexRow(company) {
  const application = companyApplication(company.id);
  const selected = company.id === state.selectedCompanyId;
  const sub = [company.primaryLabel || humanize(company.status), humanize(application?.stage || "not started")].filter(Boolean).join(" · ");
  return `
    <button class="index-row" data-company-id="${company.id}" aria-selected="${selected}">
      <span class="index-name">${escapeHtml(company.name)}</span>
      <span class="index-fit">${formatScore(company.fitScore)}</span>
      <span class="index-sub">${escapeHtml(sub)}</span>
    </button>
  `;
}

function renderDetail(company) {
  const counts = companyCounts(company.id);
  const roles = state.snapshot.roles.filter((role) => role.companyId === company.id);
  const notes = state.snapshot.notes.filter((note) => note.targetType === "company" && note.targetId === company.id);
  const evidence = state.snapshot.evidence.filter((item) => item.targetType === "company" && item.targetId === company.id);
  const application = companyApplication(company.id);
  return `
    <div class="reading-inner">
      <header class="reading-head">
        <p class="reading-eyebrow">${escapeHtml(company.primaryLabel || humanize(company.status))}</p>
        <div class="reading-title-row">
          <h2>${escapeHtml(company.name)}</h2>
          <span class="reading-fit"><b>${formatScore(company.fitScore)}</b><small>fit</small></span>
        </div>
        ${company.maker ? `<p class="reading-maker">by ${escapeHtml(company.maker)}</p>` : ""}
        <p class="reading-meta">${[humanize(company.status), count(counts.roles, "role"), count(counts.notes, "note"), count(counts.evidence, "source")].join(" · ")}</p>
        ${renderHeaderLinks(company, evidence)}
        <p class="lede">${escapeHtml(company.fitAssessment || company.summary || "No assessment yet.")}</p>
      </header>
      ${renderSection("Application", renderApplication(application))}
      ${renderSection("Roles", listHtml(roles.map(roleItem)))}
      ${renderSection("Notes", listHtml(notes.map((note) => escapeHtml(note.body))))}
      ${renderSection("Evidence", listHtml(evidence.map(evidenceItem)))}
    </div>
  `;
}

function renderHeaderLinks(company, evidence) {
  const links = [];
  if (isHttpUrl(company.url)) {
    links.push(externalLink(company.url, "Home"));
  }
  const careers = evidence.find((item) => isHttpUrl(item.url) && /careers?|jobs?/i.test(item.url));
  if (careers) {
    links.push(externalLink(careers.url, "Careers"));
  }
  return links.length ? `<p class="reading-links">${links.join("")}</p>` : "";
}

function roleItem(role) {
  const meta = escapeHtml(`${humanize(role.remotePolicy)} · ${formatScore(role.fitScore)}`);
  const title = isHttpUrl(role.url) ? externalLink(role.url, role.title) : escapeHtml(role.title);
  return `${title} <span class="muted-inline">· ${meta}</span>`;
}

function evidenceItem(item) {
  const label = item.title || item.url;
  const head = isHttpUrl(item.url) ? externalLink(item.url, label) : escapeHtml(label);
  return `${head}${item.snippet ? ` <span class="muted-inline">— ${escapeHtml(item.snippet)}</span>` : ""}`;
}

function externalLink(url, text) {
  return `<a class="ext-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function renderApplication(application) {
  if (!application) {
    return `<p class="muted-line">Not started.</p>`;
  }
  const meta = [
    application.nextAction ? `next: ${application.nextAction}` : null,
    application.nextActionAt ? `by ${application.nextActionAt}` : null,
    application.lastContactedAt ? `last contacted ${application.lastContactedAt}` : null,
  ].filter(Boolean);
  return `
    <p class="app-line"><span class="stage-tag">${escapeHtml(humanize(application.stage))}</span>${meta.length ? `<span class="muted-line">${escapeHtml(meta.join(" · "))}</span>` : ""}</p>
    ${application.notes ? `<p class="app-notes">${escapeHtml(application.notes)}</p>` : ""}
  `;
}

function renderProfile() {
  const profile = state.snapshot.profile;
  if (!profile) {
    return "";
  }
  const groups = [
    { kind: "requirement", title: "Requirements" },
    { kind: "interest", title: "Interested in" },
    { kind: "positive_signal", title: "Green flags" },
    { kind: "negative_signal", title: "Avoid" },
    { kind: "constraint", title: "Constraints" },
  ];
  const preferences = state.snapshot.preferences || [];
  const groupsHtml = groups
    .map((group) => {
      const items = preferences.filter((pref) => pref.kind === group.kind);
      if (!items.length) {
        return "";
      }
      const itemsHtml = items
        .map(
          (pref) => `
            <div class="pref">
              <div class="pref-label">${escapeHtml(pref.label)}</div>
              ${pref.description ? `<div class="pref-desc">${escapeHtml(pref.description)}</div>` : ""}
            </div>`,
        )
        .join("");
      return `
        <section class="rail-group${group.kind === "negative_signal" ? " is-avoid" : ""}">
          <h3 class="rail-label">${group.title}</h3>
          <div class="rail-items">${itemsHtml}</div>
        </section>`;
    })
    .join("");
  return `
    <div class="rail-inner">
      <div class="rail-identity">
        <p class="rail-eyebrow">Profile</p>
        <h2 class="rail-name">${escapeHtml(profile.name)}</h2>
        <p class="rail-summary">${escapeHtml(profile.summary || "")}</p>
      </div>
      ${groupsHtml}
    </div>
  `;
}

function renderSection(label, bodyHtml) {
  return `
    <section class="rsec">
      <h3 class="rsec-label">${label}</h3>
      <div class="rsec-body">${bodyHtml}</div>
    </section>
  `;
}

// items are already-escaped HTML strings
function listHtml(items) {
  if (!items.length) {
    return `<p class="muted-line">None yet.</p>`;
  }
  return `<ul class="detail-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
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

function option(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function humanize(value) {
  return String(value).replaceAll("_", " ");
}

function count(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural || `${singular}s`}`;
}

function formatScore(score) {
  return typeof score === "number" ? `${Math.round(score * 100)}%` : "—";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
