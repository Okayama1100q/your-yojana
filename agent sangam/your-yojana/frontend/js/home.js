// =============================================================
// home.js — Your Yojana Homepage JavaScript
// Drives the hero search, stats strip, inline wizard preview
// =============================================================

// ── Hero Search ──────────────────────────────────────────────
const searchExamples = [
    'Scholarships for students',
    'Water supply complaint',
    'Road pothole in my area',
    'Housing for low income',
    'Employment assistance',
    'Healthcare scheme for women'
];

function initHeroSearch() {
    const input = document.getElementById('heroSearchInput');
    const btn   = document.getElementById('heroSearchBtn');

    if (!input) return;

    // Search chips
    document.querySelectorAll('.search-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            input.value = chip.dataset.query || chip.textContent.trim();
            input.focus();
        });
    });

    // Enter key
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleSearch();
    });

    // Button
    if (btn) btn.addEventListener('click', handleSearch);
}

function handleSearch() {
    const input = document.getElementById('heroSearchInput');
    const query = (input?.value || '').trim();
    if (!query) {
        input?.focus();
        return;
    }
    // Route to schemes page with query pre-filled
    window.location.href = `schemes.html?q=${encodeURIComponent(query)}`;
}

// ── Live Stats Strip ─────────────────────────────────────────
async function loadStats() {
    const els = {
        total:      document.getElementById('statTotal'),
        resolved:   document.getElementById('statResolved'),
        critical:   document.getElementById('statCritical'),
        depts:      document.getElementById('statDepts'),
        lastUpdate: document.getElementById('statLastUpdate')
    };

    // Only fetch if we have the elements
    if (!els.total) return;

    try {
        const data = await api.getDashboardStats();

        if (els.total)    els.total.textContent    = data.total ?? '0';
        if (els.resolved) els.resolved.textContent = data.status?.resolved ?? '0';
        if (els.critical) els.critical.textContent = data.priority?.critical ?? '0';
        if (els.depts)    els.depts.textContent    = Object.keys(data.departments || {}).length;
        if (els.lastUpdate) {
            els.lastUpdate.textContent = 'Live · ' + new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        }
    } catch (e) {
        // Silently fail on the homepage — don't show an error for the stats strip
        if (els.total) els.total.textContent = '—';
        if (els.resolved) els.resolved.textContent = '—';
        if (els.critical) els.critical.textContent = '—';
        if (els.depts) els.depts.textContent = '—';
    }
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

    // Close on outside click
    document.addEventListener('click', e => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        }
    });
}

// ── Inline Wizard Preview (homepage scheme section) ──────────
const wizardState = {
    step: 1,
    data: { age: '', gender: '', state: '', area: '', employment: '', income: '', needs: new Set() }
};

function initWizardPreview() {
    const wizardEl = document.getElementById('homeWizard');
    if (!wizardEl) return;

    // Next / Back buttons
    document.querySelectorAll('[data-wizard-next]').forEach(btn => {
        btn.addEventListener('click', () => advanceWizard(1));
    });
    document.querySelectorAll('[data-wizard-back]').forEach(btn => {
        btn.addEventListener('click', () => advanceWizard(-1));
    });

    // Need toggles
    document.querySelectorAll('.need-card').forEach(card => {
        card.addEventListener('click', () => {
            const need = card.dataset.need;
            if (wizardState.data.needs.has(need)) {
                wizardState.data.needs.delete(need);
                card.classList.remove('selected');
            } else {
                wizardState.data.needs.add(need);
                card.classList.add('selected');
            }
        });
    });
}

function advanceWizard(dir) {
    const next = wizardState.step + dir;
    if (next < 1 || next > 4) return;
    wizardState.step = next;
    updateWizardUI();
    if (wizardState.step === 4) {
        showSchemeCards();
    }
}

function updateWizardUI() {
    const s = wizardState.step;

    // Update panels
    document.querySelectorAll('.wizard-panel').forEach((panel, i) => {
        panel.classList.toggle('active', i + 1 === s);
    });

    // Update step tabs
    document.querySelectorAll('.wizard-step-tab').forEach((tab, i) => {
        tab.classList.remove('wizard-step-tab--active', 'wizard-step-tab--done');
        if (i + 1 === s)  tab.classList.add('wizard-step-tab--active');
        if (i + 1 < s)    tab.classList.add('wizard-step-tab--done');
    });

    // Update step num icons
    document.querySelectorAll('.wizard-step-tab--done .wizard-step-num').forEach(el => {
        el.textContent = '✓';
    });
}

