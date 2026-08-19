// =============================================================
// utils.js — Your Yojana Frontend Utilities
// Formatters, badge renderers, toast system, skeleton loaders
// =============================================================

// ------ Priority Configuration ------
const PRIORITY_CFG = {
    CRITICAL: { label: 'CRITICAL', cls: 'critical' },
    HIGH:     { label: 'HIGH',     cls: 'high' },
    MEDIUM:   { label: 'MEDIUM',   cls: 'medium' },
    LOW:      { label: 'LOW',      cls: 'low' }
};

const STATUS_CFG = {
    PENDING:     { label: 'PENDING',      cls: 'pending' },
    ASSIGNED:    { label: 'ASSIGNED',     cls: 'assigned' },
    IN_PROGRESS: { label: 'IN PROGRESS',  cls: 'in-progress' },
    RESOLVED:    { label: 'RESOLVED',     cls: 'resolved' }
};

function getPriorityCfg(p) {
    return PRIORITY_CFG[(p || '').toUpperCase()] || PRIORITY_CFG.LOW;
}

function getStatusCfg(s) {
    return STATUS_CFG[(s || '').toUpperCase()] || STATUS_CFG.PENDING;
}

// ------ Renderers ------

function renderPriorityBadge(priority, score) {
    const cfg = getPriorityCfg(priority);
    const scoreTag = (score !== undefined && score !== null)
        ? `<span class="priority-badge__score">${Math.round(score)}/100</span>`
        : '';
    return `<span class="priority-badge priority-badge--${cfg.cls}">${cfg.label}${scoreTag}</span>`;
}

function renderStatusChip(status) {
    const cfg = getStatusCfg(status);
    return `<span class="status-chip status-chip--${cfg.cls}">${cfg.label}</span>`;
}

function renderScoreGauge(score) {
    const pct = Math.min(100, Math.max(0, score || 0));
    let cls = 'low';
    if (pct >= 80) cls = 'critical';
    else if (pct >= 60) cls = 'high';
    else if (pct >= 40) cls = 'medium';
    return `<div class="score-gauge score-gauge--${cls}">
        <div class="score-gauge__arc" style="--pct:${pct}"></div>
        <div class="score-gauge__value">${Math.round(pct)}</div>
    </div>`;
}

function renderFactorBar(points, maxPoints) {
    const pct = Math.min(100, (points / (maxPoints || 30)) * 100);
    return `<div class="factor-bar">
        <div class="factor-bar__fill" style="width:${pct}%"></div>
    </div>`;
}

// ------ Date Formatters ------

function formatDateLong(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

function formatDateShort(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function formatTimeAgo(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'Just now';
}

function formatResponseTime(hours) {
    if (!hours && hours !== 0) return '—';
    if (hours >= 24) return `${Math.round(hours / 24)} day${hours >= 48 ? 's' : ''}`;
    return `${hours}h`;
}

function truncate(str, max = 72) {
    if (!str) return '—';
    return str.length > max ? str.slice(0, max) + '…' : str;
}

function formatDept(dept) {
    if (!dept) return '—';
    return dept
        .replace(' Department', ' Dept.')
        .replace('Roads & Highways', 'Roads & Hwy.');
}

function formatConfidence(conf) {
    if (conf === null || conf === undefined) return '—';
    return `${Math.round(conf * 100)}%`;
}

// ------ Toast System ------
const toast = {
    _container: null,

    _getContainer() {
        if (!this._container) {
            this._container = document.getElementById('toastContainer');
        }
        return this._container;
    },

    show(msg, type = 'info', duration = 4500) {
        const c = this._getContainer();
        if (!c) return;
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        const id = `t${Date.now()}`;
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.id = id;
        el.innerHTML = `
            <span class="toast__icon">${icons[type] || icons.info}</span>
            <span class="toast__msg">${msg}</span>
            <button class="toast__close" onclick="this.parentElement.remove()">✕</button>
        `;
        c.appendChild(el);
        requestAnimationFrame(() => el.classList.add('toast--show'));
        if (duration > 0) {
            setTimeout(() => {
                el.classList.remove('toast--show');
                setTimeout(() => el.remove(), 320);
            }, duration);
        }
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg)   { this.show(msg, 'error', 7000); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg)    { this.show(msg, 'info'); }
};

// ------ Skeleton Loaders ------

function skeletonTableRows(count = 8) {
    return Array(count).fill(0).map(() => `
        <tr class="skel-row">
            <td><div class="skel skel--badge"></div></td>
            <td><div class="skel skel--id"></div></td>
            <td><div class="skel skel--text"></div></td>
            <td><div class="skel skel--sm"></div></td>
            <td><div class="skel skel--sm"></div></td>
            <td><div class="skel skel--sm"></div></td>
            <td><div class="skel skel--score"></div></td>
            <td><div class="skel skel--badge"></div></td>
            <td><div class="skel skel--sm"></div></td>
            <td><div class="skel skel--btn"></div></td>
        </tr>`
    ).join('');
}

function skeletonKPIs(count = 8) {
    return Array(count).fill(0).map(() => `
        <div class="kpi-card kpi-card--skel">
            <div class="skel skel--sm" style="width:60%"></div>
            <div class="skel skel--num" style="margin-top:8px"></div>
        </div>`
    ).join('');
}

// ------ Empty / Error States ------

function emptyStateTable(msg, sub) {
    return `<tr><td colspan="10">
        <div class="empty-state">
            <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/>
                <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
            <p class="empty-state__title">${msg || 'No complaints found'}</p>
            <p class="empty-state__sub">${sub || 'No data matches the current filter criteria.'}</p>
        </div>
    </td></tr>`;
}

function errorStateTable(msg, retryFn) {
    const retryId = `retry_${Date.now()}`;
    setTimeout(() => {
        const btn = document.getElementById(retryId);
        if (btn && retryFn) btn.addEventListener('click', retryFn);
    }, 0);
    return `<tr><td colspan="10">
        <div class="empty-state empty-state--error">
            <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none"/>
            </svg>
            <p class="empty-state__title">Unable to load data</p>
            <p class="empty-state__sub">${msg}</p>
            <button id="${retryId}" class="btn btn--outline btn--sm" style="margin-top:12px">↻ Retry</button>
        </div>
    </td></tr>`;
}

// ------ Status Workflow Stepper ------
const STATUS_STEPS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

function renderStatusStepper(currentStatus) {
    const current = STATUS_STEPS.indexOf((currentStatus || '').toUpperCase());
    return `<div class="status-stepper">
        ${STATUS_STEPS.map((step, i) => {
            let cls = 'stepper-step';
            if (i < current)  cls += ' stepper-step--done';
            if (i === current) cls += ' stepper-step--active';
            const labels = ['Pending', 'Assigned', 'In Progress', 'Resolved'];
            return `<div class="${cls}">
                <div class="stepper-step__dot">${i < current ? '✓' : (i === current ? '●' : '')}</div>
                <div class="stepper-step__label">${labels[i]}</div>
            </div>${i < STATUS_STEPS.length - 1 ? '<div class="stepper-line' + (i < current ? ' stepper-line--done' : '') + '"></div>' : ''}`;
        }).join('')}
    </div>`;
}

// ------ Misc ------
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
