# SimplyMarkdown Viewer

A no-fuss Markdown viewer. Open a `.md` file, read it in a clean rendered
preview, or flip to the raw source view.

## Run it on your Mac

```sh
npm install
npm run web
```

This opens the app at `http://localhost:8081` in your browser. Click
**Open…**, pick a `.md` file, and it renders instantly. Click **Raw** to
see the unrendered source, **Preview** to go back.

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

For day-to-day development instead of a full rebuild, `cd electron && npm
run dev` builds the web bundle and launches Electron directly.

## Android (next)

Same codebase, no rewrite needed: `npx expo run:android` locally, or `eas
build -p android` for a real APK/AAB.

## Notes

- Changes made in Raw mode are in-memory only (not saved back to the
  original file) — this keeps file permissions simple across web,
  Android, and iOS. Reopen the file to discard changes.
