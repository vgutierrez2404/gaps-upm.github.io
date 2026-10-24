(() => {
  const dialog = document.getElementById('poster-viewer');
  if (!dialog) return;
  const links = [...document.querySelectorAll('[data-poster]')];
  const templates = [...document.querySelectorAll('[data-poster-details]')];
  const image = document.getElementById('poster-full-image');
  const viewport = dialog.querySelector('.poster-viewport');
  const stage = dialog.querySelector('.poster-image-stage');
  const details = document.getElementById('poster-details');
  const label = document.getElementById('poster-zoom-label');
  const status = document.getElementById('poster-image-status');
  let index = 0;
  let zoom = 1;
  let fitWidth = 1;
  let fitHeight = 1;
  let trigger;
  let drag = null;
  let previousHash = '';
  let loaded = false;

  function renderZoom(anchor = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }) {
    const oldWidth = stage.offsetWidth;
    const oldHeight = stage.offsetHeight;
    const x = (viewport.scrollLeft + anchor.x) / oldWidth;
    const y = (viewport.scrollTop + anchor.y) / oldHeight;
    image.style.width = `${fitWidth * zoom}px`;
    image.style.height = `${fitHeight * zoom}px`;
    stage.style.width = `${fitWidth * zoom + 32}px`;
    stage.style.height = `${fitHeight * zoom + 32}px`;
    viewport.scrollLeft = x * stage.offsetWidth - anchor.x;
    viewport.scrollTop = y * stage.offsetHeight - anchor.y;
    label.textContent = `${Math.round(zoom * 100)}%`;
    dialog.querySelector('[data-action="out"]').disabled = !loaded || zoom <= 1;
    dialog.querySelector('[data-action="in"]').disabled = !loaded || zoom >= 6;
  }
  function fit() {
    if (!loaded || !dialog.open) return;
    const ratio = Math.min((viewport.clientWidth - 34) / image.naturalWidth, (viewport.clientHeight - 34) / image.naturalHeight);
    fitWidth = Math.max(1, image.naturalWidth * ratio);
    fitHeight = Math.max(1, image.naturalHeight * ratio);
    zoom = 1;
    renderZoom();
    viewport.scrollTo(0, 0);
  }
  function changeZoom(factor, anchor) {
    if (!loaded) return;
    zoom = Math.max(1, Math.min(6, zoom * factor));
    renderZoom(anchor);
  }
  function show(nextIndex) {
    index = (nextIndex + links.length) % links.length;
    const link = links[index];
    details.replaceChildren(templates[index].content.cloneNode(true));
    details.scrollTop = 0;
    document.getElementById('poster-position').textContent = `${index + 1} / ${links.length}`;
    loaded = false;
    image.hidden = true;
    zoom = 1;
    renderZoom();
    status.textContent = 'Loading poster…';
    image.alt = link.querySelector('img').alt;
    image.src = link.href;
    history.replaceState(null, '', `#${encodeURIComponent(link.dataset.poster)}`);
  }
  image.addEventListener('load', () => {
    loaded = true;
    image.hidden = false;
    status.textContent = '';
    fit();
  });
  image.addEventListener('error', () => { status.textContent = 'The poster could not be loaded. Try the Original poster link.'; });
  function open(nextIndex, source) {
    trigger = source;
    previousHash = location.hash;
    dialog.showModal();
    show(nextIndex);
    dialog.querySelector('[data-action="close"]').focus();
  }
  links.forEach((link, i) => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(i, link);
  }));
  dialog.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') dialog.close();
    if (action === 'previous') show(index - 1);
    if (action === 'next') show(index + 1);
    if (action === 'in') changeZoom(1.5);
    if (action === 'out') changeZoom(1 / 1.5);
    if (action === 'fit') fit();
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    history.replaceState(null, '', `${location.pathname}${location.search}${previousHash}`);
    trigger?.focus({ preventScroll: true });
  });
  dialog.addEventListener('keydown', event => {
    if (event.target === viewport) {
      if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(1.5); }
      if (event.key === '-') { event.preventDefault(); changeZoom(1 / 1.5); }
      if (event.key === '0') { event.preventDefault(); fit(); }
    }
  });
  viewport.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    changeZoom(Math.exp(-event.deltaY * .01), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, { passive: false });
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', event => {
    if (!drag) return;
    viewport.scrollLeft = drag.left - event.clientX + drag.x;
    viewport.scrollTop = drag.top - event.clientY + drag.y;
  });
  const endDrag = () => { drag = null; viewport.classList.remove('is-dragging'); };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('lostpointercapture', endDrag);
  new ResizeObserver(() => { if (dialog.open) fit(); }).observe(viewport);
  const initial = links.findIndex(link => `#${encodeURIComponent(link.dataset.poster)}` === location.hash);
  if (initial >= 0) { previousHash = ''; open(initial, links[initial]); previousHash = ''; }
})();
