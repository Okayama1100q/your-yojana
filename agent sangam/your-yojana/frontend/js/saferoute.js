// =============================================================
// saferoute.js — SafeRoute UI
// Reuses Leaflet + OSM tiles + Nominatim cache from Civic Map.
// Does NOT load civic-map.js (that page stays unchanged).
// Routing: public OSRM.
// Civic data: synthetic demonstration dataset via SafeRouteData.
//   The live database (GET /complaints) is read only for a status
//   line — SafeRoute never writes to it and never mixes the two.
// =============================================================

const SR_MAP_CENTER = [20.5937, 78.9629];
const SR_MAP_ZOOM = 5;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REV = 'https://nominatim.openstreetmap.org/reverse';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const CACHE_PREFIX = 'yymap_geo_'; // shared with Civic Map session cache
const GEOCODE_DELAY = 1100;

const PRIORITY_COLORS = {
    CRITICAL: '#DC2626',
    HIGH:     '#EA580C',
    MEDIUM:   '#D97706',
    LOW:      '#16A34A',
};

const ROUTE_MUTED = '#94A3B8';
const ROUTE_REC = '#15803d';
const ROUTE_SELECTED = '#2563EB';

const MAX_COMPLAINT_MARKERS = 500;

const state = {
    map: null,
    routesLayer: null,
    markersLayer: null,
    hotspotLayer: null,
    startMarker: null,
    destMarker: null,
    polylines: {},
    liveComplaintCount: null,
    dataset: { loaded: false, count: 0, error: null, source: null },
    coverage: { total: 0, withCoords: 0, missingCoords: 0, preciseGeoAvailable: false },
    routes: [],
    hotspots: [],
    recommendedId: null,
    selectedId: null,
    preference: 'BALANCED',
    agentInput: null,
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        initMap();
        bindUi();
        loadCivicData();
    } catch (err) {
        setOverlay('Map failed to initialise.', err.message, false);
        setStatus('error', err.message);
    }
});

