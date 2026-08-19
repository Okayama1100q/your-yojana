// =============================================================
// civic-map.js — Civic Infrastructure Map
// Uses ONLY existing api.js (GET /complaints) — no new endpoints.
// Geocodes complaint.location strings via Nominatim (free, no key).
// Every external call is independently try/catched — one failure
// cannot cascade and break the rest of the application.
// =============================================================

// ── Constants ─────────────────────────────────────────────────
const MAP_CENTER    = [20.5937, 78.9629]; // Geographic center of India
const MAP_ZOOM      = 5;
const MAX_GEOCODE   = 30;                 // cap to respect Nominatim rate limit
const GEOCODE_DELAY = 1100;              // ms between Nominatim requests (1 req/sec policy)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Geocode result cache (sessionStorage key prefix)
const CACHE_PREFIX  = 'yymap_geo_';

// Priority → marker colour mapping
const PRIORITY_COLORS = {
    CRITICAL: '#DC2626',
    HIGH:     '#EA580C',
    MEDIUM:   '#D97706',
    LOW:      '#16A34A',
};

const PRIORITY_ICON_SIZE = {
    CRITICAL: 18,
    HIGH:     16,
    MEDIUM:   14,
    LOW:      12,
};

// ── State ──────────────────────────────────────────────────────
let leafletMap      = null;
let allComplaints   = [];   // raw data from API
let pinnedComplaints = [];  // complaints that were successfully geocoded
let markersLayer    = null;
let selectedId      = null;
let currentFilters  = { priority: '', status: '', department: '' };

// ── Boot ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    try {
        initMap();
        loadData();
    } catch (err) {
        showMapError('Map failed to initialise.', err.message);
    }
});

// ── Map initialisation ─────────────────────────────────────────
function initMap() {
    // Guard: Leaflet must have loaded
    if (typeof L === 'undefined') {
        throw new Error('Leaflet library did not load.');
    }

    leafletMap = L.map('leafletMap', {
        center: MAP_CENTER,
        zoom:   MAP_ZOOM,
        zoomControl: true,
    });

    // OpenStreetMap tile layer (free, no API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(leafletMap);

    markersLayer = L.layerGroup().addTo(leafletMap);
}

// ── Load complaint data ────────────────────────────────────────
async function loadData() {
    showMapLoading('Fetching complaints from backend…', 0);
    setStatusBar('loading', 'Connecting to backend…');

    let data;
    try {
        // Uses the EXISTING api.js — no new endpoints
        data = await api.getComplaints();
    } catch (err) {
        showMapError(
            'Cannot reach backend.',
            'Make sure the Your Yojana server is running at localhost:8000. ' + err.message
        );
        setStatusBar('error', 'Backend unreachable — ' + err.message);
        return;
    }

    allComplaints = (data.complaints || []);

    if (allComplaints.length === 0) {
        showMapEmpty();
        setStatusBar('done', 'No complaints found in database.');
        populateSidebarList([]);
        updateInfoPanels([], {});
        return;
    }

    // Populate sidebar list immediately with all complaints (no geocode needed)
    populateSidebarList(allComplaints);
    updateStatsStrip(allComplaints);
    updateInfoPanels(allComplaints, {});

    // Populate filter department options
    populateDeptFilter(allComplaints);

    // Now geocode (up to MAX_GEOCODE complaints)
    await geocodeAndPin(allComplaints);
}

