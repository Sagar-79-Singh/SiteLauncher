/* SiteLauncher settings page — pure vanilla JS, no frameworks, no build step */

const SITES_KEY = "sites";
const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS = {
  openOnStartup: false,
  windowMode: "new", // "new" | "same"
  groupTabs: false,
  skipOpen: true,
};

let state = { sites: [], settings: { ...DEFAULT_SETTINGS } };
let editingId = null;

/* ------------------------------------------------------------------ urls */

// Mirror of background.js: "gmail.com" -> "https://gmail.com", invalid -> ""
function normalizeUrl(input) {
  if (!input) return "";
  let raw = String(input).trim();
  if (!raw) return "";

  if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(raw)) {
    if (/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)+/.test(raw)) {
      raw = "https://" + raw;
    } else {
      return "";
    }
  }

  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (!u.hostname) return "";
    return u.href;
  } catch (e) {
    return "";
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return url;
  }
}

/* --------------------------------------------------------------- storage */

async function load() {
  const data = await chrome.storage.sync.get([SITES_KEY, SETTINGS_KEY]);
  state.sites = Array.isArray(data[SITES_KEY]) ? data[SITES_KEY] : [];
  state.settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
}

function saveSites() {
  chrome.storage.sync.set({ [SITES_KEY]: state.sites });
}

function saveSettings() {
  chrome.storage.sync.set({ [SETTINGS_KEY]: state.settings });
}

/* ---------------------------------------------------------------- utils */

const $ = (id) => document.getElementById(id);

function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

let toastTimer = null;
function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.hidden = false;
  // force reflow so the transition runs even when hidden just before
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => {
      el.hidden = true;
    }, 250);
  }, 2200);
}

/* -------------------------------------------------------------- favicon */

function avatarEl(site) {
  const avatar = document.createElement("div");
  avatar.className = "avatar";

  const letter = (site.name || hostOf(site.url) || "?").trim().charAt(0).toUpperCase() || "?";
  const letterEl = document.createElement("span");
  letterEl.textContent = letter;
  avatar.appendChild(letterEl);

  const url = normalizeUrl(site.url);
  if (url) {
    const img = document.createElement("img");
    img.className = "favicon-img";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = `${new URL(url).origin}/favicon.ico`;
    img.addEventListener("error", () => {
      img.remove();
      letterEl.style.display = "";
    });
    img.addEventListener("load", () => {
      letterEl.style.display = "none";
    });
    avatar.appendChild(img);
  }
  return avatar;
}

/* ------------------------------------------------------------ rendering */

function updateCount() {
  const enabled = state.sites.filter((s) => s.enabled !== false).length;
  $("count").textContent = String(enabled);
  $("count").title = `${enabled} enabled site${enabled === 1 ? "" : "s"}`;
}

function updateSummary() {
  const total = state.sites.length;
  const enabled = state.sites.filter((s) => s.enabled !== false).length;
  const el = $("listSummary");
  if (total === 0) {
    el.textContent = "";
  } else {
    el.textContent = `${enabled} of ${total} enabled`;
  }
}

function render() {
  updateCount();
  updateSummary();

  const empty = $("empty");
  const list = $("list");

  if (state.sites.length === 0) {
    empty.hidden = false;
    list.hidden = true;
    list.innerHTML = "";
    return;
  }
  empty.hidden = true;
  list.hidden = false;
  list.innerHTML = "";
  state.sites.forEach((site, index) => list.appendChild(renderItem(site, index)));
}

function renderItem(site, index) {
  const li = document.createElement("li");
  li.className = "site" + (site.enabled === false ? " off" : "");
  li.dataset.id = site.id;
  li.draggable = true;
  li.dataset.index = String(index);

  // drag handle
  const grip = document.createElement("span");
  grip.className = "grip";
  grip.setAttribute("aria-label", "Drag to reorder");
  grip.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
  li.appendChild(grip);

  li.appendChild(avatarEl(site));

  const meta = document.createElement("div");
  meta.className = "site-meta";

  if (editingId === site.id) {
    li.appendChild(renderEdit(site, meta));
  } else {
    const name = document.createElement("div");
    name.className = "site-name";
    name.textContent = site.name || hostOf(site.url);

    const url = document.createElement("div");
    url.className = "site-url";
    url.textContent = site.url;

    meta.appendChild(name);
    meta.appendChild(url);
    li.appendChild(meta);
  }

  // actions
  const actions = document.createElement("div");
  actions.className = "site-actions";

  if (editingId !== site.id) {
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "switch";
    toggle.checked = site.enabled !== false;
    toggle.title = site.enabled === false ? "Enable site" : "Disable site";
    toggle.addEventListener("change", () => {
      site.enabled = toggle.checked;
      saveSites();
      render();
    });
    actions.appendChild(toggle);

    actions.appendChild(iconButton("edit", "Edit", (e) => {
      e.stopPropagation();
      editingId = editingId === site.id ? null : site.id;
      render();
    }));

    actions.appendChild(iconButton("delete", "Delete", (e) => {
      e.stopPropagation();
      removeSite(site.id);
    }, true));
  }

  li.appendChild(actions);
  return li;
}

