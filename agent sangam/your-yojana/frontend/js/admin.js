// =============================================================
// admin.js — Admin & Governance Portal Logic
// =============================================================

(function () {
    'use strict';

    let stats = {};
    let complaints = [];
    let searchQuery = '';
    let charts = {};
    let selectedSection = 'overview';
    let detailComplaint = null;

    const $ = id => document.getElementById(id);

    // ── Init ───────────────────────────────────────────────────
    async function init() {
        bindNav();
        bindEvents();
        await loadAll();
    }

    // ── Data Loading ───────────────────────────────────────────
    async function loadAll() {
        showLoadingState();
        try {
            const [statsData, complaintsData] = await Promise.all([
                api.getDashboardStats(),
                api.getComplaints()
            ]);
            stats = statsData;
            complaints = complaintsData.complaints || [];
            renderAll();
        } catch (err) {
            showErrorState(err.message);
            toast.error(err.message);
        }
    }

    async function refresh() {
        await loadAll();
        toast.info('Data refreshed.');
    }
    window.adminApp = { refresh };

    function showLoadingState() {
        const kpiEl = $('adminKpiRow');
        if (kpiEl) kpiEl.innerHTML = skeletonKPIs(6);
    }

    function showErrorState(msg) {
        const kpiEl = $('adminKpiRow');
        if (kpiEl) kpiEl.innerHTML = `<div style="padding:24px;color:var(--critical-text);font-size:13px">⚠ ${msg}</div>`;
    }

    // ── Render All ─────────────────────────────────────────────
    function renderAll() {
        renderOverviewKPIs();
        renderDeptSection();
        renderPrioritySection();
        renderResolutionAnalytics();
        renderInfrastructureOverview();
        renderComplaintTable();
        updateSystemHealth();
    }

    // ── Resolution Analytics (real stats only) ─────────────────
    function renderResolutionAnalytics() {
        const kpiEl = $('resolutionKpiRow');
        const funnelEl = $('resolutionFunnel');
        if (!kpiEl && !funnelEl) return;

        const s = stats.status || {};
        const total = stats.total || 0;
        const pending = s.pending || 0;
        const assigned = s.assigned || 0;
        const inProgress = s.in_progress || 0;
        const resolved = s.resolved || 0;
        const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

        if (kpiEl) {
            kpiEl.innerHTML = [
                { label: 'Pending', value: pending },
                { label: 'Assigned', value: assigned },
                { label: 'In Progress', value: inProgress },
                { label: 'Resolved', value: resolved, cls: 'admin-kpi--success' },
                { label: 'Resolution Rate', value: rate + '%', cls: 'admin-kpi--blue' },
            ].map(c => `
                <div class="admin-kpi ${c.cls || ''}">
                    <div class="admin-kpi__label">${c.label}</div>
                    <div class="admin-kpi__value">${c.value}</div>
                </div>`).join('');
        }

        if (funnelEl) {
            const steps = [
                { label: 'PENDING', count: pending },
                { label: 'ASSIGNED', count: assigned },
                { label: 'IN PROGRESS', count: inProgress },
                { label: 'RESOLVED', count: resolved },
            ];
            const max = Math.max(...steps.map(x => x.count), 1);
            funnelEl.innerHTML = steps.map(step => `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                    <div style="width:110px;font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--text-muted)">${step.label}</div>
                    <div style="flex:1;height:8px;background:var(--border-subtle);border-radius:4px;overflow:hidden">
                        <div style="width:${Math.round((step.count / max) * 100)}%;height:100%;background:rgba(91,156,246,0.55)"></div>
                    </div>
                    <div style="width:40px;text-align:right;font-size:13px;font-weight:600;color:var(--text-primary)">${step.count}</div>
                </div>`).join('');
        }
    }

    // ── Infrastructure Overview (from complaint list) ──────────
    function renderInfrastructureOverview() {
        const catEl = $('infraCategoryList');
        const locEl = $('infraLocationList');
        if (!catEl && !locEl) return;

        const catMap = {};
        const locMap = {};
        complaints.forEach(c => {
            const cat = c.category || 'Other';
            catMap[cat] = (catMap[cat] || 0) + 1;
            const loc = (c.location || '').trim();
            if (loc) locMap[loc] = (locMap[loc] || 0) + 1;
        });

        const renderBars = (map, emptyMsg) => {
            const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
            if (!sorted.length) return `<p class="text-sm" style="color:var(--text-muted)">${emptyMsg}</p>`;
            const max = sorted[0][1] || 1;
            return sorted.map(([name, count]) => `
                <div style="margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
                        <span style="color:var(--text-secondary)">${escapeHtml(name)}</span>
                        <span style="color:var(--text-muted)">${count}</span>
                    </div>
                    <div style="height:5px;background:var(--border-subtle);border-radius:3px;overflow:hidden">
                        <div style="width:${Math.round((count / max) * 100)}%;height:100%;background:rgba(91,156,246,0.55)"></div>
                    </div>
                </div>`).join('');
        };

        if (catEl) catEl.innerHTML = renderBars(catMap, 'No category data available.');
        if (locEl) locEl.innerHTML = renderBars(locMap, 'No location data available.');
    }

    // ── Overview KPIs ──────────────────────────────────────────
    function renderOverviewKPIs() {
        const el = $('adminKpiRow');
        if (!el) return;
        const p = stats.priority || {};
        const s = stats.status  || {};
        const total    = stats.total || 0;
        const resolved = s.resolved || 0;
        const rate     = total > 0 ? Math.round((resolved / total) * 100) : 0;

        const cards = [
            { label: 'Total Complaints', value: total,              cls: '' },
            { label: 'Critical',         value: p.critical || 0,   cls: 'admin-kpi--critical', sub: 'Immediate action' },
            { label: 'High Priority',    value: p.high || 0,       cls: 'admin-kpi--high',     sub: '48h response' },
            { label: 'Pending',          value: s.pending || 0,    cls: '',                     sub: 'Awaiting action' },
            { label: 'In Progress',      value: s.in_progress || 0, cls: 'admin-kpi--blue',    sub: 'Being resolved' },
            { label: 'Resolved',         value: resolved,           cls: 'admin-kpi--success',  sub: `${rate}% rate` },
        ];
        el.innerHTML = cards.map(c => `
            <div class="admin-kpi ${c.cls}">
                <div class="admin-kpi__label">${c.label}</div>
                <div class="admin-kpi__value">${c.value}</div>
                ${c.sub ? `<div class="admin-kpi__sub">${c.sub}</div>` : ''}
            </div>`
        ).join('');
    }

    // ── Department Section ─────────────────────────────────────
    function renderDeptSection() {
        renderDeptTable();
        renderDeptChart();
    }

    function renderDeptTable() {
        const el = $('deptTableBody');
        if (!el) return;
        const depts = stats.departments || {};
        const sorted = Object.entries(depts).sort((a, b) => b[1] - a[1]);
        const maxCount = sorted.length ? sorted[0][1] : 1;

        if (!sorted.length) {
            el.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:24px"><p class="empty-state__sub">No department data available.</p></div></td></tr>`;
            return;
        }

        el.innerHTML = sorted.map(([dept, count]) => {
            const pct = Math.min(100, (count / maxCount) * 100);
            // Count by status for this dept from complaints
            const deptComplaints = complaints.filter(c => c.department === dept);
            const resolved = deptComplaints.filter(c => c.status === 'RESOLVED').length;
            const pending  = deptComplaints.filter(c => c.status === 'PENDING').length;
            return `<tr>
                <td class="dept-table__name">${escapeHtml(dept)}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div class="dept-vol-bar" style="width:120px">
                            <div class="dept-vol-bar__fill" style="width:${pct}%"></div>
                        </div>
                        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${count}</span>
                    </div>
                </td>
                <td>
                    <span style="color:var(--low-text);font-size:12px">${resolved} resolved</span>
                    <span style="color:var(--text-muted);font-size:12px;margin-left:8px">${pending} pending</span>
                </td>
            </tr>`;
        }).join('');
    }

    function renderDeptChart() {
        const canvas = $('deptChart');
        if (!canvas) return;
        const depts = stats.departments || {};
        const sorted = Object.entries(depts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (!sorted.length) return;

        if (charts.dept) { charts.dept.destroy(); }
        charts.dept = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: sorted.map(([d]) => d.replace(' Department', '').replace(' & Highways', '')),
                datasets: [{
                    data: sorted.map(([, v]) => v),
                    backgroundColor: 'rgba(91, 156, 246, 0.25)',
                    borderColor: 'rgba(91, 156, 246, 0.7)',
                    borderWidth: 1,
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false }, tooltip: { ...chartTooltipDefaults() } },
                scales: {
                    x: { ...chartAxisDefaults(), beginAtZero: true, ticks: { color: '#4A6A8A', font: { size: 11 } } },
                    y: { ...chartAxisDefaults(), ticks: { color: '#8FA9C4', font: { size: 11 } } }
                }
            }
        });
    }

    // ── Priority Section ───────────────────────────────────────
    function renderPrioritySection() {
        renderPriorityDonut();
        renderPriorityLegend();
        renderCategoryInsights();
        renderAvgScore();
    }

    function renderPriorityDonut() {
        const canvas = $('priorityDonut');
        if (!canvas) return;
        const p = stats.priority || {};
        const data = [p.critical || 0, p.high || 0, p.medium || 0, p.low || 0];
        const total = data.reduce((a, b) => a + b, 0);
        if (!total) return;

        if (charts.priority) charts.priority.destroy();
        charts.priority = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    data,
                    backgroundColor: [
                        'rgba(192, 57, 43, 0.7)',
                        'rgba(196, 91, 21, 0.7)',
                        'rgba(160, 120, 20, 0.7)',
                        'rgba(26, 122, 68, 0.7)',
                    ],
                    borderColor: [
                        'rgba(192, 57, 43, 0.4)',
                        'rgba(196, 91, 21, 0.4)',
                        'rgba(160, 120, 20, 0.4)',
                        'rgba(26, 122, 68, 0.4)',
                    ],
                    borderWidth: 1,
                    hoverOffset: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { display: false },
                    tooltip: { ...chartTooltipDefaults() }
                }
            }
        });
    }

    function renderPriorityLegend() {
        const el = $('priorityLegend');
        if (!el) return;
        const p = stats.priority || {};
        const total = (p.critical||0) + (p.high||0) + (p.medium||0) + (p.low||0);
        const items = [
            { label: 'Critical', count: p.critical||0, dot: 'rgba(192,57,43,0.8)' },
            { label: 'High',     count: p.high||0,     dot: 'rgba(196,91,21,0.8)' },
            { label: 'Medium',   count: p.medium||0,   dot: 'rgba(160,120,20,0.8)' },
            { label: 'Low',      count: p.low||0,      dot: 'rgba(26,122,68,0.8)' },
        ];
        el.innerHTML = items.map(i => {
            const pct = total ? Math.round((i.count/total)*100) : 0;
            return `<div class="priority-legend-item">
                <div class="priority-legend-item__dot" style="background:${i.dot}"></div>
                <span class="priority-legend-item__label">${i.label}</span>
                <span class="priority-legend-item__count">${i.count} <span style="color:var(--text-muted);font-weight:400">(${pct}%)</span></span>
            </div>`;
        }).join('');
    }

    function renderCategoryInsights() {
        const el = $('categoryInsights');
        if (!el) return;
        if (!complaints.length) {
            el.innerHTML = '<p class="text-sm" style="color:var(--text-muted);padding:8px 0">No data available.</p>';
            return;
        }
        const catMap = {};
        complaints.forEach(c => {
            const cat = c.category || 'Other';
            if (!catMap[cat]) catMap[cat] = { count: 0, totalScore: 0 };
            catMap[cat].count++;
            catMap[cat].totalScore += (c.priority_score || 0);
        });
        const sorted = Object.entries(catMap)
            .map(([k, v]) => ({ cat: k, count: v.count, avg: Math.round(v.totalScore / v.count) }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 6);
        const maxCount = Math.max(...sorted.map(s => s.count), 1);

        el.innerHTML = sorted.map(item => {
            const pct = (item.count / maxCount) * 100;
            let barColor = 'rgba(91,156,246,0.6)';
            if (item.avg >= 80) barColor = 'rgba(192,57,43,0.7)';
            else if (item.avg >= 60) barColor = 'rgba(196,91,21,0.7)';
            else if (item.avg >= 40) barColor = 'rgba(160,120,20,0.7)';
            return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
                    <span style="color:var(--text-secondary)">${escapeHtml(item.cat)}</span>
                    <span style="color:var(--text-muted)">${item.count} complaints · avg ${item.avg}/100</span>
                </div>
                <div style="height:5px;background:var(--border-subtle);border-radius:3px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;transition:width .5s ease"></div>
                </div>
            </div>`;
        }).join('');
    }

    function renderAvgScore() {
        const el = $('avgScoreEl');
        if (!el) return;
        if (!complaints.length) { el.textContent = '—'; return; }
        const avg = complaints.reduce((s, c) => s + (c.priority_score || 0), 0) / complaints.length;
        el.textContent = Math.round(avg) + '/100';
    }

    // ── Complaint Table ─────────────────────────────────────────
    function renderComplaintTable() {
        const tbody = $('adminTableBody');
        if (!tbody) return;
        let filtered = complaints;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = complaints.filter(c =>
                (c.description || '').toLowerCase().includes(q) ||
                (c.complaint_id || '').toLowerCase().includes(q) ||
                (c.category || '').toLowerCase().includes(q) ||
                (c.location || '').toLowerCase().includes(q) ||
                (c.department || '').toLowerCase().includes(q)
            );
        }

        const countEl = $('adminTableCount');
        if (countEl) countEl.textContent = filtered.length;

        if (!filtered.length) {
            tbody.innerHTML = emptyStateTable('No complaints found.', 'Try a different search query.');
            return;
        }

        tbody.innerHTML = filtered.map(c => {
            const priorityCls = (c.priority || 'low').toLowerCase();
            return `<tr class="row--${priorityCls}" onclick="openAdminDetail('${c.complaint_id}')" style="cursor:pointer">
                <td class="td-id">${escapeHtml(c.complaint_id)}</td>
                <td class="text-sm"><span class="tag">${escapeHtml(c.category||'—')}</span></td>
                <td>${renderPriorityBadge(c.priority, c.priority_score)}</td>
                <td class="text-sm" style="color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.department||'—')}</td>
                <td>${renderStatusChip(c.status)}</td>
                <td class="text-sm" style="color:var(--text-muted)">${escapeHtml(c.location||'—')}</td>
                <td class="text-xs" style="color:var(--text-muted);white-space:nowrap">${formatDateShort(c.created_at)}</td>
            </tr>`;
        }).join('');
    }

    // ── Admin Complaint Detail Modal ───────────────────────────
    window.openAdminDetail = async function (complaintId) {
        const modal = $('adminDetailModal');
        const box = $('adminDetailBox');
        if (!modal) return;
        try {
            const c = await api.getComplaint(complaintId);
            detailComplaint = c;
            renderAdminDetailModal(c);
            modal.classList.add('admin-detail-modal--show');
        } catch (err) {
            toast.error('Failed to load complaint details.');
        }
    };

    function closeAdminDetail() {
        const modal = $('adminDetailModal');
        if (modal) modal.classList.remove('admin-detail-modal--show');
        detailComplaint = null;
    }
    window.closeAdminDetail = closeAdminDetail;

    function renderAdminDetailModal(c) {
        const box = $('adminDetailBox');
        if (!box) return;
        const reasons = c.priority_reasons || [];
        const maxPoints = reasons.length ? Math.max(...reasons.map(r => r.points), 1) : 30;
        const priorityCls = (c.priority || 'low').toLowerCase();

        const nextStatusMap = {
            PENDING: { status: 'ASSIGNED', label: 'Assign', cls: 'action-btn--assign' },
            ASSIGNED: { status: 'IN_PROGRESS', label: 'Start Work', cls: 'action-btn--progress' },
            IN_PROGRESS: { status: 'RESOLVED', label: 'Mark Resolved', cls: 'action-btn--resolve' },
            RESOLVED: null
        };
        const nextAction = nextStatusMap[(c.status || 'PENDING').toUpperCase()];

        box.innerHTML = `
        <div class="admin-detail-box__header">
            <div>
                <div style="font-size:11px;color:var(--text-muted);font-family:monospace;margin-bottom:6px">${escapeHtml(c.complaint_id)}</div>
                <div style="display:flex;gap:8px;align-items:center">
                    ${renderPriorityBadge(c.priority, c.priority_score)}
                    ${renderStatusChip(c.status)}
                </div>
            </div>
            <button class="drawer-close" onclick="closeAdminDetail()">✕</button>
        </div>

        <div style="padding:20px;display:flex;flex-direction:column;gap:18px">
            <!-- Description -->
            <div>
                <div class="drawer-section-title" style="margin-bottom:8px">Complaint</div>
                <div class="description-block">${escapeHtml(c.description)}</div>
            </div>

            <!-- Meta -->
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-item__label">Category</div>
                    <div class="info-item__value">${escapeHtml(c.category||'—')}</div>
                </div>
                <div class="info-item">
                    <div class="info-item__label">Location</div>
                    <div class="info-item__value">${escapeHtml(c.location||'—')}</div>
                </div>
                <div class="info-item">
                    <div class="info-item__label">Department</div>
                    <div class="info-item__value">${escapeHtml(c.department||'—')}</div>
                </div>
                <div class="info-item">
                    <div class="info-item__label">Filed</div>
                    <div class="info-item__value">${formatDateLong(c.created_at)}</div>
                </div>
            </div>

            <!-- AI Analysis -->
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <div class="drawer-section-title">AI Priority Analysis</div>
                    <span class="ai-label">⚙ AI-assisted</span>
                </div>
                <div class="ai-panel">
                    <div class="ai-summary">
                        <div class="score-circle score-circle--${priorityCls}">
                            <div class="score-circle__num">${Math.round(c.priority_score||0)}</div>
                            <div class="score-circle__max">/100</div>
                        </div>
                        <div class="ai-meta">
                            <div class="ai-meta__priority">${(c.priority||'LOW').toUpperCase()} PRIORITY</div>
                            <div class="ai-meta__response">Score: <span>${Math.round(c.priority_score||0)}/100</span></div>
                        </div>
                    </div>
                    ${reasons.length ? `<div class="factors-list">
                        <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px">Scoring Factors</div>
                        ${reasons.map(r => `<div class="factor-row">
                            <span class="factor-row__name">${escapeHtml(r.factor)}</span>
                            ${renderFactorBar(r.points, maxPoints)}
                            <span class="factor-row__points">+${r.points}</span>
                        </div>`).join('')}
                    </div>` : ''}
                </div>
            </div>

            <!-- Status -->
            <div>
                <div class="drawer-section-title" style="margin-bottom:10px">Status Workflow</div>
                ${renderStatusStepper(c.status)}
            </div>
        </div>
        <!-- Action Panel -->
        <div style="padding: 16px 20px; border-top: 1px solid var(--border-subtle); display: flex; gap: 12px; background: #FAFAFC; border-radius: 0 0 12px 12px;">
            ${nextAction ? `
                <button class="action-btn ${nextAction.cls}" id="adminActionBtn" onclick="handleAdminStatusUpdate('${c.complaint_id}', '${nextAction.status}', '${nextAction.label}')" style="flex:1; padding:10px; border-radius:6px; font-weight:600; cursor:pointer; background:var(--accent); color:white; border:none;">
                    ${nextAction.label}
                </button>` :
                `<div style="flex:1;font-size:13px;color:var(--text-muted);font-weight:500;align-self:center;text-align:center;">✓ This complaint has been resolved</div>`
            }
            <button onclick="closeAdminDetail()" style="padding:10px 20px; border-radius:6px; background:transparent; border:1px solid var(--border-subtle); cursor:pointer;">Close</button>
        </div>`;
    }

    window.handleAdminStatusUpdate = async function (complaintId, newStatus, label) {
        if (!confirm(`Update status of ${complaintId} to ${newStatus.replace('_', ' ')}?`)) return;
        const btn = $('adminActionBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
        try {
            const result = await api.updateStatus(complaintId, newStatus);
            detailComplaint = result.complaint;
            renderAdminDetailModal(result.complaint);
            
            // update in complaints array if exists
            const idx = complaints.findIndex(c => c.complaint_id === complaintId);
            if (idx !== -1) complaints[idx] = result.complaint;
            
            renderComplaintTable();
            toast.success(`Status updated to ${newStatus.replace('_', ' ')}.`);
        } catch (err) {
            toast.error('Failed to update status.');
            if (btn) { btn.disabled = false; btn.textContent = label; }
        }
    };

    // ── System Health ──────────────────────────────────────────
    function updateSystemHealth() {
        const el = $('systemHealthLabel');
        if (el) el.textContent = 'All Systems Operational';
    }

    // ── Chart Defaults ─────────────────────────────────────────
    function chartTooltipDefaults() {
        return {
            backgroundColor: '#132840',
            borderColor: 'rgba(74,106,138,0.4)',
            borderWidth: 1,
            titleColor: '#EDF2F7',
            bodyColor: '#8FA9C4',
            padding: 10,
            cornerRadius: 4,
        };
    }

    function chartAxisDefaults() {
        return {
            grid: { color: 'rgba(74,106,138,0.12)', drawBorder: false },
            border: { display: false }
        };
    }

    // ── Bind Events ────────────────────────────────────────────
    function bindNav() {
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.addEventListener('click', function () {
                document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('admin-nav-item--active'));
                this.classList.add('admin-nav-item--active');
                const target = this.dataset.section;
                if (target) {
                    const el = document.getElementById(target);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    function bindEvents() {
        const refreshBtn = $('adminRefreshBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', refresh);

        // Search
        const searchEl = $('adminSearch');
        if (searchEl) {
            let t;
            searchEl.addEventListener('input', () => {
                clearTimeout(t);
                t = setTimeout(() => {
                    searchQuery = searchEl.value.trim();
                    renderComplaintTable();
                }, 250);
            });
        }

        // Modal close overlay
        const modal = $('adminDetailModal');
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) closeAdminDetail();
            });
        }
    }

    // ── Boot ───────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

})();
