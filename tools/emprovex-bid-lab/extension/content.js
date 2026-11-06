// Match patterns cannot restrict ports; enforce exact lab origin and path.
if (location.origin === 'http://127.0.0.1:8790' && location.pathname === '/') {
  let attempts = 0;
  const ready = setInterval(() => {
    attempts++;
    if (attempts > 40) { clearInterval(ready); return; }
    try {
      const state = JSON.parse(document.getElementById('portal-state')?.textContent || '{}');
      if (state.portal !== 'local-simulator' || !document.querySelector('[data-emprovex-simulator="v1"]')) return;
      clearInterval(ready);
      import(chrome.runtime.getURL('panel.mjs')).then(m => m.mount()).catch(console.error);
    } catch { /* Wait for the local module to publish its first snapshot. */ }
  }, 100);
}
