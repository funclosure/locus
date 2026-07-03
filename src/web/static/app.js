const state = {
  snapshot: null,
  compensation: null,
  compensationOpen: false,
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
    state.compensation = await fetchCompensation();
    state.selectedCompanyId = state.snapshot.companies[0]?.id ?? null;
    bindFilters();
    elements.profile.innerHTML = renderProfile();
    render();
    initChat();
    initProfileApprovals();
    initKeyboardNav();
  } catch (error) {
    elements.list.innerHTML = `<div class="error-state">${escapeHtml(error.message || "Unable to load Locus data.")}</div>`;
    elements.detail.innerHTML = "";
  }
}

// private local file (.locus/compensation.md); a 404 just hides the section
async function fetchCompensation() {
  try {
    const response = await fetch("/api/compensation");
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return typeof data.markdown === "string" && data.markdown.trim() ? data.markdown : null;
  } catch {
    return null;
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
  wireLede();

  elements.list.querySelectorAll(".index-row").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedCompanyId = Number(row.dataset.companyId);
      render();
    });
  });
}

// reveal the "Read more" toggle only when the clamped assessment actually overflows
function wireLede() {
  const lede = elements.detail.querySelector("[data-lede]");
  const toggle = elements.detail.querySelector("[data-lede-toggle]");
  if (!lede || !toggle) return;
  if (lede.scrollHeight - lede.clientHeight > 4) {
    toggle.hidden = false;
  }
  toggle.addEventListener("click", () => {
    const clamped = lede.classList.toggle("clamped");
    toggle.textContent = clamped ? "Read more" : "Read less";
    if (clamped) {
      lede.scrollIntoView({ block: "nearest" });
    }
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
        <div class="lede-wrap">
          <p class="lede clamped" data-lede>${escapeHtml(company.fitAssessment || company.summary || "No assessment yet.")}</p>
          <button type="button" class="lede-toggle" data-lede-toggle hidden>Read more</button>
        </div>
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

// ── quick-chat overlay: feedback in, model-applied edits out ──
function initChat() {
  const overlay = document.querySelector("#chatOverlay");
  const trigger = document.querySelector("#chatTrigger");
  const context = document.querySelector("#chatContext");
  const log = document.querySelector("#chatLog");
  const form = document.querySelector("#chatForm");
  const input = document.querySelector("#chatInput");
  const close = document.querySelector("#chatClose");
  const clear = document.querySelector("#chatClear");
  const selectionEl = document.querySelector("#chatSelection");
  let chatSelection = "";

  // capture the page's highlighted text so it rides along as context
  function armSelection() {
    chatSelection = (window.getSelection && window.getSelection().toString().trim()) || "";
    renderSelection();
  }
  function renderSelection() {
    if (chatSelection) {
      selectionEl.innerHTML = `<span class="chat-selection-quote">${escapeHtml(chatSelection)}</span><button type="button" class="chat-selection-clear" aria-label="Remove selection">×</button>`;
      selectionEl.hidden = false;
    } else {
      selectionEl.innerHTML = "";
      selectionEl.hidden = true;
    }
  }

  function open() {
    const company = state.snapshot.companies.find((item) => item.id === state.selectedCompanyId);
    context.textContent = company ? company.name : "all companies";
    overlay.hidden = false;
    input.focus();
    scroll();
  }
  function shut() {
    overlay.hidden = true;
  }
  function scroll() {
    log.scrollTop = log.scrollHeight;
  }
  function bubble(role, html) {
    const el = document.createElement("div");
    el.className = `chat-msg ${role}`;
    el.innerHTML = role === "user" ? `<span class="chat-bubble">${html}</span>` : html;
    log.appendChild(el);
    scroll();
    return el;
  }

  // the docked bar is a trigger; "/" opens the panel too — typing happens in the panel
  // pointerdown fires before the click clears the page selection
  trigger.addEventListener("pointerdown", armSelection);
  trigger.addEventListener("click", open);
  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      armSelection();
      open();
    } else if (event.key === "Escape" && !overlay.hidden) {
      shut();
    }
  });
  selectionEl.addEventListener("click", (event) => {
    if (event.target.closest(".chat-selection-clear")) {
      chatSelection = "";
      renderSelection();
    }
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      shut();
    }
  });
  close.addEventListener("click", shut);

  // Clear needs a confirm: first click arms it, second click clears, auto-reverts
  let clearTimer = null;
  function disarmClear() {
    clearTimeout(clearTimer);
    clear.classList.remove("is-armed");
    clear.textContent = "Clear";
    delete clear.dataset.armed;
  }
  clear.addEventListener("click", () => {
    if (!log.childElementCount) {
      return;
    }
    if (clear.dataset.armed) {
      log.innerHTML = "";
      disarmClear();
      input.focus();
      return;
    }
    clear.dataset.armed = "true";
    clear.textContent = "Clear?";
    clear.classList.add("is-armed");
    clearTimer = setTimeout(disarmClear, 3000);
  });

  // approve / dismiss a proposed preference inline
  log.addEventListener("click", async (event) => {
    const button = event.target.closest(".pref-btn");
    if (!button) {
      return;
    }
    const row = button.closest(".chat-edit.proposed");
    const id = Number(row?.dataset.pref);
    const action = button.dataset.action;
    if (!id || !action) {
      return;
    }
    row.innerHTML = `<span class="pref-resolved">${action === "approve" ? "Approving…" : "Dismissing…"}</span>`;
    try {
      const response = await fetch("/api/preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        row.innerHTML = `<span class="chat-error">${escapeHtml(data.error || "Could not update.")}</span>`;
        return;
      }
      row.innerHTML = `<span class="pref-resolved">${action === "approve" ? "✓ Approved" : "✕ Dismissed"}: ${escapeHtml(data.preference.label)}</span>`;
      await refreshSnapshot();
    } catch (error) {
      row.innerHTML = `<span class="chat-error">${escapeHtml(error.message || "Request failed.")}</span>`;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) {
      return;
    }
    input.value = "";
    open();
    bubble("user", escapeHtml(message));
    const pending = bubble("assistant", `<span class="chat-thinking">thinking…</span>`);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, companyId: state.selectedCompanyId, selection: chatSelection || null }),
      });
      const data = await response.json();
      if (!response.ok) {
        pending.innerHTML = `<span class="chat-error">${escapeHtml(data.error || "Chat is unavailable.")}</span>`;
        return;
      }
      pending.innerHTML = renderChatReply(data);
      scroll();
      if ((data.edits && data.edits.length) || (data.proposed && data.proposed.length)) {
        await refreshSnapshot();
      }
    } catch (error) {
      pending.innerHTML = `<span class="chat-error">${escapeHtml(error.message || "Request failed.")}</span>`;
    }
  });
}

