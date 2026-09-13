(function () {
  if (window.__simplyMarkdownViewerRan) return;
  window.__simplyMarkdownViewerRan = true;

  const contentType = (document.contentType || '').toLowerCase();
  const isRawText =
    contentType.startsWith('text/plain') ||
    contentType === 'text/markdown' ||
    contentType === 'application/octet-stream';

  // Don't touch pages that already have their own rendering (e.g. GitHub's
  // blob view, which also ends in .md but serves a full HTML document).
  if (!isRawText) return;

  const pre = document.querySelector('body > pre');
  const raw = pre ? pre.textContent : document.body ? document.body.textContent : null;
  if (raw == null) return;

  const fileName = decodeURIComponent(
    location.pathname.split('/').filter(Boolean).pop() || location.href
  );

  document.title = fileName;

  const root = document.createElement('div');
  root.id = 'smv-root';

  const header = document.createElement('div');
  header.id = 'smv-header';

  const nameEl = document.createElement('span');
  nameEl.id = 'smv-filename';
  nameEl.textContent = fileName;

  const toggle = document.createElement('span');
  toggle.id = 'smv-toggle';

  const previewBtn = document.createElement('button');
  previewBtn.id = 'smv-btn-preview';
  previewBtn.className = 'smv-seg active';
  previewBtn.type = 'button';
  previewBtn.textContent = 'Preview';

  const rawBtn = document.createElement('button');
  rawBtn.id = 'smv-btn-raw';
  rawBtn.className = 'smv-seg';
  rawBtn.type = 'button';
  rawBtn.textContent = 'Raw';

  toggle.appendChild(previewBtn);
  toggle.appendChild(rawBtn);
  header.appendChild(nameEl);
  header.appendChild(toggle);

  const body = document.createElement('div');
  body.id = 'smv-body';

  const previewEl = document.createElement('div');
  previewEl.id = 'smv-preview';
  const html = marked.parse(raw, { gfm: true, breaks: false });
  previewEl.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });

  previewEl.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('rel', 'noopener noreferrer');
  });

  const rawEl = document.createElement('pre');
  rawEl.id = 'smv-raw';
  rawEl.textContent = raw;
  rawEl.hidden = true;

  body.appendChild(previewEl);
  body.appendChild(rawEl);
  root.appendChild(header);
  root.appendChild(body);

  document.body.textContent = '';
  document.body.appendChild(root);

  previewBtn.addEventListener('click', () => {
    previewEl.hidden = false;
    rawEl.hidden = true;
    previewBtn.classList.add('active');
    rawBtn.classList.remove('active');
  });
  rawBtn.addEventListener('click', () => {
    previewEl.hidden = true;
    rawEl.hidden = false;
    rawBtn.classList.add('active');
    previewBtn.classList.remove('active');
  });
})();