function initMap() {
    if (typeof L === 'undefined') throw new Error('Leaflet library did not load.');

    state.map = L.map('saferouteMap', {
        center: SR_MAP_CENTER,
        zoom: SR_MAP_ZOOM,
        zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(state.map);

    state.routesLayer = L.layerGroup().addTo(state.map);
    state.markersLayer = L.layerGroup().addTo(state.map);
    state.hotspotLayer = L.layerGroup().addTo(state.map);
}

function bindUi() {
    document.getElementById('srSearchForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await findRoutes();
    });

    document.getElementById('srUseLocation').addEventListener('click', useMyLocation);

    document.querySelectorAll('.sr-pref').forEach(btn => {
        btn.addEventListener('click', () => {
            state.preference = btn.dataset.pref;
            document.querySelectorAll('.sr-pref').forEach(b => b.classList.toggle('is-active', b === btn));
            if (state.routes.length) applyRecommendation();
        });
    });
}

/**
 * Loads the synthetic dataset once. A failure here must never stop the
 * page from comparing travel time and distance.
 */
async function loadCivicData() {
    setStatus('loading', 'Loading synthetic civic demonstration data…');

    try {
        state.dataset = await SafeRouteData.load();
    } catch (err) {
        state.dataset = { loaded: false, count: 0, error: err.message, source: null };
    }

    state.coverage = state.dataset.loaded
        ? SafeRouteData.coverage()
        : { total: 0, withCoords: 0, missingCoords: 0, preciseGeoAvailable: false, synthetic: true };

    updateGeoNotice();
    updateDemoBadge();

    if (state.dataset.loaded) {
        setStatus('done', `${state.dataset.count.toLocaleString()} synthetic civic records ready for route analysis.`);
    } else {
        setStatus('error', 'Civic demonstration data unavailable. Routes, travel time and distance still work.');
    }

    // Read-only status check against the live database. SafeRoute does not
    // score with these records and never writes to them.
    try {
        const data = await api.getComplaints();
        state.liveComplaintCount = (data.complaints || []).length;
    } catch (_) {
        state.liveComplaintCount = null;
    }
    updateGeoNotice();
}

function updateDemoBadge() {
    const el = document.getElementById('srDemoBadge');
    if (!el) return;
    el.textContent = state.dataset.loaded
        ? 'Demo Mode: Civic indicators are based on synthetic Chennai complaint data.'
        : 'Demo Mode: Civic demonstration data unavailable.';
    el.hidden = false;
}

function updateGeoNotice() {
    const el = document.getElementById('srGeoNotice');
    if (!el) return;

    const live = state.liveComplaintCount == null
        ? ''
        : ` Your live Your Yojana database (${state.liveComplaintCount} record${state.liveComplaintCount === 1 ? '' : 's'}) is untouched and is not scored here.`;

    if (state.dataset.loaded) {
        el.hidden = false;
        el.className = 'sr-notice sr-notice--info';
        el.textContent = `Civic indicators use ${state.dataset.count.toLocaleString()} synthetic Chennai demonstration records with coordinates`
            + `${state.dataset.skipped ? `, ${state.dataset.skipped} malformed row(s) skipped` : ''}.`
            + ' These are generated records, not real government complaints.'
            + live;
    } else {
        el.hidden = false;
        el.className = 'sr-notice sr-notice--warn';
        el.textContent = `Civic demonstration data unavailable. ${state.dataset.error || ''} Routes, travel time and distance are still compared; civic indicators show as unavailable.`.trim() + live;
    }
}

async function findRoutes() {
    const startQ = document.getElementById('srStart').value.trim();
    const destQ = document.getElementById('srDest').value.trim();
    if (!startQ || !destQ) return;

    const btn = document.getElementById('srFindBtn');
    btn.disabled = true;

    try {
        showOverlayLoading('Finding route alternatives…');
        setStatus('loading', 'Geocoding start and destination…');

        const start = await geocodeLocation(startQ);
        await sleep(GEOCODE_DELAY);
        const dest = await geocodeLocation(destQ);

        if (!start || !dest) {
            setOverlay(
                'Could not locate start or destination.',
                'Try a more specific place name. No routes were invented.',
                false
            );
            setStatus('error', 'Geocoding failed for start or destination.');
            return;
        }

        placeEndpointMarkers(start, dest);

        setStatus('loading', 'Requesting all available route alternatives…');
        const osrm = await fetchOsrm(start, dest);
        if (!osrm.length) {
            setOverlay('No routes returned.', 'The routing provider did not return alternatives for this pair.', false);
            setStatus('error', 'Routing data unavailable.');
            return;
        }

        const rawRoutes = osrm.map((r, i) => ({
            id: `route-${i}`,
            label: `Route ${String.fromCharCode(65 + i)}`,
            durationSeconds: r.duration,
            distanceMeters: r.distance,
            coordinates: r.geometry?.coordinates || [],
        }));

        setStatus('loading', 'Matching synthetic civic reports to each route…');
        const packed = SafeRouteEngine.attachAnalyses(rawRoutes, {
            coverage: state.coverage,
            // Grid pre-filter: only records near this route's real geometry
            // are considered, never the full dataset.
            candidateProvider: route => SafeRouteData.candidatesNearRoute(
                route.coordinates,
                SafeRouteEngine.CORRIDOR_METERS
            ),
        });
        state.routes = packed.routes;
        state.coverage = packed.coverage;
        state.hotspots = packed.hotspots;
        state.agentInput = SafeRouteEngine.buildAgentInput(state.routes, state.coverage, state.preference);
        window.__SAFEROUTE_AGENT_INPUT__ = state.agentInput;

        hideOverlay();
        drawRoutes();
        drawComplaintPins();
        drawHotspots();
        fitMap();
        applyRecommendation();
        updateGeoNotice();
        setStatus('done', state.dataset.loaded
            ? `${state.routes.length} route alternative(s) shown with synthetic civic indicators. You choose the route.`
            : `${state.routes.length} route alternative(s) shown. Civic demonstration data unavailable.`);
    } catch (err) {
        setOverlay('Unable to compare routes.', err.message || 'Data unavailable.', false);
        setStatus('error', err.message || 'Data unavailable.');
    } finally {
        btn.disabled = false;
    }
}

async function fetchOsrm(start, dest) {
    const coords = `${start.lng},${start.lat};${dest.lng},${dest.lat}`;
    const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&alternatives=3&steps=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing data unavailable.');
    const json = await res.json();
    if (!json.routes || !json.routes.length) return [];
    return json.routes;
}

async function geocodeLocation(locationStr) {
    const cacheKey = CACHE_PREFIX + locationStr.toLowerCase().trim();
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        try { return JSON.parse(cached); } catch (_) {}
    }

    const params = new URLSearchParams({
        q: locationStr + ', India',
        format: 'json',
        limit: '1',
        'accept-language': 'en',
    });

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'User-Agent': 'YourYojana/1.0 CivicPlatform' },
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!results || !results.length) return null;

    const coords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    try { sessionStorage.setItem(cacheKey, JSON.stringify(coords)); } catch (_) {}
    return coords;
}

