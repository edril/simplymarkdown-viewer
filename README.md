# SimplyMarkdown Viewer

A no-fuss Markdown editor. Open, create, and edit `.md` files with a
clean rendered preview, and save your changes back to disk.

## Run it on your Mac

```sh
npm install
npm run web
```

This opens the app at `http://localhost:8081` in your browser (use
Chrome/Edge/Brave for full save support — see Notes below). **New**
starts a blank document, **Open…** picks an existing `.md` file,
**Edit** shows the raw source to write in, **Preview** renders it, and
**Save** (or Cmd/Ctrl+S) writes it back to disk. A dot next to the
filename means there are unsaved changes; closing the tab or switching
documents with unsaved changes prompts you first.

Tip: use your browser's "Add to Dock" / "Install as app" option to give it
its own window without browser chrome.

## Native Mac app

A real double-clickable `.app` (and `.dmg`) lives in `electron/`. It wraps
the same Expo web build in a small Electron shell — no UI rewrite, one
codebase.

```sh
cd electron
npm install
npm run dist:mac
```

This exports the Expo web bundle, packages it into `SimplyMarkdown
Viewer.app`, ad-hoc signs it (required on Apple Silicon even for
local/unsigned apps — see `sign-adhoc.js` and `entitlements.plist`), and
builds a `.dmg`. Find the results in `electron/release/`:

- `mac-arm64/SimplyMarkdown Viewer.app` — double-click to run directly
- `SimplyMarkdown Viewer.dmg` — mount and drag to Applications

Since it isn't signed with a paid Apple Developer ID, the first launch
will trigger a Gatekeeper warning ("cannot be opened because the developer
cannot be verified"). Right-click the app → **Open** the first time to
bypass this — only needed once.

If you have an older build of the app already open, quit it first before
launching a freshly built one — running two copies at once is fine (each
picks its own local port automatically), but it's easy to lose track of
which window is the old version.

For day-to-day development instead of a full rebuild, `cd electron && npm
run dev` builds the web bundle and launches Electron directly.

## Browser extension

A Chrome/Edge/Brave extension lives in `extension/` — it auto-renders any
`.md` file you open directly in the browser (local `file://` or a raw
`http(s)` URL), in place, with a Preview/Raw toggle (view-only, no
save/edit — see its own README). It's a separate lightweight
implementation (vanilla JS + `marked` + `DOMPurify`), not the Expo
codebase, since content scripts need to stay small and can't pull in a
React Native runtime. See [`extension/README.md`](extension/README.md)
for how to load it.

## Android (next)

Same codebase, no rewrite needed: `npx expo run:android` locally, or `eas
build -p android` for a real APK/AAB. Opening/creating files uses the
system document picker; saving writes to the picked file when possible,
or into the app's own storage and hands it to you via the share sheet
otherwise (Android's stricter file permissions make true "save back to
any picked location" more involved — this is the one area not yet fully
proven out, since it hasn't been tested on a real device/emulator yet).

## Notes

- Full save-in-place (Save writes straight back to the exact file you
  opened, like a desktop editor) needs the browser's File System Access
  API — supported in Chrome, Edge, Brave, and the Electron app (same
  Chromium engine). In Safari/Firefox, or as a fallback, Save instead
  downloads the file as a new download rather than overwriting in place.
- A brand new, unsaved document is not persisted anywhere until you hit
  Save — same as any editor.