// ── Geocoding ──────────────────────────────────────────────────
async function geocodeAndPin(complaints) {
    const toGeocode = complaints
        .filter(c => c.location && c.location.trim().length > 2)
        .slice(0, MAX_GEOCODE);

    if (toGeocode.length === 0) {
        showMapEmpty('No location data', 'The complaints in the database do not have location information that can be mapped.');
        setStatusBar('done', 'No mappable locations found in complaints.');
        return;
    }

    showMapLoading(`Geocoding ${toGeocode.length} location(s)…`, 0);
    setStatusBar('loading', `Geocoding 0 / ${toGeocode.length} locations…`);

    pinnedComplaints = [];
    let successCount = 0;
    let failCount    = 0;

    for (let i = 0; i < toGeocode.length; i++) {
        const complaint = toGeocode[i];
        const pct = Math.round(((i) / toGeocode.length) * 100);
        updateLoadingProgress(pct, `Geocoding: ${complaint.location} (${i + 1}/${toGeocode.length})`);
        setStatusBar('loading', `Geocoding ${i + 1} / ${toGeocode.length}: ${complaint.location}`);

        try {
            const coords = await geocodeLocation(complaint.location);
            if (coords) {
                pinnedComplaints.push({ ...complaint, _lat: coords.lat, _lng: coords.lng });
                successCount++;
                addPin(complaint, coords.lat, coords.lng);
            } else {
                failCount++;
            }
        } catch (e) {
            // Individual geocode failure — silent skip
            failCount++;
        }

        // Respect Nominatim 1 req/sec rate limit
        if (i < toGeocode.length - 1) {
            await sleep(GEOCODE_DELAY);
        }
    }

    // Hide loading overlay
    hideMapOverlay();
    updateInfoPanels(allComplaints, buildDeptMap(allComplaints));
    updateStatsStrip(allComplaints);

    if (successCount === 0) {
        showMapEmpty(
            'Could not map any locations',
            'The location names in complaints could not be geocoded. They may be too vague or Nominatim may be unavailable.'
        );
        setStatusBar('error', `Geocoding failed for all ${failCount} location(s).`);
    } else {
        // Fit map to markers
        try {
            const group = L.featureGroup(markersLayer.getLayers());
            if (group.getLayers().length > 0) {
                leafletMap.fitBounds(group.getBounds().pad(0.2));
            }
        } catch(_) {}

        const msg = failCount > 0
            ? `Mapped ${successCount} complaint(s). ${failCount} location(s) could not be geocoded.`
            : `Successfully mapped ${successCount} complaint(s).`;
        setStatusBar('done', msg);
    }

    // Extension point: focus a specific complaint from Resolution Center (?focus=YY-XXXXXXXX)
    applyFocusFromUrl();
}

// Geocode a location string → { lat, lng } or null
async function geocodeLocation(locationStr) {
    // Check session cache first
    const cacheKey = CACHE_PREFIX + locationStr.toLowerCase().trim();
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        try { return JSON.parse(cached); } catch(_) {}
    }

    const params = new URLSearchParams({
        q:              locationStr + ', India',
        format:         'json',
        limit:          '1',
        'accept-language': 'en',
    });

    const url = `${NOMINATIM_URL}?${params}`;

    const res = await fetch(url, {
        headers: { 'User-Agent': 'YourYojana/1.0 CivicPlatform' }
    });

    if (!res.ok) return null;

    const results = await res.json();
    if (!results || results.length === 0) return null;

    const coords = {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
    };

    // Cache in session storage to avoid re-geocoding
    try { sessionStorage.setItem(cacheKey, JSON.stringify(coords)); } catch(_) {}

    return coords;
}

// ── Map Marker Pins ────────────────────────────────────────────
function addPin(complaint, lat, lng) {
    const priority = (complaint.priority || 'LOW').toUpperCase();
    const color    = PRIORITY_COLORS[priority] || PRIORITY_COLORS.LOW;
    const size     = PRIORITY_ICON_SIZE[priority] || 12;

    // Custom SVG circle icon
    const svgIcon = L.divIcon({
        className: '',
        html: `
            <div style="
                width:${size + 6}px;
                height:${size + 6}px;
                background:${color};
                border-radius:50%;
                border:2.5px solid #fff;
                box-shadow:0 2px 6px rgba(0,0,0,0.25);
                display:flex;
                align-items:center;
                justify-content:center;
            ">
                <div style="
                    width:${size - 4}px;
                    height:${size - 4}px;
                    background:rgba(255,255,255,0.35);
                    border-radius:50%;
                "></div>
            </div>`,
        iconSize: [size + 6, size + 6],
        iconAnchor: [(size + 6) / 2, (size + 6) / 2],
        popupAnchor: [0, -(size + 6) / 2 - 4],
    });

    const marker = L.marker([lat, lng], { icon: svgIcon });

    const popupHtml = buildPopupHtml(complaint);
    marker.bindPopup(popupHtml, {
        minWidth: 230,
        maxWidth: 300,
        className: 'yymap-leaflet-popup',
    });

    marker.on('click', () => {
        highlightListItem(complaint.complaint_id);
    });

    marker.addTo(markersLayer);
}

