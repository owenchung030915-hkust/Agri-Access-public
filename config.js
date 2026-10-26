/**
 * Agri-Accept public frontend → private Render backend wiring.
 *
 * Public (Vercel): UI only
 * Private (Render): API + login + scoring  https://agri-accept-private.onrender.com
 */
(function () {
    var PRIVATE_API_DEFAULT = 'https://agri-accept-private.onrender.com';

    function normalizeBase(url) {
        if (!url) return '';
        return String(url).trim().replace(/\/$/, '');
    }

    function isRenderHost(hostname) {
        return String(hostname || '').indexOf('onrender.com') !== -1;
    }

    var params = new URLSearchParams(window.location.search || '');
    var fromQuery = normalizeBase(params.get('api') || '');
    var fromStorage = '';
    try {
        fromStorage = normalizeBase(localStorage.getItem('agri_api_base') || '');
    } catch (e) {
        fromStorage = '';
    }

    if (fromQuery) {
        try { localStorage.setItem('agri_api_base', fromQuery); } catch (e) { /* ignore */ }
    }

    var host = window.location.hostname || '';
    var defaultBase;
    if (isRenderHost(host)) {
        // Full-stack Render host: same origin
        defaultBase = normalizeBase(window.location.origin);
    } else {
        // Vercel / local static: call private Render API
        defaultBase = PRIVATE_API_DEFAULT;
    }

    var base = fromQuery || fromStorage || normalizeBase(window.AGRI_API_BASE) || defaultBase;

    // Drop stale localhost API bookmarks when browsing production sites
    try {
        if (!fromQuery && fromStorage && (isRenderHost(host) || host.indexOf('vercel.app') !== -1)) {
            if (fromStorage.indexOf('localhost') !== -1 || fromStorage.indexOf('127.0.0.1') !== -1) {
                localStorage.removeItem('agri_api_base');
                base = defaultBase;
            }
        }
    } catch (e) { /* ignore */ }

    window.AGRI_API_BASE = base;
    window.AGRI_PUBLIC_ORIGIN = normalizeBase(window.location.origin);

    window.agriApiUrl = function (path) {
        var p = String(path || '');
        if (!p.startsWith('/')) p = '/' + p;
        return window.AGRI_API_BASE + p;
    };

    window.agriGetAccessToken = function () {
        try { return localStorage.getItem('agri_access_token') || ''; } catch (e) { return ''; }
    };

    window.agriSetAccessToken = function (token) {
        try {
            if (token) localStorage.setItem('agri_access_token', token);
            else localStorage.removeItem('agri_access_token');
        } catch (e) { /* ignore */ }
    };

    window.agriAuthHeaders = function (extra) {
        var headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
        var token = window.agriGetAccessToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
        return headers;
    };

    console.log('Agri-Accept API base:', window.AGRI_API_BASE);
})();
