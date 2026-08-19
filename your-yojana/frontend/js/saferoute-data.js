// =============================================================
// saferoute-data.js — SafeRoute synthetic dataset service
//
// Isolated read-only data-access layer for SafeRoute only.
// - Loads synthetic_chennai_civic_complaints.csv once, caches it.
// - Validates records and drops malformed rows.
// - Provides a grid-based spatial pre-filter so route analysis
//   never scans all ~14,250 records.
//
// This service NEVER writes to the Your Yojana database and is not
// used by the Civic Map, Citizen, Government, or Admin pages.
// Every record here is synthetic demonstration data.
// =============================================================

const SafeRouteData = (() => {
    // First path that responds wins. The frontend server serves
    // ./frontend, so data/ is the working path; the parent paths keep
    // this working if the project is ever served from its root.
    const CSV_PATHS = [
        'data/synthetic_chennai_civic_complaints.csv',
        '../synthetic_chennai_civic_complaints.csv',
        '/synthetic_chennai_civic_complaints.csv',
    ];

    const REQUIRED_FIELDS = [
        'complaint_id',
        'latitude',
        'longitude',
        'category',
        'priority',
        'priority_score',
        'status',
    ];

    // ~1.1 km cells. Large enough to keep the index small, small
    // enough that a 250 m corridor only touches a few cells.
    const CELL_DEG = 0.01;

    let loadPromise = null;

    const store = {
        loaded: false,
        records: [],
        grid: new Map(),
        count: 0,
        skipped: 0,
        source: null,
        error: null,
    };

    function cellKey(lat, lng) {
        return `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`;
    }

    /** Minimal RFC-4180 style parser: handles quoted fields and embedded commas. */
    function parseCsv(text) {
        const rows = [];
        let field = '';
        let row = [];
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else {
                    field += ch;
                }
                continue;
            }

            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { row.push(field); field = ''; }
            else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
            else if (ch !== '\r') { field += ch; }
        }
        if (field.length || row.length) { row.push(field); rows.push(row); }
        return rows;
    }

    function toRecords(rows) {
        if (!rows.length) throw new Error('CSV contained no rows.');

        const header = rows[0].map(h => h.trim());
        const missingCols = REQUIRED_FIELDS.filter(f => !header.includes(f));
        if (missingCols.length) {
            throw new Error(`CSV is missing required column(s): ${missingCols.join(', ')}`);
        }

        const idx = {};
        header.forEach((name, i) => { idx[name] = i; });

        const records = [];
        let skipped = 0;

        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length < header.length) {
                if (row && row.length === 1 && row[0].trim() === '') continue; // trailing blank line
                skipped++;
                continue;
            }

            const lat = parseFloat(row[idx.latitude]);
            const lng = parseFloat(row[idx.longitude]);
            const complaintId = (row[idx.complaint_id] || '').trim();
            const category = (row[idx.category] || '').trim();
            const priority = (row[idx.priority] || '').trim().toUpperCase();
            const status = (row[idx.status] || '').trim().toUpperCase();
            const score = parseFloat(row[idx.priority_score]);

            const validCoords = Number.isFinite(lat) && Number.isFinite(lng)
                && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

            if (!complaintId || !category || !priority || !status || !validCoords) {
                skipped++;
                continue;
            }

            records.push({
                complaint_id: complaintId,
                description: idx.description != null ? (row[idx.description] || '').trim() : '',
                latitude: lat,
                longitude: lng,
                location_label: idx.location_label != null ? (row[idx.location_label] || '').trim() : '',
                category,
                priority,
                priority_score: Number.isFinite(score) ? score : null,
                status,
                department: idx.department != null ? (row[idx.department] || '').trim() : '',
                affected_count: idx.affected_count != null ? toIntOrNull(row[idx.affected_count]) : null,
                duration_days: idx.duration_days != null ? toIntOrNull(row[idx.duration_days]) : null,
                // Preserved so the UI can always label these as demonstration records.
                synthetic: true,
            });
        }

        if (!records.length) throw new Error('No valid records found in the CSV.');
        return { records, skipped };
    }

    function toIntOrNull(value) {
        const n = parseInt(value, 10);
        return Number.isFinite(n) ? n : null;
    }

    function buildGrid(records) {
        const grid = new Map();
        for (let i = 0; i < records.length; i++) {
            const key = cellKey(records[i].latitude, records[i].longitude);
            const bucket = grid.get(key);
            if (bucket) bucket.push(i);
            else grid.set(key, [i]);
        }
        return grid;
    }

    async function fetchFirstAvailable() {
        const failures = [];
        for (const path of CSV_PATHS) {
            try {
                // Normal HTTP validation: a replaced CSV is picked up on the
                // next page load. Repeat parsing is avoided by loadPromise.
                const res = await fetch(path);
                if (!res.ok) { failures.push(`${path} → HTTP ${res.status}`); continue; }
                const text = await res.text();
                if (!text || text.length < 32) { failures.push(`${path} → empty response`); continue; }
                return { text, path };
            } catch (err) {
                failures.push(`${path} → ${err.message}`);
            }
        }
        throw new Error(`Could not read the synthetic dataset (${failures.join('; ')})`);
    }

    /** Loads once. Repeat calls reuse the same promise and parsed data. */
    function load() {
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            try {
                const { text, path } = await fetchFirstAvailable();
                const { records, skipped } = toRecords(parseCsv(text));
                store.records = records;
                store.grid = buildGrid(records);
                store.count = records.length;
                store.skipped = skipped;
                store.source = path;
                store.loaded = true;
                store.error = null;
            } catch (err) {
                store.records = [];
                store.grid = new Map();
                store.count = 0;
                store.loaded = false;
                store.error = err.message || 'Civic demonstration data unavailable.';
            }
            return status();
        })();

        return loadPromise;
    }

    function status() {
        return {
            loaded: store.loaded,
            count: store.count,
            skipped: store.skipped,
            source: store.source,
            error: store.error,
            synthetic: true,
        };
    }

    function allRecords() {
        return store.records;
    }

    function metersToLatDeg(meters) {
        return meters / 110540;
    }

    function metersToLngDeg(meters, atLat) {
        const scale = Math.cos((atLat || 0) * Math.PI / 180) * 111320;
        return meters / Math.max(1, scale);
    }

    function collectCells(minLat, minLng, maxLat, maxLng, out) {
        const gx0 = Math.floor(minLat / CELL_DEG);
        const gx1 = Math.floor(maxLat / CELL_DEG);
        const gy0 = Math.floor(minLng / CELL_DEG);
        const gy1 = Math.floor(maxLng / CELL_DEG);
        for (let gx = gx0; gx <= gx1; gx++) {
            for (let gy = gy0; gy <= gy1; gy++) {
                out.add(`${gx}:${gy}`);
            }
        }
    }

    /**
     * Spatial pre-filter for one route. Walks the actual route geometry
     * (not a start→destination straight line), expands each segment by
     * the corridor width, and returns only the records in those cells.
     * Precise distance filtering is done by SafeRouteEngine.
     *
     * @param {Array<[number, number]>} geojsonCoords [lng, lat] pairs
     * @param {number} corridorMeters
     */
    function candidatesNearRoute(geojsonCoords, corridorMeters) {
        if (!store.loaded || !geojsonCoords || geojsonCoords.length < 2) return [];

        const cells = new Set();
        const padLat = metersToLatDeg(corridorMeters);

        for (let i = 0; i < geojsonCoords.length - 1; i++) {
            const [lng1, lat1] = geojsonCoords[i];
            const [lng2, lat2] = geojsonCoords[i + 1];
            if (!Number.isFinite(lat1) || !Number.isFinite(lng1)) continue;
            if (!Number.isFinite(lat2) || !Number.isFinite(lng2)) continue;

            const padLng = metersToLngDeg(corridorMeters, (lat1 + lat2) / 2);
            collectCells(
                Math.min(lat1, lat2) - padLat,
                Math.min(lng1, lng2) - padLng,
                Math.max(lat1, lat2) + padLat,
                Math.max(lng1, lng2) + padLng,
                cells
            );
        }

        const seen = new Set();
        const out = [];
        for (const key of cells) {
            const bucket = store.grid.get(key);
            if (!bucket) continue;
            for (const i of bucket) {
                if (seen.has(i)) continue;
                seen.add(i);
                const rec = store.records[i];
                out.push({ complaint: rec, lat: rec.latitude, lng: rec.longitude });
            }
        }
        return out;
    }

    function coverage() {
        return {
            total: store.count,
            withCoords: store.count,
            missingCoords: 0,
            preciseGeoAvailable: store.count > 0,
            synthetic: true,
            demo: true,
        };
    }

    return {
        CELL_DEG,
        CSV_PATHS,
        load,
        status,
        allRecords,
        candidatesNearRoute,
        coverage,
    };
})();