async function reverseGeocode(lat, lng) {
    const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        'accept-language': 'en',
    });
    const res = await fetch(`${NOMINATIM_REV}?${params}`, {
        headers: { 'User-Agent': 'YourYojana/1.0 CivicPlatform' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.display_name || null;
}

function useMyLocation() {
    if (!navigator.geolocation) {
        setStatus('error', 'Location is not available in this browser.');
        return;
    }
    setStatus('loading', 'Requesting your location…');
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
            const name = await reverseGeocode(lat, lng);
            if (name) label = name;
        } catch (_) {}
        document.getElementById('srStart').value = label;
        const cacheKey = CACHE_PREFIX + label.toLowerCase().trim();
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ lat, lng })); } catch (_) {}
        setStatus('done', 'Start location set from this device. Travel history is not stored.');
    }, () => {
        setStatus('error', 'Location permission was not granted.');
    }, { enableHighAccuracy: false, timeout: 10000 });
}

function placeEndpointMarkers(start, dest) {
    if (state.startMarker) state.map.removeLayer(state.startMarker);
    if (state.destMarker) state.map.removeLayer(state.destMarker);

    state.startMarker = L.marker([start.lat, start.lng], {
        icon: endpointIcon('#15803d', 'S'),
        title: 'Start',
    }).addTo(state.map).bindPopup('Start');

    state.destMarker = L.marker([dest.lat, dest.lng], {
        icon: endpointIcon('#0f172a', 'D'),
        title: 'Destination',
    }).addTo(state.map).bindPopup('Destination');
}

function endpointIcon(color, letter) {
    return L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;font:700 12px Inter,sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${letter}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
}

function drawRoutes() {
    state.routesLayer.clearLayers();
    state.polylines = {};

    state.routes.forEach((route, idx) => {
        const latlngs = (route.coordinates || []).map(([lng, lat]) => [lat, lng]);
        if (!latlngs.length) return;
        const line = L.polyline(latlngs, {
            color: ROUTE_MUTED,
            weight: 5,
            opacity: 0.55,
            lineJoin: 'round',
        });
        line.on('click', () => selectRoute(route.id));
        line.addTo(state.routesLayer);
        state.polylines[route.id] = line;
        line.bringToBack();
        if (idx === 0) line.bringToFront();
    });
}

function stylePolylines() {
    state.routes.forEach(route => {
        const line = state.polylines[route.id];
        if (!line) return;
        const isRec = route.id === state.recommendedId;
        const isSel = route.id === state.selectedId;
        line.setStyle({
            color: isRec ? ROUTE_REC : (isSel ? ROUTE_SELECTED : ROUTE_MUTED),
            weight: isRec ? 7 : 5,
            opacity: isRec ? 0.95 : (isSel ? 0.85 : 0.45),
        });
        if (isRec) line.bringToFront();
    });
}

/** Only complaints already matched to a route are drawn, capped for performance. */
function drawComplaintPins() {
    state.markersLayer.clearLayers();
    if (!state.coverage.preciseGeoAvailable) return;

    const seen = new Set();
    const nearby = [];

    state.routes.forEach(route => {
        (route.analysis.nearbyRelevant || []).forEach(c => {
            if (seen.has(c.complaint_id)) return;
            seen.add(c.complaint_id);
            nearby.push(c);
        });
    });

    // Unresolved and highest priority first, so the cap never hides the
    // reports that actually drove the score.
    nearby.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

    nearby.slice(0, MAX_COMPLAINT_MARKERS)
        .forEach(c => addComplaintPin(c, c._lat, c._lng));
}

