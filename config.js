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

    // Drop stale / wrong API bookmarks when browsing production sites
    try {
        if (!fromQuery && fromStorage && (isRenderHost(host) || host.indexOf('vercel.app') !== -1)) {
            var bad =
                fromStorage.indexOf('localhost') !== -1 ||
                fromStorage.indexOf('127.0.0.1') !== -1 ||
                fromStorage.indexOf('vercel.app') !== -1 ||
                fromStorage === normalizeBase(window.location.origin);
            if (bad) {
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

    /** Build /api/proxy-image URL; append access_token for hosts that still gate the proxy. */
    window.agriProxyImageUrl = function (imageUrl) {
        var base = window.agriApiUrl('/api/proxy-image') + '?url=' + encodeURIComponent(imageUrl || '');
        var token = window.agriGetAccessToken();
        if (token) base += '&access_token=' + encodeURIComponent(token);
        return base;
    };

    console.log('Agri-Accept API base:', window.AGRI_API_BASE);
})();
