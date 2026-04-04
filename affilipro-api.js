// ============================================================
// affilipro-api.js  —  Letakkan file ini di folder GitHub Pages
// Hubungkan ke index.html dengan: <script src="affilipro-api.js"></script>
// ============================================================

const AffiliAPI = (() => {
  // ── GANTI dengan URL Web App setelah deploy Google Apps Script ──
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbyHHSTMGvd6Y0uZeHOgglUlHiApB9vQ4SKRwhUtik4y-OZhTZORQVkLWzy6wLNyIdvTRQ/exec';

  // ── UTM / referrer tracking ─────────────────────────────────────
  const _getRefPlatform = () => {
    const ref = document.referrer.toLowerCase();
    if (ref.includes('instagram'))  return 'instagram';
    if (ref.includes('tiktok'))     return 'tiktok';
    if (ref.includes('youtube'))    return 'youtube';
    if (ref.includes('facebook'))   return 'facebook';
    const utm = new URLSearchParams(window.location.search).get('utm_source') || '';
    return utm || 'direct';
  };

  // ── Fetch helper ────────────────────────────────────────────────
  const _get = async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}?${qs}`);
    return res.json();
  };

  const _post = async (body = {}) => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════

  /** Ambil daftar produk dengan filter/sort/paginasi */
  const getProducts = (opts = {}) =>
    _get({ action: 'getProducts', ...opts });

  /** Ambil data summary (stat cards dashboard) */
  const getSummary = () => _get({ action: 'getSummary' });

  /** Ambil klik per platform & per produk */
  const getClicks = () => _get({ action: 'getClicks' });

  /** Ambil trending produk hari ini */
  const getTrending = () => _get({ action: 'getTrending' });

  /** Ambil daftar kategori */
  const getCategories = () => _get({ action: 'getCategories' });

  /**
   * Catat klik affiliate — panggil ini SEBELUM redirect ke link Shopee
   * @param {string} productId  — id produk di Google Sheet
   * @param {string} affiliateLink — URL shopee affiliate tujuan
   */
  const trackClick = async (productId, affiliateLink) => {
    await _post({
      action:     'recordClick',
      product_id: productId,
      platform:   _getRefPlatform(),
      source_url: document.referrer || document.location.href,
      user_agent: navigator.userAgent,
      ref_code:   new URLSearchParams(window.location.search).get('ref') || '',
    });
    window.open(affiliateLink, '_blank');
  };

  /** Tambah produk baru (admin) */
  const addProduct = (data) => _post({ action: 'addProduct', ...data });

  /** Update produk (admin) */
  const updateProduct = (data) => _post({ action: 'updateProduct', ...data });

  return { getProducts, getSummary, getClicks, getTrending, getCategories, trackClick, addProduct, updateProduct };
})();


// ══════════════════════════════════════════════════════════════
// SOCIAL MEDIA CLICK TRACKER — UTM Auto-inject
// Saat visitor datang via sosmed, UTM parameter otomatis terbaca
// ══════════════════════════════════════════════════════════════
(function initSocialTracker() {
  const params   = new URLSearchParams(window.location.search);
  const utmSrc   = params.get('utm_source')   || '';
  const utmMed   = params.get('utm_medium')   || '';
  const utmCamp  = params.get('utm_campaign') || '';
  const productId= params.get('pid')          || '';

  // Jika datang dengan utm_source & pid → langsung catat klik
  if (utmSrc && productId) {
    fetch(
      // Gunakan BASE_URL dari AffiliAPI (diakses setelah script dimuat)
      document.querySelector('script[src*="affilipro-api"]')
        ? '' // akan dihandle oleh AffiliAPI.trackClick
        : '',
    );
    // Catat saat halaman products dimuat
    window._pendingTrack = { utm_source: utmSrc, utm_medium: utmMed, utm_campaign: utmCamp, pid: productId };
  }
})();


// ══════════════════════════════════════════════════════════════
// DASHBOARD LOADER — inject data ke index.html (Overview page)
// Panggil initDashboard() di script utama index.html
// ══════════════════════════════════════════════════════════════
async function initDashboard() {
  try {
    const [summary, clicks, trending] = await Promise.all([
      AffiliAPI.getSummary(),
      AffiliAPI.getClicks(),
      AffiliAPI.getTrending(),
    ]);

    // ── Stat cards ──────────────────────────────────────────────
    _setText('#stat-total-products',  _fmt(summary.total_products?.value));
    _setText('#stat-total-sales',     'Rp ' + _fmtRp(summary.total_sales?.value));
    _setText('#stat-total-clicks',    _fmt(summary.total_clicks?.value));
    _setText('#stat-cvr',             summary.cvr?.value + '%');

    _setTrend('#trend-products',  summary.total_products?.change_pct);
    _setTrend('#trend-sales',     summary.total_sales?.change_pct);
    _setTrend('#trend-clicks',    summary.total_clicks?.change_pct);
    _setTrend('#trend-cvr',       summary.cvr?.change_pct);

    // ── Social media klik ────────────────────────────────────────
    const bp = clicks.byPlatform || {};
    const total = Object.values(bp).reduce((a, b) => a + b, 0) || 1;
    _setClickBar('instagram', bp.instagram || 0, total);
    _setClickBar('tiktok',    bp.tiktok    || 0, total);
    _setClickBar('youtube',   bp.youtube   || 0, total);

    // ── Trending ─────────────────────────────────────────────────
    const tList = document.getElementById('trending-list');
    if (tList && trending.trending) {
      tList.innerHTML = trending.trending.slice(0,5).map((t, i) => `
        <div class="trend-item">
          <div class="trend-rank ${i < 3 ? 'top' : ''}">${i+1}</div>
          <div class="trend-info">
            <div class="trend-name">${_esc(t.name)}</div>
            <div class="trend-num">${_fmt(t.clicks_today)} klik hari ini</div>
          </div>
          ${i < 2 ? '<span class="fire">🔥</span>' : ''}
        </div>`).join('');
    }

  } catch (err) {
    console.warn('[AffiliPro] Dashboard data error:', err);
  }
}

// ── Helpers tampilan ────────────────────────────────────────────
function _setText(sel, val) {
  const el = document.querySelector(sel);
  if (el && val !== undefined && val !== null) el.textContent = val;
}
function _setTrend(sel, pct) {
  const el = document.querySelector(sel);
  if (!el) return;
  const n = parseFloat(pct) || 0;
  el.textContent = (n >= 0 ? '↑ ' : '↓ ') + Math.abs(n) + '%';
  el.className = 'stat-trend-val ' + (n >= 0 ? 'up' : 'down');
}
function _setClickBar(platform, count, total) {
  const valEl  = document.querySelector(`#social-${platform}-val`);
  const barEl  = document.querySelector(`#social-${platform}-bar`);
  if (valEl) valEl.textContent = _fmt(count);
  if (barEl) barEl.style.width = Math.round((count / total) * 100) + '%';
}
function _fmt(n) {
  if (n === undefined || n === null || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return n;
  if (num >= 1000000) return (num/1000000).toFixed(1) + 'jt';
  if (num >= 1000)    return (num/1000).toFixed(1) + 'rb';
  return num.toLocaleString('id-ID');
}
function _fmtRp(n) {
  const num = parseFloat(n) || 0;
  if (num >= 1000000) return (num/1000000).toFixed(1) + ' jt';
  if (num >= 1000)    return (num/1000).toFixed(0) + ' rb';
  return num.toLocaleString('id-ID');
}
function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
