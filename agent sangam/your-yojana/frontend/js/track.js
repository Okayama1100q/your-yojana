// =============================================================
// track.js — Your Yojana Complaint Tracking
// Calls GET /complaints/{complaint_id} via the api service layer
// =============================================================

// ── State ────────────────────────────────────────────────────
let currentComplaint = null;

// ── DOM References ───────────────────────────────────────────
function $(id) { return document.getElementById(id); }

// ── Timeline Configuration ───────────────────────────────────
// Citizen-facing timeline (backend statuses drive ASSIGNED → RESOLVED).
// SUBMITTED / ASSESSED are always complete once a complaint exists.
const TIMELINE_STEPS = [
    {
        id: 'SUBMITTED',
        title: 'Submitted',
        desc: 'Your complaint has been received and registered.',
        icon: '1',
        alwaysDone: true
    },
    {
        id: 'ASSESSED',
        title: 'Assessed',
        desc: 'AI agents analyzed category, priority, and department routing.',
        icon: '2',
        alwaysDone: true
    },
    {
        id: 'ASSIGNED',
        title: 'Assigned',
        desc: 'A government officer has been assigned to your complaint.',
        icon: '3',
        backendStatus: 'ASSIGNED'
    },
    {
        id: 'IN_PROGRESS',
        title: 'In Progress',
        desc: 'The department is actively working on resolution.',
        icon: '4',
        backendStatus: 'IN_PROGRESS'
    },
    {
        id: 'RESOLVED',
        title: 'Resolved',
        desc: 'Your complaint has been resolved. Thank you for using Your Yojana.',
        icon: '✓',
        backendStatus: 'RESOLVED'
    }
];

const STATUS_ORDER = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

function getStatusIndex(status) {
    return STATUS_ORDER.indexOf((status || '').toUpperCase());
}

// ── Views ────────────────────────────────────────────────────
function showView(viewId) {
    ['trackIdle', 'trackLoading', 'trackError', 'trackResult'].forEach(id => {
        const el = $(id);
        if (el) el.style.display = 'none';
    });
    const target = $(viewId);
    if (target) target.style.display = '';
}

// ── Track Complaint ──────────────────────────────────────────
async function trackComplaint() {
    const input = $('trackInput');
    const rawId = (input?.value || '').trim().toUpperCase();

    if (!rawId) {
        input?.focus();
        showError('Please enter a complaint ID (e.g. YY-A1B2C3D4).');
        return;
    }

    // Normalize: add YY- prefix if user didn't include it
    const complaintId = rawId.startsWith('YY-') ? rawId : `YY-${rawId}`;

    // Update input to normalized ID
    if (input) input.value = complaintId;

    showView('trackLoading');
    currentComplaint = null;

    try {
        const data = await api.getComplaint(complaintId);
        currentComplaint = data;
        renderResult(data);
        showView('trackResult');

        // Update URL without reloading
        const url = new URL(window.location.href);
        url.searchParams.set('id', complaintId);
        history.replaceState(null, '', url);

    } catch (err) {
        showError(err.message || 'Could not find that complaint ID.');
        showView('trackError');
    }
}

function showError(msg) {
    const titleEl = $('trackErrorTitle');
    const subEl   = $('trackErrorSub');
    if (titleEl) titleEl.textContent = 'Complaint Not Found';
    if (subEl)   subEl.textContent   = msg || 'Please check the complaint ID and try again.';
    showView('trackError');
}

// ── Render ───────────────────────────────────────────────────
function renderResult(c) {
    // Header
    const idEl   = $('resultComplaintId');
    const tsEl   = $('resultTimestamp');
    const statEl = $('resultStatusChip');

    if (idEl)   idEl.textContent   = c.complaint_id;
    if (tsEl)   tsEl.textContent   = 'Filed: ' + formatDateLong(c.created_at);
    if (statEl) statEl.innerHTML   = renderStatusChip(c.status);

    // Timeline
    const timelineEl = $('statusTimeline');
    if (timelineEl) timelineEl.innerHTML = renderTimeline(c.status);

    // Detail grid
    const detailEl = $('complaintDetail');
    if (detailEl) detailEl.innerHTML = renderDetailGrid(c);

    // Priority Factors
    const factorsEl = $('priorityFactors');
    if (factorsEl) factorsEl.innerHTML = renderFactors(c);

    // Score
    const scoreEl = $('factorsScore');
    if (scoreEl) {
        scoreEl.innerHTML = `${Math.round(c.priority_score || 0)}<span>/100</span>`;
    }
}