function buildPopupHtml(c) {
    // PUBLIC MAP PRIVACY: never show citizen name, phone, email, or personal photos.
    // Only issue, category, approximate location, priority, and status.
    const priority = (c.priority || 'LOW').toUpperCase();
    const color = PRIORITY_COLORS[priority] || PRIORITY_COLORS.LOW;
    const statusLabel = (c.status || '').replace('_', ' ');
    const desc = (c.description || '').slice(0, 80) + (c.description && c.description.length > 80 ? '…' : '');

    return `
        <div class="yymap-popup">
            <div class="yymap-popup__id">${escHtml(c.complaint_id)}</div>
            <div class="yymap-popup__title">${escHtml(desc)}</div>
            <div class="yymap-popup__meta">
                <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;background:${color}20;color:${color};">${priority}</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:100px;background:#f1f5f9;color:#64748b;">${escHtml(statusLabel)}</span>
                ${c.category ? `<span style="font-size:11px;color:#64748b;">${escHtml(c.category)}</span>` : ''}
            </div>
            <div class="yymap-popup__loc">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
                ${escHtml(c.location || 'Location not specified')}
            </div>
            <a href="track.html?id=${encodeURIComponent(c.complaint_id)}" class="yymap-popup__link">
                View Full Details →
            </a>
        </div>`;
}

// ── Sidebar list ───────────────────────────────────────────────
function populateSidebarList(complaints) {
    const list = document.getElementById('complaintListEl');
    if (!list) return;

    if (complaints.length === 0) {
        list.innerHTML = '<div class="clist-empty">No complaints match the current filters.</div>';
        return;
    }

    list.innerHTML = complaints.map(c => {
        const priority = (c.priority || 'LOW').toUpperCase();
        const priorityCls = priority.toLowerCase();
        const desc = (c.description || '').slice(0, 60) + ((c.description || '').length > 60 ? '…' : '');
        return `
            <div class="clist-item" id="clist-${c.complaint_id}" onclick="focusComplaint('${c.complaint_id}')">
                <div class="clist-item__top">
                    <span class="clist-item__id">${escHtml(c.complaint_id)}</span>
                    <span class="clist-item__priority priority-dot--${priorityCls}">${priority}</span>
                </div>
                <div class="clist-item__desc">${escHtml(desc)}</div>
                <div class="clist-item__loc">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    </svg>
                    ${escHtml(c.location || '—')}
                </div>
            </div>`;
    }).join('');
}

