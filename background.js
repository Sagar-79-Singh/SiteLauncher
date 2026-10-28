/* SiteLauncher — background service worker (Manifest V3)
 *
 * One click on the pinned action icon opens every enabled site instantly.
 * There is no default_popup, so chrome.action.onClicked fires directly.
 */

const SITES_KEY = "sites";
const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS = {
  openOnStartup: false, // open sites automatically when the browser starts
  windowMode: "new", // "new" = fresh window | "same" = current window
  groupTabs: false, // group the opened tabs together
  skipOpen: true, // skip sites that are already open
};

/* ----------------------------------------------------------------- storage */

async function getSites() {
  const data = await chrome.storage.sync.get([SITES_KEY, SETTINGS_KEY]);
  return {
    sites: data[SITES_KEY] || [],
    settings: { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) },
  };
}

/* ------------------------------------------------------------------- urls */

// Normalize any user input into a valid http(s) URL, or return "" if invalid.
// "gmail.com" -> "https://gmail.com", "https://x.co" stays as-is.
function normalizeUrl(input) {
  if (!input) return "";
  let raw = String(input).trim();
  if (!raw) return "";

  if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//.test(raw)) {
    // Looks like "example.com" or "mail.google.com/inbox" -> add https://
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

/* ------------------------------------------------------------------ badge */

function flashBadge(count) {
  if (!chrome.action) return;
  chrome.action.setBadgeText({ text: String(Math.min(count, 99)) });
  chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
  chrome.action.setBadgeTextColor({ color: "#ffffff" });
  setTimeout(() => {
    if (chrome.action) chrome.action.setBadgeText({ text: "" });
  }, 2000);
}

/* --------------------------------------------------------------- launching */

async function openSites() {
  const { sites, settings } = await getSites();

  // First run: nothing configured yet -> take the user to settings.
  if (!sites || sites.length === 0) {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    return;
  }

  const enabled = sites.filter((s) => s && s.enabled !== false && s.url);

  // Track which URLs are already open (only when the switch is on).
  const open = new Set();
  if (settings.skipOpen) {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      const u = normalizeUrl(t.url);
      if (u) open.add(u);
    }
  }

  const targets = [];
  for (const s of enabled) {
    const u = normalizeUrl(s.url);
    if (u && !open.has(u)) {
      targets.push(u);
      open.add(u);
    }
  }

  if (targets.length === 0) {
    flashBadge(0);
    return;
  }

  const tabIds = [];

  if (settings.windowMode === "new") {
    // Fresh window for this launch.
    const win = await chrome.windows.create({ url: targets[0], focused: true });
    if (win && win.tabs && win.tabs[0]) tabIds.push(win.tabs[0].id);
    for (let i = 1; i < targets.length; i++) {
      const tab = await chrome.tabs.create({ url: targets[i], windowId: win.id });
      tabIds.push(tab.id);
    }
  } else {
    // Same (current) window as the user is already in.
    for (const url of targets) {
      const tab = await chrome.tabs.create({ url });
      tabIds.push(tab.id);
    }
  }

  if (settings.groupTabs && tabIds.length > 1 && chrome.tabs.group) {
    try {
      // No groupId -> the tabs are placed together in a fresh group.
      await chrome.tabs.group({ tabIds });
    } catch (e) {
      /* grouping is best-effort; never block the launch */
    }
  }

  flashBadge(targets.length);
}

/* --------------------------------------------------------------- listeners */

chrome.action.onClicked.addListener(() => {
  openSites().catch((e) => console.error("SiteLauncher launch error:", e));
});

chrome.runtime.onStartup.addListener(async () => {
  // Reset any leftover badge from a previous session.
  if (chrome.action) chrome.action.setBadgeText({ text: "" });
  const { settings } = await getSites();
  if (settings.openOnStartup) {
    openSites().catch((e) => console.error("SiteLauncher startup error:", e));
  }
});
