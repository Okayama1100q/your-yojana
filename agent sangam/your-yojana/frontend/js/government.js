// =============================================================
// government.js — Government Resolution Portal Logic
// =============================================================

(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────
    let complaints = [];
    let stats = {};
    let activeFilters = { priority: '', department: '', status: '', location: '' };
    let searchQuery = '';
    let selectedComplaint = null;
    let isLoading = false;
    let refreshTimer = null;
    let knownDepartments = new Set();

    // ── DOM Refs ───────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const kpiRow = $('kpiRow');
    const tableBody = $('tableBody');
    const drawerOverlay = $('drawerOverlay');
    const complaintDrawer = $('complaintDrawer');
    const drawerContent = $('drawerContent');
    const filterPriority = $('filterPriority');
    const filterStatus = $('filterStatus');
    const filterDept = $('filterDept');
    const filterLocation = $('filterLocation');
    const searchInput = $('searchInput');
    const resultCount = $('resultCount');
    const lastUpdatedEl = $('lastUpdated');
    const confirmModal = $('confirmModal');
    const confirmTitle = $('confirmTitle');
    const confirmBody = $('confirmBody');
    const confirmOk = $('confirmOk');

    // ── Init ───────────────────────────────────────────────────
    async function init() {
        bindEvents();
        await refresh();
        startAutoRefresh();
    }

    // ── Data Loading ───────────────────────────────────────────
    async function refresh() {
        if (isLoading) return;
        isLoading = true;
        showSkeletons();
        try {
            const [statsData, complaintsData] = await Promise.all([
                api.getDashboardStats(),
                api.getComplaints(activeFilters)
            ]);
            stats = statsData;
            complaints = complaintsData.complaints || [];
            collectDepartments();
            renderKPIs(stats);
            populateDeptFilter();
            renderTable();
            updateLastUpdated();
            const badge = $('criticalNavBadge');
            if (badge) badge.textContent = (stats.priority && stats.priority.critical) || 0;
        } catch (err) {
            renderTableError(err.message);
            toast.error(err.message);
        } finally {
            isLoading = false;
        }
    }

    function collectDepartments() {
        complaints.forEach(c => { if (c.department) knownDepartments.add(c.department); });
        if (stats.departments) Object.keys(stats.departments).forEach(d => knownDepartments.add(d));
    }

    function populateDeptFilter() {
        const current = filterDept.value;
        filterDept.innerHTML = '<option value="">All Departments</option>';
        [...knownDepartments].sort().forEach(dept => {
            const opt = document.createElement('option');
            opt.value = dept;
            opt.textContent = dept;
            if (dept === current) opt.selected = true;
            filterDept.appendChild(opt);
        });
    }

    // ── KPI Rendering ──────────────────────────────────────────
    function renderKPIs(s) {
        if (!kpiRow) return;
        const p = s.priority || {};
        const st = s.status || {};
        const cards = [
            { label: 'Total', value: s.total || 0, cls: '' },
            { label: 'Critical', value: p.critical || 0, cls: 'kpi-card__value--critical' },
            { label: 'High', value: p.high || 0, cls: 'kpi-card__value--high' },
            { label: 'Medium', value: p.medium || 0, cls: 'kpi-card__value--medium' },
            { label: 'Low', value: p.low || 0, cls: 'kpi-card__value--low' },
            { label: 'Pending', value: st.pending || 0, cls: '' },
            { label: 'In Progress', value: st.in_progress || 0, cls: 'kpi-card__value--accent' },
            { label: 'Resolved', value: st.resolved || 0, cls: 'kpi-card__value--resolved' },
        ];
        kpiRow.innerHTML = cards.map(c => `
            <div class="kpi-card">
                <div class="kpi-card__label">${c.label}</div>
                <div class="kpi-card__value ${c.cls}">${c.value}</div>
            </div>`
        ).join('');
    }

    // ── Table Rendering ────────────────────────────────────────
    function renderTable() {
        let filtered = complaints;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = complaints.filter(c =>
                (c.description || '').toLowerCase().includes(q) ||
                (c.complaint_id || '').toLowerCase().includes(q) ||
                (c.category || '').toLowerCase().includes(q) ||
                (c.location || '').toLowerCase().includes(q)
            );
        }
        if (resultCount) resultCount.textContent = filtered.length;
        if (!filtered.length) {
            tableBody.innerHTML = emptyStateTable(
                'No complaints match your current filters.',
                'Try adjusting the priority, status, or department filters.'
            );
            return;
        }
        tableBody.innerHTML = filtered.map(renderRow).join('');
        // Bind row click
        filtered.forEach(c => {
            const row = document.getElementById(`row-${c.complaint_id}`);
            if (row) row.addEventListener('click', () => openDrawer(c));
        });
    }

    function renderRow(c) {
        const priorityCls = (c.priority || 'low').toLowerCase();
        const pct = Math.min(100, c.priority_score || 0);
        const barFillCls = `score-mini__bar-fill--${priorityCls}`;
        return `
        <tr id="row-${c.complaint_id}" class="row--${priorityCls}">
            <td>${renderPriorityBadge(c.priority, c.priority_score)}</td>
            <td class="td-id">${escapeHtml(c.complaint_id)}</td>
            <td class="td-desc" title="${escapeHtml(c.description)}">${escapeHtml(truncate(c.description, 68))}</td>
            <td><span class="tag">${escapeHtml(c.category || '—')}</span></td>
            <td class="text-sm" style="color:var(--text-muted)">${escapeHtml(c.location || '—')}</td>
            <td class="text-sm" style="color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(formatDept(c.department))}</td>
            <td>
                <div class="score-mini">
                    <span class="score-mini__num">${Math.round(c.priority_score || 0)}</span>
                    <div class="score-mini__bar">
                        <div class="score-mini__bar-fill ${barFillCls}" style="width:${pct}%"></div>
                    </div>
                </div>
            </td>
            <td>${renderStatusChip(c.status)}</td>
            <td class="text-xs" style="color:var(--text-muted);white-space:nowrap">${formatTimeAgo(c.created_at)}</td>
            <td>
                <button class="btn btn--ghost btn--sm" onclick="event.stopPropagation(); openDrawerById('${c.complaint_id}')">
                    View
                </button>
            </td>
        </tr>`;
    }

    function renderTableError(msg) {
        tableBody.innerHTML = errorStateTable(msg, refresh);
    }

    function showSkeletons() {
        if (kpiRow) kpiRow.innerHTML = skeletonKPIs(8);
        tableBody.innerHTML = skeletonTableRows(10);
    }

    // ── Drawer ─────────────────────────────────────────────────
    async function openDrawer(complaint) {
        selectedComplaint = complaint;
        drawerOverlay.classList.add('drawer-overlay--show');
        document.body.style.overflow = 'hidden';
        renderDrawer(complaint);
    }

    window.openDrawerById = async function (id) {
        try {
            const c = await api.getComplaint(id);
            await openDrawer(c);
        } catch (err) {
            toast.error('Failed to load complaint details.');
        }
    };

    function closeDrawer() {
        drawerOverlay.classList.remove('drawer-overlay--show');
        document.body.style.overflow = '';
        selectedComplaint = null;
    }

    function renderDrawer(c) {
        const reasons = c.priority_reasons || [];
        const maxPoints = reasons.length ? Math.max(...reasons.map(r => r.points), 1) : 30;
        const priorityCls = (c.priority || 'low').toLowerCase();
        const mapFocusUrl = `civic-map.html?focus=${encodeURIComponent(c.complaint_id)}`;

        const nextStatusMap = {
            PENDING: { status: 'ASSIGNED', label: 'ASSIGN', cls: 'action-btn--assign' },
            ASSIGNED: { status: 'IN_PROGRESS', label: 'START WORK', cls: 'action-btn--progress' },
            IN_PROGRESS: { status: 'RESOLVED', label: 'MARK RESOLVED', cls: 'action-btn--resolve' },
            RESOLVED: null
        };
        const nextAction = nextStatusMap[(c.status || 'PENDING').toUpperCase()];

        drawerContent.innerHTML = `
        <!-- Header -->
        <div class="drawer-header">
            <div>
                <div class="drawer-complaint-id">COMPLAINT ${escapeHtml(c.complaint_id)}</div>
                <div style="margin-top:6px">${renderStatusChip(c.status)}</div>
            </div>
            <div class="drawer-header__meta">
                ${renderPriorityBadge(c.priority, c.priority_score)}
                <button class="drawer-close" onclick="closeDrawer()" title="Close">✕</button>
            </div>
        </div>

        <div class="drawer-body">

            <!-- Citizen Report -->
            <div class="drawer-section">
                <div class="drawer-section-title">Citizen Report</div>
                <div class="description-block" style="margin-bottom:14px">${escapeHtml(c.description)}</div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-item__label">Category</div>
                        <div class="info-item__value">${escapeHtml(c.category || '—')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-item__label">Location</div>
                        <div class="info-item__value">${escapeHtml(c.location || '—')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-item__label">Created At</div>
                        <div class="info-item__value">${formatDateLong(c.created_at)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-item__label">Complaint ID</div>
                        <div class="info-item__value text-mono">${escapeHtml(c.complaint_id)}</div>
                    </div>
                </div>
            </div>

            <!-- AI Assessment -->
            <div class="drawer-section">
                <div class="drawer-section-title" style="display:flex;align-items:center;justify-content:space-between">
                    AI Assessment
                    <span class="ai-label">AI-ASSISTED ASSESSMENT</span>
                </div>
                <div class="ai-panel">
                    <div class="ai-summary">
                        <div class="score-circle score-circle--${priorityCls}">
                            <div class="score-circle__num">${Math.round(c.priority_score || 0)}</div>
                            <div class="score-circle__max">/100</div>
                        </div>
                        <div class="ai-meta">
                            <div class="ai-meta__priority">${(c.priority || 'LOW').toUpperCase()} PRIORITY</div>
                            <div class="ai-meta__response">
                                Priority score: <span>${Math.round(c.priority_score || 0)}</span>
                                · Recommended response: <span>${getResponseTime(c.priority)}</span>
                            </div>
                        </div>
                    </div>
                    ${reasons.length ? `
                    <div class="factors-list">
                        <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">Priority Reasons</div>
                        ${reasons.map(r => `
                            <div class="factor-row">
                                <span class="factor-row__name">${escapeHtml(r.factor)}</span>
                                ${renderFactorBar(r.points, maxPoints)}
                                <span class="factor-row__points">+${r.points}</span>
                            </div>`).join('')}
                    </div>` : `<div class="factors-list"><p class="text-sm" style="color:var(--text-muted)">No detailed factors available.</p></div>`}
                </div>
                <p style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5">
                    AI-assisted assessment — advisory only. Officers retain final authority on assignment and resolution.
                </p>
            </div>

            <!-- Department Routing -->
            <div class="drawer-section">
                <div class="drawer-section-title">Department Routing</div>
                <div class="routing-panel">
                    <div class="routing-panel__dept">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        ${escapeHtml(c.department || 'Not assigned')}
                    </div>
                    <div class="routing-panel__reason">
                        Routing reason: Matched to this department from complaint category and issue keywords at intake.
                    </div>
                    <div class="routing-panel__confidence">
                        Confidence: Determined at intake by Routing Agent (stored department shown above).
                    </div>
                </div>
            </div>

            <!-- Civic Map — reuse existing map page -->
            <div class="drawer-section">
                <div class="drawer-section-title">Civic Map</div>
                <div class="map-link-panel">
                    <div class="map-link-panel__loc">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        ${escapeHtml(c.location || 'Location not specified')}
                    </div>
                    <p class="map-link-panel__note">
                        Opens the existing Civic Map and focuses this complaint when location can be geocoded.
                        Personal citizen details are never shown on the public map.
                    </p>
                    <a class="btn btn--outline btn--sm" href="${mapFocusUrl}" target="_blank" rel="noopener">
                        Open on Civic Map →
                    </a>
                </div>
            </div>

            <!-- Status -->
            <div class="drawer-section">
                <div class="drawer-section-title">Status</div>
                ${renderStatusStepper(c.status)}
            </div>

            <!-- Resolution Evidence (UI only — backend not supported yet) -->
            <div class="drawer-section">
                <div class="drawer-section-title">Resolution Evidence</div>
                <div class="evidence-panel" role="region" aria-label="Resolution evidence placeholder">
                    <p class="evidence-panel__banner">
                        Resolution evidence storage requires backend support.
                    </p>
                    <div class="evidence-grid">
                        <div class="evidence-slot">
                            <div class="evidence-slot__label">Before Photo</div>
                            <div class="evidence-slot__empty">No photo</div>
                        </div>
                        <div class="evidence-slot">
                            <div class="evidence-slot__label">After Photo</div>
                            <div class="evidence-slot__empty">No photo</div>
                        </div>
                    </div>
                    <div class="evidence-note-block">
                        <div class="evidence-slot__label">Resolution Note</div>
                        <p class="evidence-note-example">Example: “Road surface repaired and damaged section cleared.”</p>
                    </div>
                    <div class="evidence-actions">
                        <button type="button" class="btn btn--outline btn--sm" onclick="showEvidenceUnavailable()">
                            Upload Resolution Photo
                        </button>
                        <button type="button" class="btn btn--outline btn--sm" onclick="showEvidenceUnavailable()">
                            Add Resolution Note
                        </button>
                    </div>
                </div>
            </div>

        </div>

        <!-- Action Panel -->
        <div class="drawer-actions">
            ${nextAction ? `
                <button class="action-btn ${nextAction.cls}" id="actionBtn" onclick="handleStatusUpdate('${c.complaint_id}', '${nextAction.status}', '${nextAction.label}')">
                    ${nextAction.label}
                </button>` :
                `<div style="flex:1;font-size:12.5px;color:var(--low-text);font-weight:600">✓ RESOLVED</div>`
            }
            <button class="btn btn--ghost btn--sm" onclick="closeDrawer()">Close</button>
        </div>`;
    }

    window.showEvidenceUnavailable = function () {
        toast.info('Resolution evidence storage requires backend support. This UI is ready for future integration.');
    };

    function getResponseTime(priority) {
        const map = { CRITICAL: '24 hours', HIGH: '48 hours', MEDIUM: '72 hours', LOW: '5 days' };
        return map[(priority || '').toUpperCase()] || '—';
    }

    // ── Status Update ──────────────────────────────────────────
    window.handleStatusUpdate = function (complaintId, newStatus, label) {
        showConfirm(
            `Confirm: ${label}`,
            `This will update the status of complaint <strong>${complaintId}</strong> to <strong>${newStatus.replace('_', ' ')}</strong>. This action will be recorded.`,
            async () => {
                const actionBtn = $('actionBtn');
                if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = 'Updating…'; }
                try {
                    const result = await api.updateStatus(complaintId, newStatus);
                    selectedComplaint = result.complaint;
                    renderDrawer(result.complaint);
                    // Update the row in table
                    const rowIdx = complaints.findIndex(c => c.complaint_id === complaintId);
                    if (rowIdx !== -1) complaints[rowIdx] = result.complaint;
                    renderTable();
                    // Refresh stats
                    api.getDashboardStats().then(s => { stats = s; renderKPIs(s); }).catch(() => { });
                    toast.success(`Status updated to ${newStatus.replace('_', ' ')}.`);
                } catch (err) {
                    toast.error(`Failed to update status: ${err.message}`);
                    if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = label; }
                }
            }
        );
    };

    // ── Confirmation Modal ─────────────────────────────────────
    let confirmCallback = null;
    function showConfirm(title, body, onOk) {
        confirmTitle.textContent = title;
        confirmBody.innerHTML = body;
        confirmCallback = onOk;
        confirmModal.classList.add('modal-overlay--show');
    }

    function closeConfirm() {
        confirmModal.classList.remove('modal-overlay--show');
        confirmCallback = null;
    }

    // ── Filters & Search ───────────────────────────────────────
    function bindEvents() {
        // Drawer overlay close
        drawerOverlay.addEventListener('click', e => {
            if (e.target === drawerOverlay) closeDrawer();
        });
        window.closeDrawer = closeDrawer;

        // Filters
        filterPriority.addEventListener('change', () => {
            activeFilters.priority = filterPriority.value;
            refresh();
        });
        filterStatus.addEventListener('change', () => {
            activeFilters.status = filterStatus.value;
            refresh();
        });
        filterDept.addEventListener('change', () => {
            activeFilters.department = filterDept.value;
            refresh();
        });

        // Location search with debounce
        let locationTimer;
        filterLocation.addEventListener('input', () => {
            clearTimeout(locationTimer);
            locationTimer = setTimeout(() => {
                activeFilters.location = filterLocation.value.trim();
                refresh();
            }, 400);
        });

        // General search (client-side)
        let searchTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchQuery = searchInput.value.trim();
                renderTable();
            }, 250);
        });

        // Clear filters
        const clearBtn = $('clearFilters');
        if (clearBtn) clearBtn.addEventListener('click', clearFilters);

        // Refresh button
        const refreshBtn = $('refreshBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', refresh);

        // Confirm modal
        confirmOk.addEventListener('click', () => {
            closeConfirm();
            if (confirmCallback) confirmCallback();
        });
        $('confirmCancel').addEventListener('click', closeConfirm);
        confirmModal.addEventListener('click', e => {
            if (e.target === confirmModal) closeConfirm();
        });

        // Sidebar nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function () {
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-item--active'));
                this.classList.add('nav-item--active');
            });
        });
    }

    function clearFilters() {
        activeFilters = { priority: '', department: '', status: '', location: '' };
        searchQuery = '';
        filterPriority.value = '';
        filterStatus.value = '';
        filterDept.value = '';
        filterLocation.value = '';
        searchInput.value = '';
        refresh();
    }

    // ── Auto Refresh ───────────────────────────────────────────
    function startAutoRefresh() {
        refreshTimer = setInterval(() => {
            if (!selectedComplaint) refresh();
        }, 30000);
    }

    // ── Last Updated ───────────────────────────────────────────
    function updateLastUpdated() {
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            });
        }
    }

    // ── Boot ───────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

})();