function highlightListItem(complaintId) {
    // Remove old active
    document.querySelectorAll('.clist-item--active').forEach(el => el.classList.remove('clist-item--active'));
    const el = document.getElementById(`clist-${complaintId}`);
    if (el) {
        el.classList.add('clist-item--active');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    selectedId = complaintId;
}

function focusComplaint(complaintId) {
    highlightListItem(complaintId);
    // Pan map to that marker if it was geocoded
    const pinned = pinnedComplaints.find(c => c.complaint_id === complaintId);
    if (pinned && leafletMap) {
        leafletMap.setView([pinned._lat, pinned._lng], 13, { animate: true });
        // Open the popup for this marker
        markersLayer.getLayers().forEach(marker => {
            try {
                const latlng = marker.getLatLng();
                if (Math.abs(latlng.lat - pinned._lat) < 0.0001 && Math.abs(latlng.lng - pinned._lng) < 0.0001) {
                    marker.openPopup();
                }
            } catch(_) {}
        });
    }
}

/** Focus complaint from URL ?focus=YY-XXXXXXXX (used by Government Resolution Center). */
function applyFocusFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const focusId = (params.get('focus') || '').trim().toUpperCase();
        if (!focusId) return;
        // Prefer exact id; also accept without YY- prefix
        const match = allComplaints.find(c =>
            (c.complaint_id || '').toUpperCase() === focusId ||
            (c.complaint_id || '').toUpperCase() === `YY-${focusId.replace(/^YY-/, '')}`
        );
        if (match) {
            focusComplaint(match.complaint_id);
            setStatusBar('done', `Focused complaint ${match.complaint_id}`);
        } else {
            setStatusBar('done', `Complaint ${focusId} not found on map.`);
        }
    } catch (_) {
        // Never break the map for focus failures
    }
}

// ── Filters ───────────────────────────────────────────────────
function populateDeptFilter(complaints) {
    const depts = [...new Set(complaints.map(c => c.department).filter(Boolean))].sort();
    const sel = document.getElementById('deptFilter');
    if (!sel) return;
    depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        sel.appendChild(opt);
    });
}

function applyFilters() {
    const priority   = document.getElementById('priorityFilter')?.value || '';
    const status     = document.getElementById('statusFilter')?.value   || '';
    const department = document.getElementById('deptFilter')?.value     || '';

    currentFilters = { priority, status, department };

    const filtered = allComplaints.filter(c => {
        if (priority   && c.priority   !== priority)   return false;
        if (status     && c.status     !== status)     return false;
        if (department && c.department !== department) return false;
        return true;
    });

    populateSidebarList(filtered);
    updateInfoPanels(filtered, buildDeptMap(filtered));

    // Re-render markers
    if (markersLayer) {
        markersLayer.clearLayers();
        pinnedComplaints
            .filter(c => {
                if (priority   && c.priority   !== priority)   return false;
                if (status     && c.status     !== status)     return false;
                if (department && c.department !== department) return false;
                return true;
            })
            .forEach(c => addPin(c, c._lat, c._lng));
    }
}

function resetFilters() {
    ['priorityFilter', 'statusFilter', 'deptFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentFilters = { priority: '', status: '', department: '' };
    populateSidebarList(allComplaints);
    updateInfoPanels(allComplaints, buildDeptMap(allComplaints));

    if (markersLayer) {
        markersLayer.clearLayers();
        pinnedComplaints.forEach(c => addPin(c, c._lat, c._lng));
    }
}

// ── Info panels ───────────────────────────────────────────────
function updateStatsStrip(complaints) {
    setText('statTotal',      complaints.length);
    setText('statMapped',     pinnedComplaints.length);
    setText('statPending',    complaints.filter(c => c.status === 'PENDING').length);
    setText('statCritical',   complaints.filter(c => c.priority === 'CRITICAL').length);
}

function updateInfoPanels(complaints, deptMap) {
    // Department bar chart
    const deptContainer = document.getElementById('deptBars');
    if (deptContainer) {
        const dm = buildDeptMap(complaints);
        const total = complaints.length || 1;
        const top5  = Object.entries(dm)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        deptContainer.innerHTML = top5.length === 0
            ? '<div style="font-size:12px;color:var(--text-muted)">No data</div>'
            : top5.map(([dept, count]) => `
                <div class="dept-bar-row">
                    <div class="dept-bar-name" title="${escHtml(dept)}">${escHtml(dept)}</div>
                    <div class="dept-bar-track">
                        <div class="dept-bar-fill" style="width:${Math.round((count/total)*100)}%"></div>
                    </div>
                    <div class="dept-bar-count">${count}</div>
                </div>`).join('');
    }

    // Priority breakdown
    const pbContainer = document.getElementById('priorityBreakdown');
    if (pbContainer) {
        const total = complaints.length || 1;
        const counts = {
            CRITICAL: complaints.filter(c => c.priority === 'CRITICAL').length,
            HIGH:     complaints.filter(c => c.priority === 'HIGH').length,
            MEDIUM:   complaints.filter(c => c.priority === 'MEDIUM').length,
            LOW:      complaints.filter(c => c.priority === 'LOW').length,
        };
        pbContainer.innerHTML = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => `
            <div class="pb-row">
                <div class="pb-label pb-label--${p.toLowerCase()}">${p}</div>
                <div class="pb-bar-track">
                    <div class="pb-bar-fill pb-bar-fill--${p.toLowerCase()}" style="width:${Math.round((counts[p]/total)*100)}%"></div>
                </div>
                <div class="pb-count">${counts[p]}</div>
            </div>`).join('');
    }

    // Status tiles
    setText('sStatusPending',    complaints.filter(c => c.status === 'PENDING').length);
    setText('sStatusAssigned',   complaints.filter(c => c.status === 'ASSIGNED').length);
    setText('sStatusInProgress', complaints.filter(c => c.status === 'IN_PROGRESS').length);
    setText('sStatusResolved',   complaints.filter(c => c.status === 'RESOLVED').length);
}