function addComplaintPin(complaint, lat, lng) {
    const priority = (complaint.priority || 'LOW').toUpperCase();
    const color = PRIORITY_COLORS[priority] || PRIORITY_COLORS.LOW;
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: '',
            html: `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        }),
    });
    marker.bindPopup(buildPopupHtml(complaint), { minWidth: 220, maxWidth: 300 });
    marker.addTo(state.markersLayer);
}

function buildPopupHtml(c) {
    const priority = (c.priority || 'LOW').toUpperCase();
    const color = PRIORITY_COLORS[priority] || PRIORITY_COLORS.LOW;
    const statusLabel = (c.status || '').replace('_', ' ');
    const desc = (c.description || '').slice(0, 90) + (c.description && c.description.length > 90 ? '…' : '');
    const place = c.location_label || c.location || 'Location not specified';
    return `
        <div>
            <div style="font-size:11px;font-weight:700;color:#64748b">${escHtml(c.complaint_id)}</div>
            <div style="font-size:12.5px;font-weight:700;margin-top:2px">${escHtml(c.category || '—')}</div>
            <div style="font-size:12.5px;margin:4px 0;color:#334155">${escHtml(desc)}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;background:${color}20;color:${color}">${priority}</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:100px;background:#f1f5f9;color:#64748b">${escHtml(statusLabel)}</span>
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:6px">${escHtml(place)}${Number.isFinite(c._distance_m) ? ` · ${c._distance_m} m from route` : ''}</div>
            ${c.synthetic ? '<div style="font-size:11px;color:#9a3412;margin-top:6px;font-weight:600">Synthetic demonstration record.</div>' : ''}
        </div>`;
}

function drawHotspots() {
    state.hotspotLayer.clearLayers();
    const el = document.getElementById('srHotspots');
    if (!state.hotspots.length) {
        el.innerHTML = '<p class="sr-hotspot-empty">Only real clusters are shown when geographic complaint data exists. None are fabricated.</p>';
        return;
    }
    const top = [...state.hotspots].sort((a, b) => b.count - a.count).slice(0, 8);

    state.hotspots.forEach(h => {
        L.circle([h.lat, h.lng], {
            radius: h.radiusMeters,
            color: '#ea580c',
            weight: 1,
            fillOpacity: 0.12,
        }).addTo(state.hotspotLayer);
    });

    el.innerHTML = top.map(h =>
        `<p class="sr-disclaimer"><strong>${h.count} relevant civic reports</strong> within ${h.radiusMeters}m${h.categories.length ? ` (${escHtml(h.categories.slice(0, 3).join(', '))})` : ''}.</p>`
    ).join('')
    + `<p class="sr-disclaimer" style="margin-top:8px">${state.hotspots.length} cluster(s) of unresolved relevant reports along the compared routes, from synthetic demonstration data.</p>`;
}

function fitMap() {
    const layers = [
        ...Object.values(state.polylines),
        state.startMarker,
        state.destMarker,
    ].filter(Boolean);
    if (!layers.length) return;
    try {
        const group = L.featureGroup(layers);
        state.map.fitBounds(group.getBounds().pad(0.18));
    } catch (_) {}
}

function applyRecommendation() {
    const rec = SafeRouteEngine.recommend(state.routes, state.preference, state.coverage);
    state.recommendedId = rec.recommendedId;
    state.selectedId = rec.recommendedId || state.routes[0]?.id || null;
    state.agentInput = SafeRouteEngine.buildAgentInput(state.routes, state.coverage, state.preference);
    window.__SAFEROUTE_AGENT_INPUT__ = state.agentInput;
    stylePolylines();
    renderRouteList();
    renderWhy(rec);
    renderTable();
}

function selectRoute(id) {
    state.selectedId = id;
    stylePolylines();
    renderRouteList();
}

function renderRouteList() {
    const el = document.getElementById('srRouteList');
    if (!state.routes.length) {
        el.innerHTML = '<p class="sr-empty">Enter a start and destination to compare every route returned by the routing provider.</p>';
        return;
    }

    el.innerHTML = state.routes.map(route => {
        const rec = route.id === state.recommendedId;
        const sel = route.id === state.selectedId;
        const a = route.analysis;
        const why = SafeRouteEngine.explainRoute(route, state.routes, state.recommendedId, state.coverage);
        const indicator = a.civicAvailable
            ? `<div class="sr-indicator"><span class="sr-indicator__val">${a.civicIndicator}</span><span class="sr-indicator__unit">/ 100 civic indicator</span></div>`
            : `<div class="sr-indicator"><span class="sr-indicator__val" style="font-size:13px;font-weight:600">Civic indicator unavailable</span></div>`;
        const stats = a.civicAvailable
            ? `<div class="sr-stats-mini">
                    <div class="sr-stat-mini"><div class="sr-stat-mini__val">${a.relevantCount}</div><div class="sr-stat-mini__label">Relevant</div></div>
                    <div class="sr-stat-mini"><div class="sr-stat-mini__val">${a.unresolvedCount}</div><div class="sr-stat-mini__label">Unresolved</div></div>
                    <div class="sr-stat-mini"><div class="sr-stat-mini__val">${a.highCriticalCount}</div><div class="sr-stat-mini__label">High/Critical</div></div>
               </div>`
            : '';

        return `
            <div class="sr-route${rec ? ' is-recommended' : ''}${sel ? ' is-selected' : ''}" data-id="${route.id}" onclick="selectRoute('${route.id}')">
                <div class="sr-route__top">
                    <div class="sr-route__label">${escHtml(route.label)}</div>
                    ${rec ? '<span class="sr-pill">Recommended</span>' : ''}
                </div>
                <div class="sr-route__meta">
                    <span>${SafeRouteEngine.formatDuration(route.durationSeconds)}</span>
                    <span>${SafeRouteEngine.formatKm(route.distanceMeters)}</span>
                </div>
                ${indicator}
                <div class="sr-disclaimer">${a.civicAvailable
                    ? 'Based on synthetic Your Yojana demonstration data.'
                    : 'Travel information only. Civic demonstration data unavailable.'}</div>
                ${stats}
                ${renderBreakdown(a)}
                <div class="sr-route__why">${escHtml(why)}</div>
            </div>`;
    }).join('');
}

/** Shows exactly where the deductions came from — no hidden score. */
function renderBreakdown(analysis) {
    if (!analysis.civicAvailable) return '';

    if (!analysis.breakdown.length) {
        return `<div class="sr-breakdown">
            <div class="sr-breakdown__title">Breakdown</div>
            <div class="sr-breakdown__row"><span>No unresolved relevant reports within ${SafeRouteEngine.CORRIDOR_METERS} m</span><span>0</span></div>
            ${analysis.resolvedCount ? `<div class="sr-breakdown__row sr-breakdown__row--muted"><span>Resolved reports nearby (no penalty)</span><span>${analysis.resolvedCount}</span></div>` : ''}
        </div>`;
    }

    const rows = analysis.breakdown.map(g => `
        <div class="sr-breakdown__row">
            <span>${escHtml(g.label)}</span>
            <span>${g.count}${g.points > 0 ? ` <em>−${g.points.toFixed(1)}</em>` : ''}</span>
        </div>`).join('');

    return `<div class="sr-breakdown">
        <div class="sr-breakdown__title">Breakdown (unresolved reports within ${SafeRouteEngine.CORRIDOR_METERS} m)</div>
        ${rows}
        ${analysis.resolvedCount ? `<div class="sr-breakdown__row sr-breakdown__row--muted"><span>Resolved nearby (no penalty)</span><span>${analysis.resolvedCount}</span></div>` : ''}
        ${analysis.contextualCount ? `<div class="sr-breakdown__row sr-breakdown__row--muted"><span>Contextual (garbage / water supply)</span><span>${analysis.contextualCount}</span></div>` : ''}
        <div class="sr-breakdown__row sr-breakdown__row--muted"><span>Weighted concern per km</span><span>${analysis.concernPerKm}</span></div>
        <div class="sr-breakdown__total"><span>100 − ${analysis.penalty.toFixed(1)} penalty</span><span>${analysis.civicIndicator} / 100</span></div>
    </div>`;
}

function renderWhy(rec) {
    const el = document.getElementById('srWhyBody');
    const picked = state.routes.find(r => r.id === rec.recommendedId);
    const why = SafeRouteEngine.buildWhyRecommended(state.routes, rec.recommendedId, state.coverage);

    if (!picked) {
        el.innerHTML = `<p class="sr-empty">${escHtml(rec.reason)}</p>
            <p class="sr-disclaimer" style="margin-top:8px">All returned routes remain listed so you can still compare travel time and distance.</p>`;
        return;
    }

    el.innerHTML = `
        <div class="sr-route__top">
            <div class="sr-route__label">${escHtml(picked.label)}</div>
            <span class="sr-pill">Recommended</span>
        </div>
        <p class="sr-disclaimer" style="margin:8px 0 12px">${escHtml(rec.reason)}</p>
        <div class="sr-why">
            ${why.advantages.map(a => `<div class="sr-why__item sr-why__item--ok">${escHtml(a)}</div>`).join('')}
        </div>
        ${why.tradeoffs.length ? `<div class="sr-why__trade"><strong>Trade-off.</strong> ${why.tradeoffs.map(escHtml).join(' ')}</div>` : ''}
        <div class="sr-why__summary">${escHtml(why.summary)}</div>
        <p class="sr-disclaimer" style="margin-top:10px">Based on synthetic civic demonstration data. This is a civic-infrastructure comparison, not a guarantee of personal safety. You make the final choice.</p>
    `;
}

function renderTable() {
    const el = document.getElementById('srCompareBody');
    if (!state.routes.length) {
        el.innerHTML = '<p class="sr-empty">The comparison table fills after routes are found.</p>';
        return;
    }
    const head = state.routes.map(r =>
        `<th class="${r.id === state.recommendedId ? 'is-rec' : ''}">${escHtml(r.label)}${r.id === state.recommendedId ? ' ★' : ''}</th>`
    ).join('');

    const row = (label, getter) => `<tr>
        <td>${label}</td>
        ${state.routes.map(r => `<td class="${r.id === state.recommendedId ? 'is-rec' : ''}">${getter(r)}</td>`).join('')}
    </tr>`;

    const civicCell = (r, key) => r.analysis.civicAvailable ? String(r.analysis[key]) : 'Unavailable';

    el.innerHTML = `<table class="sr-table">
        <thead><tr><th></th>${head}</tr></thead>
        <tbody>
            ${row('Time', r => SafeRouteEngine.formatDuration(r.durationSeconds))}
            ${row('Distance', r => SafeRouteEngine.formatKm(r.distanceMeters))}
            ${row('Relevant reports', r => civicCell(r, 'relevantCount'))}
            ${row('Unresolved', r => civicCell(r, 'unresolvedCount'))}
            ${row('High / Critical', r => civicCell(r, 'highCriticalCount'))}
            ${row('Contextual', r => civicCell(r, 'contextualCount'))}
            ${row('Civic indicator', r => r.analysis.civicAvailable ? String(r.analysis.civicIndicator) : 'Unavailable')}
        </tbody>
    </table>
    <p class="sr-disclaimer" style="margin-top:10px">${state.coverage.preciseGeoAvailable
        ? `Based on synthetic Chennai civic demonstration data within ${SafeRouteEngine.CORRIDOR_METERS} m of each route.`
        : 'Travel information only. Civic demonstration data unavailable.'} Recommended: ${state.recommendedId ? escHtml(state.routes.find(r => r.id === state.recommendedId)?.label || '—') : 'none'}.</p>`;
}

function showOverlayLoading(msg) {
    const overlay = document.getElementById('srOverlay');
    overlay.className = 'sr-overlay';
    overlay.innerHTML = `
        <div class="sr-spinner"></div>
        <div class="sr-overlay__title">${escHtml(msg)}</div>
        <div class="sr-overlay__sub">Using OpenStreetMap routing. Civic scores are calculated only from real complaint coordinates.</div>`;
}

function setOverlay(title, detail, hide) {
    const overlay = document.getElementById('srOverlay');
    if (hide) {
        overlay.className = 'sr-overlay hidden';
        return;
    }
    overlay.className = 'sr-overlay';
    overlay.innerHTML = `
        <div class="sr-overlay__title">${escHtml(title)}</div>
        <div class="sr-overlay__sub">${escHtml(detail || '')}</div>`;
}

function hideOverlay() {
    const overlay = document.getElementById('srOverlay');
    if (overlay) overlay.className = 'sr-overlay hidden';
}

function setStatus(kind, msg) {
    const dot = document.getElementById('srDot');
    const txt = document.getElementById('srStatusText');
    if (dot) dot.className = `sr-dot sr-dot--${kind}`;
    if (txt) txt.textContent = msg;
}

function escHtml(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