function showSchemeCards() {
    const resultsEl = document.getElementById('homeSchemeResults');
    if (!resultsEl) return;

    resultsEl.innerHTML = renderDemoSchemeCards(getFilteredSchemes());
    resultsEl.style.display = 'block';

    // Scroll to results
    setTimeout(() => {
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// ── Demo Scheme Data ─────────────────────────────────────────
const DEMO_SCHEMES = [
    {
        name: 'PM Awas Yojana (Urban)',
        category: 'Housing',
        catKey: 'housing',
        level: 'Central Government',
        desc: 'Credit-linked subsidy for purchase, construction or enhancement of houses for economically weaker sections.',
        benefit: 'Interest subsidy up to ₹2.67 lakh on home loans',
        elig: 'EWS / LIG / MIG families'
    },
    {
        name: 'National Scholarship Portal',
        category: 'Education',
        catKey: 'education',
        level: 'Central Government',
        desc: 'Single-stop solution for students seeking scholarships and other educational incentives from the government.',
        benefit: 'Scholarships from ₹1,000 to ₹25,000/year',
        elig: 'Students up to post-graduation'
    },
    {
        name: 'PM Mudra Yojana',
        category: 'Employment',
        catKey: 'employment',
        level: 'Central Government',
        desc: 'Provides collateral-free micro-enterprise loans for non-farm income-generating activities.',
        benefit: 'Loans up to ₹10 lakh (Tarun category)',
        elig: 'Self-employed, micro-entrepreneurs'
    },
    {
        name: 'Ayushman Bharat PM-JAY',
        category: 'Healthcare',
        catKey: 'healthcare',
        level: 'Central Government',
        desc: 'Provides health coverage of ₹5 lakh per family per year for secondary and tertiary care hospitalisation.',
        benefit: 'Cashless treatment at empanelled hospitals',
        elig: 'SECC-listed families'
    },
    {
        name: 'PM Kisan Samman Nidhi',
        category: 'Agriculture',
        catKey: 'agriculture',
        level: 'Central Government',
        desc: 'Provides income support to all farmer families to supplement their financial needs.',
        benefit: '₹6,000 per year in three equal instalments',
        elig: 'Small & marginal farmers with cultivable land'
    },
    {
        name: 'Skill India Mission',
        category: 'Employment',
        catKey: 'employment',
        level: 'Central Government',
        desc: 'National initiative to train youth in market-relevant skills across sectors for better livelihood.',
        benefit: 'Free vocational training + placement support',
        elig: 'Youth aged 15–45 years'
    }
];

function getFilteredSchemes() {
    const needs = wizardState.data.needs;
    if (needs.size === 0) return DEMO_SCHEMES.slice(0, 6);
    return DEMO_SCHEMES.filter(s => needs.has(s.catKey));
}

const CAT_COLORS = {
    'Housing':    'cat-tag--housing',
    'Education':  'cat-tag--education',
    'Employment': 'cat-tag--employment',
    'Healthcare': 'cat-tag--healthcare',
    'Agriculture':'cat-tag--agriculture',
};

function renderDemoSchemeCards(schemes) {
    if (!schemes.length) {
        return `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:14px;">
            No schemes match the selected categories. Try selecting different needs.
        </div>`;
    }

    const cards = schemes.map(s => `
        <div class="scheme-card">
            <div class="scheme-card__header">
                <span class="scheme-card__category">${escapeHtml(s.category)}</span>
                <span class="scheme-card__level">${escapeHtml(s.level)}</span>
            </div>
            <div class="scheme-card__body">
                <div class="scheme-card__name">${escapeHtml(s.name)}</div>
                <div class="scheme-card__desc">${escapeHtml(s.desc)}</div>
                <div class="scheme-card__benefit">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;margin-top:1px">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    ${escapeHtml(s.benefit)}
                </div>
            </div>
            <div class="scheme-card__footer">
                <div class="elig-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                    ${escapeHtml(s.elig)}
                </div>
                <a href="schemes.html" class="view-detail-btn">View Details →</a>
            </div>
        </div>
    `).join('');

    return `
        <div class="scheme-results">
            <div class="scheme-results__header">
                <div style="font-size:13px;font-weight:600;color:var(--text-secondary)">${schemes.length} matching scheme${schemes.length !== 1 ? 's' : ''} found</div>
                <span class="demo-badge">⚠ Demo — Sample Data Only</span>
            </div>
            <div class="scheme-cards-grid">${cards}</div>
            <div style="text-align:center;margin-top:20px">
                <a href="schemes.html" class="btn-hero-primary" style="display:inline-flex">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                    Explore Full Scheme Directory
                </a>
            </div>
        </div>`;
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initHeroSearch();
    loadStats();
    initWizardPreview();
    updateWizardUI();
});