function renderTimeline(status) {
    const currentIdx = getStatusIndex(status);
    // STATUS_ORDER: PENDING=0, ASSIGNED=1, IN_PROGRESS=2, RESOLVED=3
    // Citizen timeline omits PENDING as its own step; PENDING means waiting for ASSIGNED.

    return TIMELINE_STEPS.map((step, i) => {
        let state = 'future';
        if (step.alwaysDone) {
            state = 'done';
        } else if (step.backendStatus) {
            const stepIdx = getStatusIndex(step.backendStatus);
            if (stepIdx < currentIdx) state = 'done';
            else if (stepIdx === currentIdx) state = 'active';
            else state = 'future';
        }

        const isLast = i === TIMELINE_STEPS.length - 1;
        const dotCls = state === 'done' ? 'vtimeline-dot--done' :
                       state === 'active' ? 'vtimeline-dot--active' : 'vtimeline-dot--future';
        const lineCls = state === 'done' ? 'vtimeline-line--done' : '';
        const titleCls = state === 'future' ? 'vtimeline-step-title--future' :
                         state === 'active' ? 'vtimeline-step-title--active' : '';
        const dotIcon = state === 'done' ? '✓' :
                        state === 'active' ? '●' : step.icon;

        const tagHtml = state !== 'future' ? `
            <div class="vtimeline-step-tag vtimeline-step-tag--${state === 'done' ? 'done' : 'active'}">
                ${state === 'done' ? '✓ Completed' : '● Current'}
            </div>` : '';

        return `
            <div class="vtimeline-item">
                <div class="vtimeline-left">
                    <div class="vtimeline-dot ${dotCls}">${dotIcon}</div>
                    ${!isLast ? `<div class="vtimeline-line ${lineCls}"></div>` : ''}
                </div>
                <div class="vtimeline-right">
                    <div class="vtimeline-step-title ${titleCls}">${escapeHtml(step.title)}</div>
                    <div class="vtimeline-step-desc">${escapeHtml(step.desc)}</div>
                    ${tagHtml}
                </div>
            </div>`;
    }).join('');
}

function renderDetailGrid(c) {
    const items = [
        { label: 'Category',    value: c.category || '—' },
        { label: 'Location',    value: c.location  || 'Not specified' },
        { label: 'Department',  value: c.department || '—' },
        { label: 'Priority',    value: renderPriorityBadge(c.priority, c.priority_score), raw: true },
        { label: 'Status',      value: renderStatusChip(c.status), raw: true },
        { label: 'Filed',       value: formatDateLong(c.created_at) },
        { label: 'Description', value: escapeHtml(c.description || '—'), raw: true, full: true },
    ];

    return `<div class="detail-grid">
        ${items.map(item => `
            <div class="detail-item ${item.full ? 'detail-item--full' : ''}">
                <div class="detail-item__label">${escapeHtml(item.label)}</div>
                <div class="detail-item__value">${item.raw ? item.value : escapeHtml(String(item.value))}</div>
            </div>`
        ).join('')}
    </div>`;
}

function renderFactors(c) {
    const reasons = c.priority_reasons || [];
    const score   = c.priority_score  || 0;

    if (!reasons.length) {
        return `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">
            No detailed priority breakdown available.
        </div>`;
    }

    const maxPts = Math.max(...reasons.map(r => r.points || 0), 1);

    return reasons.map(r => {
        const pts = r.points || 0;
        const pct = Math.min(100, (pts / 30) * 100);
        return `
            <div class="factor-row">
                <div class="factor-name">${escapeHtml(r.reason || r.factor || String(r))}</div>
                <div class="factor-bar">
                    <div class="factor-bar__fill" style="width:${pct}%"></div>
                </div>
                <div class="factor-pts">+${pts}</div>
            </div>`;
    }).join('');
}

// ── Response time helper ─────────────────────────────────────
function getResponseTime(priority) {
    const times = { CRITICAL: '24 hours', HIGH: '48 hours', MEDIUM: '72 hours', LOW: '5 days' };
    return times[(priority || '').toUpperCase()] || '—';
}

// ── Clear / New Search ───────────────────────────────────────
function clearAndReset() {
    const input = $('trackInput');
    if (input) input.value = '';
    showView('trackIdle');
    currentComplaint = null;

    // Clear query param
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    history.replaceState(null, '', url);

    // Scroll back to search
    const searchEl = $('trackSearch');
    if (searchEl) searchEl.scrollIntoView({ behavior: 'smooth' });
}

// ── Keyboard Support ─────────────────────────────────────────
function initKeyboard() {
    const input = $('trackInput');
    if (!input) return;
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') trackComplaint();
    });

    // Format as uppercase while typing
    input.addEventListener('input', () => {
        const pos = input.selectionStart;
        input.value = input.value.toUpperCase();
        input.setSelectionRange(pos, pos);
    });
}

// ── Mobile Nav ───────────────────────────────────────────────
function initMobileNav() {
    const btn  = document.getElementById('hamburgerBtn');
    const menu = document.getElementById('mobileNav');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen);
    });
    document.addEventListener('click', e => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove('open');
        }
    });
}

// ── URL Pre-fill ─────────────────────────────────────────────
function checkUrlParam() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        const input = $('trackInput');
        if (input) input.value = id.toUpperCase();
        trackComplaint();
    }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initKeyboard();
    showView('trackIdle');
    checkUrlParam();

    // Wire up buttons
    const trackBtn = $('trackBtn');
    if (trackBtn) trackBtn.addEventListener('click', trackComplaint);

    const resetBtn = $('resetTrackBtn');
    if (resetBtn) resetBtn.addEventListener('click', clearAndReset);
});
