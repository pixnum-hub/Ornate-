// ═══════════════════════════════════════════════════════════
// ORNATE PWA Registration v3.0
// © Manik Roy 2026. All Rights Reserved.
// Place: <script src="pwa-register.js" defer></script> before </body>
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Skip on preview/sandbox/localhost — only register on real HTTPS
  const _skipHosts = ['claudeusercontent.com', 'claude.ai', 'localhost', '127.0.0.1'];
  const _canSW = 'serviceWorker' in navigator &&
    !_skipHosts.some(h => location.hostname.includes(h)) &&
    location.protocol === 'https:';

  if (_canSW) {
    window.addEventListener('load', () => {

      // ── Register SW ──────────────────────────────────────
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .then(reg => {
          console.log('[ORNATE] SW v3 registered:', reg.scope);
          if ('sync' in reg) reg.sync.register('price-refresh').catch(() => {});
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            nw && nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) _showUpdateToast();
            });
          });
        })
        .catch(e => console.warn('[ORNATE] SW failed:', e));

      // ── Handle SW messages ────────────────────────────────
      navigator.serviceWorker.addEventListener('message', ({ data }) => {
        if (!data) return;
        if (data.type === 'INR_RATE' && typeof INR_RATE !== 'undefined') {
          INR_RATE = data.rate;
          _refreshPrices();
        }
        if (data.type === 'SPOT_RATES' && typeof SPOT !== 'undefined' && data.rates) {
          const r = data.rates;
          const troy = 31.1035;
          if (r.XAU) SPOT.gold      = parseFloat((1 / r.XAU).toFixed(2));
          if (r.XAG) SPOT.silver    = parseFloat((1 / r.XAG).toFixed(2));
          if (r.XPT) SPOT.platinum  = parseFloat((1 / r.XPT).toFixed(2));
          if (r.XPD) SPOT.palladium = parseFloat((1 / r.XPD).toFixed(2));
          _refreshPrices();
        }
      });
    });
  }

  function _refreshPrices() {
    if (typeof renderMetalPriceTable === 'function') renderMetalPriceTable();
    if (typeof renderGemPrices === 'function') renderGemPrices();
  }

  // ── Add-to-Home-Screen banner ─────────────────────────────
  let _prompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _prompt = e;
    setTimeout(() => { if (_prompt) _showInstallBanner(); }, 4000);
  });

  window.addEventListener('appinstalled', () => {
    console.log('[ORNATE] PWA installed');
    _dismissBanner('_ornate_install');
    _prompt = null;
  });

  function _showInstallBanner() {
    if (document.getElementById('_ornate_install')) return;
    const b = document.createElement('div');
    b.id = '_ornate_install';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Install ORNATE');
    b.style.cssText = _bannerStyle();
    b.innerHTML = `
      <span style="font-size:1.6rem;line-height:1;flex-shrink:0">💎</span>
      <div style="flex:1;min-width:0">
        <div style="color:var(--accent,#d4af37);font-size:.78rem;font-weight:700;letter-spacing:.04em">Install ORNATE</div>
        <div style="color:var(--text3,#8a7a60);font-size:.68rem;margin-top:2px">Offline access · Add to home screen</div>
      </div>
      <button onclick="window._ornateInstall()" style="${_btnStyle('var(--accent,#d4af37)','#1a1410')}">Add</button>
      <button onclick="window._ornateDismissInstall()" aria-label="Dismiss" style="background:transparent;border:none;color:var(--text3,#8a7a60);cursor:pointer;font-size:1.2rem;padding:2px 6px;line-height:1">✕</button>`;
    document.body.appendChild(b);
    _injectSlideKF();
  }

  window._ornateInstall = function () {
    if (!_prompt) return;
    _prompt.prompt();
    _prompt.userChoice.then(() => { _prompt = null; _dismissBanner('_ornate_install'); });
  };
  window._ornateDismissInstall = function () { _dismissBanner('_ornate_install'); _prompt = null; };

  // ── Update toast ──────────────────────────────────────────
  function _showUpdateToast() {
    if (document.getElementById('_ornate_update')) return;
    const t = document.createElement('div');
    t.id = '_ornate_update';
    t.style.cssText = [
      'position:fixed','top:12px','left:50%','transform:translateX(-50%)',
      'background:var(--surface,#2e261c)','border:1px solid var(--border,#4a3f2f)',
      'border-radius:999px','padding:8px 16px',
      'display:flex','align-items:center','gap:10px',
      'z-index:9999','font-family:Inter,system-ui,sans-serif',
      'box-shadow:0 4px 16px rgba(0,0,0,.4)','white-space:nowrap',
    ].join(';');
    t.innerHTML = `
      <span style="font-size:.78rem;color:var(--text2,#c8b898)">✦ App updated</span>
      <button onclick="location.reload()" style="${_btnStyle('var(--accent,#d4af37)','#1a1410')}">Reload</button>
      <button onclick="document.getElementById('_ornate_update').remove()" style="background:transparent;border:none;color:var(--text3,#8a7a60);cursor:pointer;font-size:1rem;padding:2px">✕</button>`;
    document.body.appendChild(t);
    setTimeout(() => { t.parentNode && t.remove(); }, 10000);
  }

  // ── Online / offline indicator ────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const meta = document.getElementById('metalPriceTime');
    if (!meta) return;
    const dot = document.createElement('span');
    dot.id = '_ornate_net';
    dot.style.cssText = 'font-size:.58rem;margin-left:8px;font-family:Inter,sans-serif;transition:color .3s;';
    meta.parentElement && meta.parentElement.appendChild(dot);
    _updateNetDot();
  });

  function _updateNetDot() {
    const dot = document.getElementById('_ornate_net');
    if (!dot) return;
    dot.textContent = navigator.onLine ? '● Online' : '○ Offline';
    dot.style.color = navigator.onLine ? 'var(--up,#3aaa5a)' : 'var(--down,#cc4040)';
  }
  window.addEventListener('online',  _updateNetDot);
  window.addEventListener('offline', _updateNetDot);

  // ── Helpers ───────────────────────────────────────────────
  function _bannerStyle() {
    return [
      'position:fixed','bottom:16px','left:50%','transform:translateX(-50%) translateY(0)',
      'background:var(--surface,#2e261c)','border:1.5px solid var(--accent,#d4af37)',
      'border-radius:14px','padding:12px 14px',
      'display:flex','align-items:center','gap:11px',
      'z-index:9999','max-width:340px','width:calc(100% - 28px)',
      'box-shadow:0 6px 28px rgba(0,0,0,.55)',
      'font-family:Inter,system-ui,sans-serif',
      'animation:_ornate_slide .35s cubic-bezier(.4,0,.2,1)',
    ].join(';');
  }

  function _btnStyle(bg, color) {
    return `background:${bg};color:${color};border:none;border-radius:8px;padding:7px 14px;font-size:.7rem;font-weight:700;cursor:pointer;letter-spacing:.06em;text-transform:uppercase;flex-shrink:0;white-space:nowrap;font-family:Inter,sans-serif`;
  }

  function _dismissBanner(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s';
    setTimeout(() => el.remove(), 220);
  }

  function _injectSlideKF() {
    if (document.getElementById('_ornate_kf')) return;
    const s = document.createElement('style');
    s.id = '_ornate_kf';
    s.textContent = '@keyframes _ornate_slide{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
  }

})();