function iconButton(kind, title, onClick, danger = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn" + (danger ? " danger" : "");
  btn.title = title;
  btn.setAttribute("aria-label", title);
  if (kind === "edit") {
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  } else if (kind === "delete") {
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';
  }
  btn.addEventListener("click", onClick);
  return btn;
}

function renderEdit(site, meta) {
  const wrap = document.createElement("div");
  wrap.className = "site-edit";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "input";
  nameInput.placeholder = "Name";
  nameInput.value = site.name || "";
  nameInput.id = `edit-name-${site.id}`;

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.className = "input";
  urlInput.placeholder = "URL";
  urlInput.value = site.url;
  urlInput.id = `edit-url-${site.id}`;

  const error = document.createElement("p");
  error.className = "error";
  error.hidden = true;

  const rowActions = document.createElement("div");
  rowActions.className = "row-actions";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "btn-ghost save";
  save.textContent = "Save";
  save.addEventListener("click", () => {
    const url = normalizeUrl(urlInput.value);
    if (!url) {
      error.textContent = "Enter a valid URL, e.g. gmail.com";
      error.hidden = false;
      return;
    }
    site.name = nameInput.value.trim();
    site.url = url;
    saveSites();
    editingId = null;
    render();
    toast("Site updated");
  });

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn-ghost";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => {
    editingId = null;
    render();
  });

  rowActions.appendChild(save);
  rowActions.appendChild(cancel);

  wrap.appendChild(nameInput);
  wrap.appendChild(urlInput);
  wrap.appendChild(error);
  wrap.appendChild(rowActions);

  setTimeout(() => {
    const el = document.getElementById(`edit-url-${site.id}`);
    if (el) el.focus();
  }, 0);

  return wrap;
}

/* ------------------------------------------------------------- mutations */

async function removeSite(id) {
  const site = state.sites.find((s) => s.id === id);
  if (!site) return;
  const label = site.name || hostOf(site.url);
  if (!confirm(`Remove "${label}"?`)) return;
  state.sites = state.sites.filter((s) => s.id !== id);
  if (editingId === id) editingId = null;
  saveSites();
  render();
  toast("Site removed");
}

function addSite(name, urlRaw) {
  const url = normalizeUrl(urlRaw);
  if (!url) return false;
  const cleanName = String(name || "").trim() || hostOf(url);
  if (state.sites.some((s) => normalizeUrl(s.url) === url)) {
    toast("That site is already in your list", true);
    return false;
  }
  state.sites.push({ id: uid(), name: cleanName, url, enabled: true });
  saveSites();
  render();
  toast(`Added ${cleanName}`);
  return true;
}

/* -------------------------------------------------------------- reorder */

let dragFrom = null;

function initDragAndDrop() {
  const list = $("list");

  list.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".site");
    if (!li) return;
    dragFrom = Number(li.dataset.index);
    li.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", li.dataset.id);
      } catch (err) { /* some browsers */ }
    }
  });

  list.addEventListener("dragend", (e) => {
    const li = e.target.closest(".site");
    if (li) li.classList.remove("dragging");
    list.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
    dragFrom = null;
  });

  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const li = e.target.closest(".site");
    if (!li) return;
    list.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
    li.classList.add("drop-target");
  });

  list.addEventListener("drop", (e) => {
    e.preventDefault();
    const li = e.target.closest(".site");
    if (!li || dragFrom === null) return;
    const from = dragFrom;
    const to = Number(li.dataset.index);
    if (from === to) return;

    const [moved] = state.sites.splice(from, 1);
    state.sites.splice(to, 0, moved);
    saveSites();
    render();
  });
}

/* --------------------------------------------------------------- settings */

function bindSettings() {
  const startup = $("openOnStartup");
  const group = $("groupTabs");
  const skip = $("skipOpen");
  const modeNew = $("mode-new");
  const modeSame = $("mode-same");

  startup.checked = !!state.settings.openOnStartup;
  group.checked = !!state.settings.groupTabs;
  skip.checked = !!state.settings.skipOpen;
  if (state.settings.windowMode === "same") {
    modeSame.checked = true;
  } else {
    modeNew.checked = true;
  }

  startup.addEventListener("change", () => {
    state.settings.openOnStartup = startup.checked;
    saveSettings();
  });
  group.addEventListener("change", () => {
    state.settings.groupTabs = group.checked;
    saveSettings();
  });
  skip.addEventListener("change", () => {
    state.settings.skipOpen = skip.checked;
    saveSettings();
  });
  [modeNew, modeSame].forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.settings.windowMode = input.value;
        saveSettings();
      }
    });
  });
}

/* ------------------------------------------------------------------ init */

function bindAddForm() {
  const form = $("addForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("newName").value;
    const url = $("newUrl").value;
    const errEl = $("addError");

    if (!url.trim()) {
      errEl.textContent = "Please enter a URL.";
      errEl.hidden = false;
      return;
    }
    if (!normalizeUrl(url)) {
      errEl.textContent = "That doesn’t look like a valid URL.";
      errEl.hidden = false;
      return;
    }

    errEl.hidden = true;
    if (addSite(name, url)) {
      $("newName").value = "";
      $("newUrl").value = "";
      $("newUrl").focus();
    }
  });
}

async function init() {
  await load();
  bindSettings();
  bindAddForm();
  initDragAndDrop();
  render();
}

init();