// ↑/↓ move through the company index; Enter dives into the reading pane
function initKeyboardNav() {
  document.addEventListener("keydown", (event) => {
    // the chat overlay owns the keyboard while it's open
    if (!document.querySelector("#chatOverlay").hidden) {
      return;
    }
    const active = document.activeElement;
    const tag = active?.tagName;
    // let native dropdowns and text inputs (other than search) keep their keys
    if (tag === "SELECT" || (tag === "INPUT" && active.id !== "search") || tag === "TEXTAREA") {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveCompany(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && tag !== "BUTTON") {
      const detail = document.querySelector("#detailPanel");
      const link = detail.querySelector("a.ext-link");
      event.preventDefault();
      (link || detail).focus();
    }
  });
}

function moveCompany(delta) {
  const companies = filteredCompanies();
  if (!companies.length) {
    return;
  }
  const current = companies.findIndex((company) => company.id === state.selectedCompanyId);
  const next = Math.min(companies.length - 1, Math.max(0, (current < 0 ? 0 : current) + delta));
  state.selectedCompanyId = companies[next].id;
  render();
  elements.list.querySelector('.index-row[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}

// approve / dismiss pending preference candidates from the profile rail
function initProfileApprovals() {
  // toggle doesn't bubble, so listen in the capture phase; remembering the state
  // here keeps the fold from snapping shut when a chat edit re-renders the rail
  elements.profile.addEventListener(
    "toggle",
    (event) => {
      if (event.target.classList?.contains("comp-group")) {
        state.compensationOpen = event.target.open;
      }
    },
    true,
  );
  elements.profile.addEventListener("click", async (event) => {
    const button = event.target.closest(".pref-btn");
    if (!button) {
      return;
    }
    const id = Number(button.dataset.pref);
    const action = button.dataset.action;
    if (!id || !action) {
      return;
    }
    button.closest(".pref-actions")?.querySelectorAll("button").forEach((el) => (el.disabled = true));
    try {
      const response = await fetch("/api/preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (response.ok) {
        await refreshSnapshot();
      }
    } catch {
      // leave the rail as-is if the request fails
    }
  });
}

function renderChatReply(data) {
  const lines = [];
  if (data.reply) {
    lines.push(escapeHtml(data.reply));
  }
  const edits = (data.edits || []).map((edit) => `<div class="chat-edit">${escapeHtml(edit)}</div>`);
  const proposed = (data.proposed || []).map(
    (item) =>
      `<div class="chat-edit proposed" data-pref="${item.id}"><span>${escapeHtml(item.label)}</span>` +
      `<span class="pref-actions"><button type="button" class="pref-btn" data-action="approve">Approve</button>` +
      `<button type="button" class="pref-btn" data-action="reject">Dismiss</button></span></div>`,
  );
  if (edits.length || proposed.length) {
    lines.push(`<div class="chat-edits">${edits.join("")}${proposed.join("")}</div>`);
  }
  return lines.join("");
}

async function refreshSnapshot() {
  try {
    const response = await fetch("/api/snapshot");
    if (!response.ok) {
      return;
    }
    state.snapshot = await response.json();
    elements.profile.innerHTML = renderProfile();
    render();
  } catch {
    // keep the current view if the refresh fails
  }
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
  const pending = (state.snapshot.preferenceCandidates || []).filter((candidate) => candidate.status === "pending");
  const pendingHtml = pending.length
    ? `
        <section class="rail-group is-pending">
          <h3 class="rail-label">Pending review</h3>
          <div class="rail-items">
            ${pending
              .map(
                (candidate) => `
                  <div class="pref" data-pref="${candidate.id}">
                    <div class="pref-label">${escapeHtml(candidate.label)}</div>
                    ${candidate.description ? `<div class="pref-desc">${escapeHtml(candidate.description)}</div>` : ""}
                    <div class="pref-actions">
                      <button type="button" class="pref-btn" data-pref="${candidate.id}" data-action="approve">Approve</button>
                      <button type="button" class="pref-btn" data-pref="${candidate.id}" data-action="reject">Dismiss</button>
                    </div>
                  </div>`,
              )
              .join("")}
          </div>
        </section>`
    : "";
  return `
    <div class="rail-inner">
      <div class="rail-identity">
        <p class="rail-eyebrow">Profile</p>
        <h2 class="rail-name">${escapeHtml(profile.name)}</h2>
        <p class="rail-summary">${escapeHtml(profile.summary || "")}</p>
      </div>
      ${renderCompensation()}
      ${pendingHtml}
      ${groupsHtml}
    </div>
  `;
}

// collapsed by default: comp data stays hidden while screen-sharing the cockpit
function renderCompensation() {
  if (!state.compensation) {
    return "";
  }
  return `
    <details class="rail-group comp-group"${state.compensationOpen ? " open" : ""}>
      <summary class="rail-label comp-summary">Compensation <span class="comp-badge">private</span></summary>
      <div class="comp-body">${renderMarkdown(state.compensation)}</div>
    </details>
  `;
}

// just enough markdown for the comp file: headings, tables, lists, bold/italic/code
function renderMarkdown(markdown) {
  const html = [];
  let table = null;
  let list = null;

  const flushTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    html.push(
      `<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>` +
        `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
    );
    table = null;
  };
  const flushList = () => {
    if (!list) return;
    html.push(`<ul>${list.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    list = null;
  };

  for (const raw of String(markdown).split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("|")) {
      flushList();
      const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => mdInline(cell.trim()));
      if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        (table = table || []).push(cells);
      }
      continue;
    }
    flushTable();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      html.push(`<div class="md-h md-h${heading[1].length}">${mdInline(heading[2])}</div>`);
      continue;
    }
    if (/^- /.test(line)) {
      (list = list || []).push(mdInline(line.slice(2)));
      continue;
    }
    flushList();
    if (line) {
      html.push(`<p>${mdInline(line)}</p>`);
    }
  }
  flushTable();
  flushList();
  return html.join("");
}

function mdInline(text) {
  return escapeHtml(text)
    .replace(/^\[ \]\s*/, "☐ ")
    .replace(/^\[x\]\s*/i, "☑ ")
    .replaceAll(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replaceAll(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replaceAll(/`([^`]+)`/g, "<code>$1</code>");
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
