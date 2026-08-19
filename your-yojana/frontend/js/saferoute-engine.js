// =============================================================
// saferoute-engine.js — Civic-infrastructure route comparison
// Pure logic. No DOM. No fabricated coordinates or AI replies.
//
// Future data flow (when the backend stores lat/lng):
//   GET /complaints
//     → extract coordinates already on the record
//     → keep complaints within CORRIDOR_METERS of each polyline
//     → filter by category relevance weights
//     → weight by status + existing priority / priority_score
//     → civic safety indicator
//     → SafeRoute Agent input (not called until backend exists)
//
// Do NOT implement or fake the SafeRoute Agent here.
// =============================================================

const SafeRouteEngine = (() => {
    const CORRIDOR_METERS = 250;
    const HOTSPOT_RADIUS_METERS = 300;
    const MIN_HOTSPOT_COUNT = 2;
    const RELEVANCE_THRESHOLD = 0.5;

    // Extensible category relevance. Higher = more route-relevant.
    // Garbage / water supply are intentionally lower, not ignored.
    const CATEGORY_WEIGHTS = [
        { weight: 1.00, labels: ['streetlight', 'street light', 'street lighting', 'lighting'] },
        { weight: 0.95, labels: ['pothole', 'road damage', 'road', 'roads', 'footpath', 'street'] },
        { weight: 0.90, labels: ['electrical', 'electricity', 'power', 'wire', 'transformer'] },
        { weight: 0.85, labels: ['drainage', 'drain', 'flooding', 'flood', 'waterlogging', 'sewage'] },
        { weight: 0.70, labels: ['traffic signal', 'traffic', 'signal'] },
        { weight: 0.65, labels: ['public infrastructure', 'infrastructure'] },
        { weight: 0.35, labels: ['water supply', 'drinking water', 'water'] },
        { weight: 0.25, labels: ['garbage', 'sanitation', 'waste'] },
    ];

    // Anything at or above RELEVANCE_THRESHOLD counts as a route-relevant
    // report. Lower-weight categories (garbage, water supply) are kept as
    // contextual: still shown, but they never dominate the indicator.
    const CONTEXTUAL_MIN_WEIGHT = 0.05;

    // Display grouping for the score breakdown. Order matters for the UI.
    const BREAKDOWN_GROUPS = [
        { key: 'streetlight',    label: 'Streetlight reports',      match: ['streetlight', 'street light', 'lighting'] },
        { key: 'road',           label: 'Road / pothole reports',   match: ['road damage', 'pothole', 'road', 'footpath'] },
        { key: 'electrical',     label: 'Electrical hazards',       match: ['electrical', 'electricity', 'power'] },
        { key: 'water',          label: 'Drainage / flooding',      match: ['drainage', 'drain', 'flooding', 'flood', 'waterlogging'] },
        { key: 'traffic',        label: 'Traffic signal reports',   match: ['traffic signal', 'traffic'] },
        { key: 'infrastructure', label: 'Public infrastructure',    match: ['public infrastructure', 'infrastructure'] },
    ];

    const STATUS_WEIGHTS = {
        PENDING: 1.0,
        ASSIGNED: 0.9,
        IN_PROGRESS: 0.6,
        RESOLVED: 0.0, // historical context only — not an active concern
    };

    const PRIORITY_WEIGHTS = {
        CRITICAL: 1.0,
        HIGH: 0.75,
        MEDIUM: 0.4,
        LOW: 0.2,
    };

    const UNRESOLVED_STATUSES = new Set(['PENDING', 'ASSIGNED', 'IN_PROGRESS']);

    function categoryWeight(complaint) {
        const hay = [
            complaint.category,
            complaint.department,
            complaint.description,
        ].filter(Boolean).join(' ').toLowerCase();

        let best = 0;
        for (const rule of CATEGORY_WEIGHTS) {
            if (rule.labels.some(label => hay.includes(label))) {
                best = Math.max(best, rule.weight);
            }
        }
        return best;
    }

    function isRelevant(complaint) {
        return categoryWeight(complaint) >= RELEVANCE_THRESHOLD;
    }

    /** Lower-weight civic categories: reported, but not treated as route hazards. */
    function isContextual(complaint) {
        const w = categoryWeight(complaint);
        return w >= CONTEXTUAL_MIN_WEIGHT && w < RELEVANCE_THRESHOLD;
    }

    function breakdownGroup(complaint) {
        const hay = [complaint.category, complaint.department]
            .filter(Boolean).join(' ').toLowerCase();
        for (const group of BREAKDOWN_GROUPS) {
            if (group.match.some(label => hay.includes(label))) return group;
        }
        return { key: 'other', label: 'Other relevant issues' };
    }

    function statusWeight(status) {
        return STATUS_WEIGHTS[String(status || '').toUpperCase()] ?? 0;
    }

    function priorityLevelWeight(priority) {
        return PRIORITY_WEIGHTS[String(priority || '').toUpperCase()] ?? PRIORITY_WEIGHTS.LOW;
    }

    function priorityMagnitude(complaint) {
        const score = Number(complaint.priority_score);
        if (Number.isFinite(score) && score >= 0) {
            return Math.min(1, Math.max(0, score / 100));
        }
        return priorityLevelWeight(complaint.priority);
    }

    function isHighOrCritical(complaint) {
        const p = String(complaint.priority || '').toUpperCase();
        return p === 'HIGH' || p === 'CRITICAL';
    }

    function isUnresolved(complaint) {
        return UNRESOLVED_STATUSES.has(String(complaint.status || '').toUpperCase());
    }

    /**
     * Only explicit coordinates already on the complaint record.
     * Never geocodes free-text location strings — those are not
     * precise enough for route-corridor analysis.
     */
    function extractCoords(complaint) {
        if (!complaint || typeof complaint !== 'object') return null;

        const lat = firstFinite(
            complaint.latitude,
            complaint.lat,
            complaint.geo?.lat,
            complaint.coordinates?.lat
        );
        const lng = firstFinite(
            complaint.longitude,
            complaint.lng,
            complaint.lon,
            complaint.geo?.lng,
            complaint.geo?.lon,
            complaint.coordinates?.lng,
            complaint.coordinates?.lon
        );

        if (lat == null || lng == null) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return { lat, lng };
    }

    function firstFinite(...values) {
        for (const v of values) {
            const n = typeof v === 'string' ? parseFloat(v) : v;
            if (Number.isFinite(n)) return n;
        }
        return null;
    }

    function complaintsWithCoords(complaints) {
        return (complaints || []).map(c => {
            const coords = extractCoords(c);
            return coords ? { complaint: c, ...coords } : null;
        }).filter(Boolean);
    }

    function geoCoverage(complaints) {
        const total = (complaints || []).length;
        const withCoords = complaintsWithCoords(complaints).length;
        return {
            total,
            withCoords,
            missingCoords: Math.max(0, total - withCoords),
            preciseGeoAvailable: withCoords > 0,
        };
    }

    function haversineMeters(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    function pointToSegmentMeters(px, py, ax, ay, bx, by) {
        const toXY = (lat, lng) => {
            const x = lng * Math.cos(lat * Math.PI / 180) * 111320;
            const y = lat * 110540;
            return { x, y };
        };
        const P = toXY(px, py);
        const A = toXY(ax, ay);
        const B = toXY(bx, by);
        const abx = B.x - A.x;
        const aby = B.y - A.y;
        const apx = P.x - A.x;
        const apy = P.y - A.y;
        const ab2 = abx * abx + aby * aby;
        const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
        const cx = A.x + t * abx;
        const cy = A.y + t * aby;
        const dx = P.x - cx;
        const dy = P.y - cy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function distanceToPolylineMeters(lat, lng, geojsonCoords) {
        if (!geojsonCoords || geojsonCoords.length < 2) return Infinity;
        let min = Infinity;
        for (let i = 0; i < geojsonCoords.length - 1; i++) {
            const [lng1, lat1] = geojsonCoords[i];
            const [lng2, lat2] = geojsonCoords[i + 1];
            const d = pointToSegmentMeters(lat, lng, lat1, lng1, lat2, lng2);
            if (d < min) min = d;
        }
        return min;
    }

    function concernContribution(complaint) {
        return categoryWeight(complaint)
            * statusWeight(complaint.status)
            * priorityMagnitude(complaint);
    }

    // Points removed from 100 per unit of weighted concern, where one report
    // contributes categoryWeight × statusWeight × priorityMagnitude. Totals
    // are used (not a per-km average) because a longer route genuinely exposes
    // a traveller to more reported issues.
    const PENALTY_POINTS_PER_CONCERN = 0.65;

    function civicIndicatorFromConcern(totalConcern, routeKm) {
        const km = Math.max(0.1, routeKm || 0.1);
        const penalty = Math.min(100, totalConcern * PENALTY_POINTS_PER_CONCERN);
        return {
            indicator: Math.max(0, Math.min(100, Math.round(100 - penalty))),
            penalty: Math.round(penalty * 10) / 10,
            concern: Math.round(totalConcern * 100) / 100,
            concernPerKm: Math.round((totalConcern / km) * 100) / 100,
        };
    }

    /**
     * Analyses one route against candidate complaints.
     * `candidates` are {complaint, lat, lng} items already narrowed by a
     * spatial pre-filter; exact corridor distance is measured here against
     * the real route geometry (never a start→destination straight line).
     */
    function analyzeRoute(route, candidates, coverage) {
        const empty = {
            nearbyRelevant: [],
            nearbyContextual: [],
            nearbyHistorical: [],
            relevantCount: null,
            unresolvedCount: null,
            highCriticalCount: null,
            contextualCount: null,
            resolvedCount: null,
            breakdown: [],
            civicIndicator: null,
            penalty: null,
            civicAvailable: false,
            unavailableReason: coverage && coverage.preciseGeoAvailable
                ? null
                : 'Civic demonstration data unavailable.',
        };

        if (!coverage || !coverage.preciseGeoAvailable) return empty;

        const relevant = [];
        const contextual = [];

        for (const item of candidates || []) {
            const relevantHit = isRelevant(item.complaint);
            const contextualHit = !relevantHit && isContextual(item.complaint);
            if (!relevantHit && !contextualHit) continue;

            const meters = distanceToPolylineMeters(item.lat, item.lng, route.coordinates);
            if (meters > CORRIDOR_METERS) continue;

            const decorated = {
                ...item.complaint,
                _lat: item.lat,
                _lng: item.lng,
                _distance_m: Math.round(meters),
                _category_weight: categoryWeight(item.complaint),
            };
            if (relevantHit) relevant.push(decorated);
            else contextual.push(decorated);
        }

        const unresolved = relevant.filter(isUnresolved);
        const historical = relevant.filter(c => !isUnresolved(c));

        // Only unresolved relevant reports drive the score. Resolved records
        // are kept for context and contribute no active penalty.
        let concern = 0;
        const groupTotals = new Map();

        for (const c of unresolved) {
            const contribution = concernContribution(c);
            concern += contribution;
            const group = breakdownGroup(c);
            const entry = groupTotals.get(group.key)
                || { key: group.key, label: group.label, count: 0, concern: 0, highCritical: 0 };
            entry.count += 1;
            entry.concern += contribution;
            if (isHighOrCritical(c)) entry.highCritical += 1;
            groupTotals.set(group.key, entry);
        }

        const routeKm = (route.distanceMeters || 0) / 1000;
        const scored = civicIndicatorFromConcern(concern, routeKm);

        const breakdown = [...groupTotals.values()]
            .map(entry => ({
                ...entry,
                concern: Math.round(entry.concern * 100) / 100,
                points: Math.round(entry.concern * PENALTY_POINTS_PER_CONCERN * 10) / 10,
            }))
            .sort((a, b) => b.points - a.points || b.count - a.count);

        return {
            nearbyRelevant: relevant,
            nearbyContextual: contextual,
            nearbyHistorical: historical,
            relevantCount: relevant.length,
            unresolvedCount: unresolved.length,
            highCriticalCount: unresolved.filter(isHighOrCritical).length,
            contextualCount: contextual.length,
            resolvedCount: historical.length,
            breakdown,
            civicIndicator: scored.indicator,
            penalty: scored.penalty,
            concern: scored.concern,
            concernPerKm: scored.concernPerKm,
            civicAvailable: true,
            unavailableReason: null,
        };
    }

    /**
     * Clusters already route-filtered complaints. Callers must pass the
     * near-route subset, not the whole dataset — this is O(n²) by design
     * and is only meaningful for complaints along the compared routes.
     *
     * @param {Array<{lat:number,lng:number,complaint:object}>} items
     */
    function identifyHotspots(items) {
        const points = (items || [])
            .filter(item => item && Number.isFinite(item.lat) && Number.isFinite(item.lng))
            .filter(item => isRelevant(item.complaint) && isUnresolved(item.complaint));

        const used = new Set();
        const clusters = [];

        for (let i = 0; i < points.length; i++) {
            if (used.has(i)) continue;
            const members = [points[i]];
            used.add(i);
            for (let j = i + 1; j < points.length; j++) {
                if (used.has(j)) continue;
                const d = haversineMeters(
                    points[i].lat, points[i].lng,
                    points[j].lat, points[j].lng
                );
                if (d <= HOTSPOT_RADIUS_METERS) {
                    members.push(points[j]);
                    used.add(j);
                }
            }
            if (members.length >= MIN_HOTSPOT_COUNT) {
                const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
                const lng = members.reduce((s, m) => s + m.lng, 0) / members.length;
                clusters.push({
                    count: members.length,
                    lat,
                    lng,
                    radiusMeters: HOTSPOT_RADIUS_METERS,
                    categories: [...new Set(members.map(m => m.complaint.category).filter(Boolean))],
                });
            }
        }
        return clusters;
    }

    function formatDuration(seconds) {
        if (!Number.isFinite(seconds)) return 'Data unavailable.';
        const mins = Math.round(seconds / 60);
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m ? `${h} hr ${m} min` : `${h} hr`;
    }

    function formatKm(meters) {
        if (!Number.isFinite(meters)) return 'Data unavailable.';
        return `${(meters / 1000).toFixed(1)} km`;
    }

    function durationMinutes(route) {
        return Math.round((route.durationSeconds || 0) / 60);
    }

    // Each extra minute over the fastest route costs this many time points.
    // An absolute scale is used deliberately: normalising across the min-max
    // span would turn a few seconds' difference into a full-range swing.
    const TIME_POINTS_PER_MINUTE = 4;

    function combinedScore(route, minDuration) {
        const civic = route.analysis?.civicIndicator;
        if (civic == null) return null;
        const extraMinutes = Math.max(0, (route.durationSeconds - minDuration) / 60);
        const timeScore = Math.max(0, 100 - extraMinutes * TIME_POINTS_PER_MINUTE);
        return 0.55 * civic + 0.45 * timeScore;
    }

    function recommend(routes, preference, coverage) {
        if (!routes.length) {
            return { recommendedId: null, reason: 'No routes were returned.', confidence: 0 };
        }

        const pref = preference || 'BALANCED';
        const minD = Math.min(...routes.map(r => r.durationSeconds));
        const fastest = routes.reduce((a, b) => a.durationSeconds <= b.durationSeconds ? a : b);

        if (pref === 'CIVIC_SAFETY' && !coverage.preciseGeoAvailable) {
            return {
                recommendedId: fastest.id,
                reason: `Civic demonstration data is unavailable, so no civic comparison could be made. ${fastest.label} is shown as the shortest travel time only.`,
                confidence: 0,
                missingData: true,
            };
        }

        if (pref === 'FASTEST' || (!coverage.preciseGeoAvailable && pref === 'BALANCED')) {
            return {
                recommendedId: fastest.id,
                reason: coverage.preciseGeoAvailable
                    ? `${fastest.label} has the shortest travel time among the returned alternatives.`
                    : `${fastest.label} has the shortest travel time. Civic demonstration data is unavailable, so civic indicators were not calculated.`,
                confidence: coverage.preciseGeoAvailable ? 0.7 : 0.5,
                missingData: !coverage.preciseGeoAvailable,
            };
        }

        if (pref === 'CIVIC_SAFETY') {
            const ranked = [...routes].sort((a, b) => {
                const ci = (b.analysis.civicIndicator ?? -1) - (a.analysis.civicIndicator ?? -1);
                if (ci !== 0) return ci;
                return a.durationSeconds - b.durationSeconds;
            });
            const pick = ranked[0];
            return {
                recommendedId: pick.id,
                reason: `${pick.label} has the strongest available civic safety indicators among the compared routes.`,
                confidence: 0.75,
                missingData: false,
            };
        }

        // BALANCED with civic geo
        const ranked = [...routes].sort((a, b) => {
            const sa = combinedScore(a, minD) ?? 0;
            const sb = combinedScore(b, minD) ?? 0;
            return sb - sa;
        });
        const pick = ranked[0];
        const deltaMin = Math.abs(durationMinutes(pick) - durationMinutes(fastest));
        let reason;
        if (pick.id === fastest.id) {
            reason = `${pick.label} has both the shortest travel time and strong civic indicators.`;
        } else if (deltaMin === 0) {
            reason = `${pick.label} has stronger civic indicators with effectively the same travel time as the fastest option.`;
        } else {
            reason = `${pick.label} provides the strongest combination of available civic safety indicators and reasonable travel time (${deltaMin} min slower than the fastest option).`;
        }
        return {
            recommendedId: pick.id,
            reason,
            confidence: 0.7,
            missingData: false,
        };
    }

    function explainRoute(route, allRoutes, recommendedId, coverage) {
        const rec = route.id === recommendedId;
        const fastest = allRoutes.reduce((a, b) => a.durationSeconds <= b.durationSeconds ? a : b);
        const isFastest = route.id === fastest.id;
        const analysis = route.analysis || {};

        if (!coverage.preciseGeoAvailable) {
            if (isFastest) {
                return rec
                    ? 'Shortest travel time among returned routes. Civic indicators are unavailable.'
                    : 'Travel time is available. Civic demonstration data is unavailable.';
            }
            const extra = durationMinutes(route) - durationMinutes(fastest);
            return extra > 0
                ? `${extra} min slower than the fastest route. Civic indicators are unavailable.`
                : 'Travel information is available. Civic indicators are unavailable.';
        }

        const parts = [];
        if (analysis.unresolvedCount === 0) {
            parts.push('Fewer unresolved relevant civic reports nearby.');
        } else {
            parts.push(`${analysis.unresolvedCount} unresolved relevant civic report(s) nearby.`);
        }
        if (analysis.highCriticalCount === 0) {
            parts.push('No high or critical safety-related reports nearby.');
        } else {
            parts.push(`${analysis.highCriticalCount} high or critical report(s) nearby.`);
        }
        if (isFastest) parts.push('Fastest travel time.');
        else {
            const extra = durationMinutes(route) - durationMinutes(fastest);
            if (extra > 0) parts.push(`${extra} min longer than the fastest route.`);
        }
        return parts.join(' ');
    }

    function buildWhyRecommended(routes, recommendedId, coverage) {
        const rec = routes.find(r => r.id === recommendedId);
        const fastest = routes.reduce((a, b) => a.durationSeconds <= b.durationSeconds ? a : b);
        if (!rec) {
            return {
                advantages: [],
                tradeoffs: [],
                summary: coverage.preciseGeoAvailable
                    ? 'No recommendation was produced.'
                    : 'Civic demonstration data unavailable. Routes are compared on travel information only.',
            };
        }

        const advantages = [];
        const tradeoffs = [];
        const a = rec.analysis || {};

        if (rec.id === fastest.id && routes.length > 1) {
            advantages.push('Shortest travel time among the returned alternatives');
        }

        if (coverage.preciseGeoAvailable) {
            const minUnresolved = Math.min(...routes.map(r => r.analysis.unresolvedCount ?? Infinity));
            if (a.unresolvedCount === minUnresolved) {
                advantages.push('Fewer unresolved relevant civic reports');
            }
            if (a.highCriticalCount === 0) {
                advantages.push('No high or critical safety-related reports nearby');
            }
            const minHigh = Math.min(...routes.map(r => r.analysis.highCriticalCount ?? Infinity));
            if (a.highCriticalCount === minHigh && a.highCriticalCount > 0) {
                advantages.push('Fewer high-priority infrastructure complaints along the corridor');
            }
        }

        if (rec.id !== fastest.id) {
            const extra = durationMinutes(rec) - durationMinutes(fastest);
            tradeoffs.push(extra > 0
                ? `${fastest.label} is ${extra} minute${extra === 1 ? '' : 's'} faster.`
                : `${fastest.label} is marginally faster (under a minute).`);
            if (coverage.preciseGeoAvailable) {
                const fb = fastest.analysis;
                if ((fb.unresolvedCount ?? 0) > (a.unresolvedCount ?? 0)) {
                    tradeoffs.push(`${fastest.label} has more unresolved relevant civic reports along the route.`);
                }
            }
        } else if (coverage.preciseGeoAvailable) {
            const slowerCivic = routes
                .filter(r => r.id !== rec.id)
                .sort((x, y) => (y.analysis.civicIndicator ?? 0) - (x.analysis.civicIndicator ?? 0))[0];
            if (slowerCivic && (slowerCivic.analysis.civicIndicator ?? 0) > (a.civicIndicator ?? 0)) {
                tradeoffs.push(`${slowerCivic.label} has a higher civic indicator but a longer travel time.`);
            }
        }

        if (!coverage.preciseGeoAvailable) {
            tradeoffs.push('Civic demonstration data unavailable, so civic indicators were not calculated.');
        }

        if (!advantages.length) advantages.push('Reasonable travel time among the returned alternatives');

        let summary;
        if (!coverage.preciseGeoAvailable) {
            summary = `${rec.label} is recommended from travel information only. Civic demonstration data is unavailable.`;
        } else {
            const bestCivic = routes.reduce((x, y) =>
                (y.analysis.civicIndicator ?? -1) > (x.analysis.civicIndicator ?? -1) ? y : x);
            summary = bestCivic.id === rec.id
                ? `Based on available synthetic civic demonstration data, ${rec.label} provides the stronger combination of civic indicators and travel time.`
                : `${rec.label} is recommended on travel time. Based on available synthetic civic demonstration data, ${bestCivic.label} has the higher civic indicator (${bestCivic.analysis.civicIndicator} vs ${a.civicIndicator}).`;
        }

        return { advantages, tradeoffs, summary };
    }

    /**
     * Payload for a future SafeRoute Agent.
     * Never sent to a model from this file.
     */
    function buildAgentInput(routes, coverage, preference) {
        return {
            preference,
            data_used: {
                travel: 'OSRM driving alternatives',
                civic: 'synthetic_chennai_civic_complaints.csv (synthetic demonstration data)',
                identity: 'not used',
                crime: 'not used',
                iot: 'not used',
            },
            synthetic_data: true,
            data_missing: coverage.preciseGeoAvailable
                ? []
                : ['synthetic civic dataset unavailable'],
            geo_coverage: coverage,
            routes: routes.map(r => ({
                id: r.id,
                label: r.label,
                time_seconds: r.durationSeconds,
                distance_meters: r.distanceMeters,
                nearby_complaints: (r.analysis?.nearbyRelevant || []).map(c => ({
                    complaint_id: c.complaint_id,
                    category: c.category,
                    priority: c.priority,
                    priority_score: c.priority_score,
                    status: c.status,
                    distance_m: c._distance_m,
                })),
                civic_indicator: r.analysis?.civicIndicator,
                relevant_reports: r.analysis?.relevantCount,
                unresolved: r.analysis?.unresolvedCount,
                high_critical: r.analysis?.highCriticalCount,
                contextual_reports: r.analysis?.contextualCount,
                breakdown: r.analysis?.breakdown,
            })),
            expected_output: {
                recommended_route: 'string',
                reason: 'string',
                advantages: ['string'],
                tradeoffs: ['string'],
                confidence: 'number',
            },
        };
    }

    /**
     * @param {Array} routes
     * @param {Object} options
     * @param {Function} options.candidateProvider (route) => [{complaint, lat, lng}]
     * @param {Object}   options.coverage          dataset availability summary
     */
    function attachAnalyses(routes, options = {}) {
        const coverage = options.coverage
            || { total: 0, withCoords: 0, missingCoords: 0, preciseGeoAvailable: false };

        const provide = typeof options.candidateProvider === 'function'
            ? options.candidateProvider
            : () => [];

        const analysed = routes.map(route => {
            let candidates = [];
            try {
                candidates = provide(route) || [];
            } catch (_) {
                candidates = [];
            }
            return { ...route, analysis: analyzeRoute(route, candidates, coverage) };
        });

        // Hotspots are computed only from complaints already matched to a
        // route, never from a full-dataset scan.
        const seen = new Set();
        const nearRoute = [];
        for (const route of analysed) {
            for (const c of route.analysis.nearbyRelevant || []) {
                if (seen.has(c.complaint_id)) continue;
                seen.add(c.complaint_id);
                nearRoute.push({ lat: c._lat, lng: c._lng, complaint: c });
            }
        }

        return { routes: analysed, coverage, hotspots: identifyHotspots(nearRoute) };
    }

    return {
        CORRIDOR_METERS,
        HOTSPOT_RADIUS_METERS,
        PENALTY_POINTS_PER_CONCERN,
        CATEGORY_WEIGHTS,
        STATUS_WEIGHTS,
        PRIORITY_WEIGHTS,
        extractCoords,
        geoCoverage,
        complaintsWithCoords,
        isRelevant,
        isContextual,
        breakdownGroup,
        attachAnalyses,
        recommend,
        explainRoute,
        buildWhyRecommended,
        buildAgentInput,
        formatDuration,
        formatKm,
        durationMinutes,
        identifyHotspots,
        // Explicitly unimplemented — do not fake a model call.
        async runAgent() {
            throw new Error('SafeRoute Agent is not implemented. A backend extension is required.');
        },
    };
})();
