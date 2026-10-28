# SiteLauncher

One click on the pinned toolbar icon instantly opens every website you use every day.
No popup, no second click. You choose the sites yourself — nothing is pre-filled.

Manifest V3 · Chrome + Brave · no frameworks, no build step, no external CDN.

## Install (Load unpacked)

1. Open `chrome://extensions` (or `brave://extensions`).
2. Toggle **Developer mode** on.
3. Click **Load unpacked** and select this folder (`SiteLauncher`).
4. Pin the extension icon to the toolbar.
5. Right-click the icon → **Options** and add your sites.

## Usage

- **Click the pinned icon** → all enabled sites open at once (in a new or same window, grouped or not, skipping already-open sites as configured).
- A small green badge with the number of opened sites flashes for 2 seconds.
- **First run** (no sites yet) → clicking the icon opens the settings page with the message *"No sites added yet. Add your first site."*

## Settings (Options page)

- Add a site by name + URL (`gmail.com` is auto-prefixed to `https://gmail.com`).
- Edit, delete, reorder (drag the handle), and toggle each site on/off.
- **Open on browser startup** — launch sites automatically at browser start.
- **Open in** — new window or same window.
- **Group tabs together** — put the opened tabs into one tab group.
- **Skip sites already open** — don’t reopen a site that’s in a tab.

## File structure

```
SiteLauncher/
├── manifest.json        # MV3 manifest (no default_popup)
├── background.js        # service worker: icon click, startup launch, badge
├── options.html         # settings page
├── options.css          # dark-green glassmorphism styles
├── options.js           # settings page logic (add/edit/delete/reorder/toggle)
├── icons/
│   ├── icon.svg         # vector source
│   ├── icon16.png       # toolbar
│   ├── icon48.png       # extensions page / favicon
│   └── icon128.png      # store / details
└── tools/
    └── generate-icons.sh  # regenerates the PNGs from icon.svg
```

## Storage

`chrome.storage.sync` only. Two keys, both empty/absent by default:

- `sites`: `[{ id, name, url, enabled }]`
- `settings`: `{ openOnStartup, windowMode, groupTabs, skipOpen }`

## Permissions

Minimal and purposeful: `storage` (your sites/settings), `tabs` (read open tabs for “skip already open” + create tabs), and `windows` (required to open a **new window**). No host permissions, no content scripts, no tracking.

## Regenerate icons

```
bash tools/generate-icons.sh
```

Requires ImageMagick (`convert`). Produces `icons/icon{16,48,128}.png` from `icons/icon.svg`.
