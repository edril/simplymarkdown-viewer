# SimplyMarkdown Viewer — browser extension

Renders `.md`/`.markdown` files opened directly in the browser (local
`file://` paths or a raw `http(s)` URL) as a clean page instead of raw
text, with a Preview/Raw toggle. Works in Chrome, Edge, Brave, and other
Chromium-based browsers.

It only touches pages the browser would otherwise show as plain text —
if a `.md` URL is already a fully rendered page (like GitHub's blob
view), the extension leaves it alone.

## Install (unpacked, for personal use)

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click **Details** on the extension and turn on **Allow access to file
   URLs** — Chrome hides this permission behind a manual toggle for every
   extension, there's no way around it. Skip this if you only care about
   viewing `.md` files served over `http(s)`.

## Try it

Open any local `.md` file directly in the browser (drag it into a tab,
or `open -a "Google Chrome" yourfile.md` from the terminal) and it should
render immediately.

## Notes

- Bundles [`marked`](https://github.com/markedjs/marked) for Markdown
  parsing and [`DOMPurify`](https://github.com/cure53/DOMPurify) to
  sanitize the output before it's injected into the page — required
  since this renders arbitrary local/remote content as HTML.
- Not published to the Chrome Web Store (that needs a paid developer
  account and store review) — this is meant to be loaded unpacked like
  above.