// ── Overlay state helpers ──────────────────────────────────────
function showMapLoading(msg, pct) {
    const overlay = document.getElementById('mapOverlay');
    if (!overlay) return;
    overlay.className = 'map-overlay';
    overlay.innerHTML = `
        <div class="map-overlay__icon map-overlay__icon--loading">
            <div class="map-spinner"></div>
        </div>
        <div class="map-overlay__title">${escHtml(msg)}</div>
        <div class="geocode-progress">
            <div class="geocode-progress__fill" id="geocodeProgressBar" style="width:${pct}%"></div>
        </div>
        <div class="geocode-progress__label" id="geocodeProgressLabel">Initialising…</div>`;
}

function updateLoadingProgress(pct, label) {
    const bar = document.getElementById('geocodeProgressBar');
    const lbl = document.getElementById('geocodeProgressLabel');
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = label;
}

function hideMapOverlay() {
    const overlay = document.getElementById('mapOverlay');
    if (overlay) overlay.className = 'map-overlay hidden';
}

function showMapError(title, detail) {
    const overlay = document.getElementById('mapOverlay');
    if (!overlay) return;
    overlay.className = 'map-overlay';
    overlay.innerHTML = `
        <div class="map-overlay__icon map-overlay__icon--error">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <circle cx="12" cy="16" r=".5" fill="currentColor"/>
            </svg>
        </div>
        <div class="map-overlay__title">${escHtml(title)}</div>
        <div class="map-overlay__sub">${escHtml(detail || '')}</div>
        <button onclick="location.reload()" style="margin-top:12px;padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
            Retry
        </button>`;
}

function showMapEmpty(title, detail) {
    const overlay = document.getElementById('mapOverlay');
    if (!overlay) return;
    overlay.className = 'map-overlay';
    overlay.innerHTML = `
        <div class="map-overlay__icon map-overlay__icon--empty">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
        </div>
        <div class="map-overlay__title">${escHtml(title || 'No complaints to map')}</div>
        <div class="map-overlay__sub">${escHtml(detail || 'Submit a complaint with a location to see it appear on the map.')}</div>
        <a href="citizen.html" style="margin-top:12px;padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;text-decoration:none;display:inline-block">
            Submit a Complaint →
        </a>`;
}

function setStatusBar(state, msg) {
    const bar = document.getElementById('geocodeStatusBar');
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    if (!bar) return;
    if (dot) dot.className = `geocode-status__dot geocode-status__dot--${state}`;
    if (txt) txt.textContent = msg;
}

// ── Utilities ─────────────────────────────────────────────────
function escHtml(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function buildDeptMap(complaints) {
    const m = {};
    (complaints || []).forEach(c => {
        if (c.department) m[c.department] = (m[c.department] || 0) + 1;
    });
    return m;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
