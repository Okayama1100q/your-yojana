// =============================================================
// schemes.js — Your Yojana Scheme Discovery
// This is a prototype wizard — no backend calls are made.
// All scheme data is clearly marked as DEMO / SAMPLE.
// =============================================================

// ── Wizard State ─────────────────────────────────────────────
const state = {
    step: 1,
    totalSteps: 3,
    profile: {
        age: '',
        gender: '',
        state: '',
        area: '',
        employment: '',
        income: '',
        occupation: '',
        needs: new Set()
    },
    activeCategory: 'ALL'
};

// ── Demo Scheme Database ─────────────────────────────────────
const SCHEMES = [
    {
        id: 1,
        name: 'PM Awas Yojana — Urban',
        category: 'Housing',
        catKey: 'housing',
        level: 'Central Government',
        desc: 'Provides credit-linked interest subsidy for purchase, construction or enhancement of houses for EWS/LIG/MIG beneficiaries.',
        benefit: 'Interest subsidy up to ₹2.67 lakh on home loans',
        elig: 'EWS / LIG / MIG families',
        ministry: 'Ministry of Housing & Urban Affairs'
    },
    {
        id: 2,
        name: 'Ayushman Bharat PM-JAY',
        category: 'Healthcare',
        catKey: 'healthcare',
        level: 'Central Government',
        desc: 'World\'s largest health assurance scheme providing coverage of ₹5 lakh per family per year for secondary and tertiary care hospitalisation.',
        benefit: 'Cashless treatment up to ₹5 lakh per year',
        elig: 'Bottom 40% families as per SECC data',
        ministry: 'Ministry of Health & Family Welfare'
    },
    {
        id: 3,
        name: 'National Scholarship Portal',
        category: 'Education',
        catKey: 'education',
        level: 'Central Government',
        desc: 'Unified platform offering pre-matric, post-matric, merit-cum-means and top-class scholarships for students at all levels.',
        benefit: 'Scholarships from ₹1,000 to ₹25,000 per year',
        elig: 'Students from Class 1 to post-graduation',
        ministry: 'Ministry of Education'
    },
    {
        id: 4,
        name: 'PM Mudra Yojana',
        category: 'Employment',
        catKey: 'employment',
        level: 'Central Government',
        desc: 'Provides micro-enterprise development loans for non-farm income-generating activities under three categories: Shishu, Kishor, Tarun.',
        benefit: 'Collateral-free loans up to ₹10 lakh',
        elig: 'Non-farm micro-enterprises, traders, artisans',
        ministry: 'Ministry of Finance'
    },
    {
        id: 5,
        name: 'PM Kisan Samman Nidhi',
        category: 'Agriculture',
        catKey: 'agriculture',
        level: 'Central Government',
        desc: 'Provides income support to all farmer families across the country to supplement their financial needs for crop health and proper yields.',
        benefit: '₹6,000 per year in three equal instalments',
        elig: 'Small & marginal farmers with cultivable land',
        ministry: 'Ministry of Agriculture & Farmers Welfare'
    },
    {
        id: 6,
        name: 'Skill India Mission (PMKVY)',
        category: 'Employment',
        catKey: 'employment',
        level: 'Central Government',
        desc: 'National initiative to train youth in industry-relevant skills through short-term training and recognition of prior learning.',
        benefit: 'Free vocational training + ₹8,000 reward + placement',
        elig: 'Indian nationals aged 15–45 years',
        ministry: 'Ministry of Skill Development & Entrepreneurship'
    },
    {
        id: 7,
        name: 'Beti Bachao Beti Padhao',
        category: 'Women & Child',
        catKey: 'welfare',
        level: 'Central Government',
        desc: 'Tri-ministerial scheme to address declining child sex ratio and promote the welfare, education and empowerment of the girl child.',
        benefit: 'Education support, awareness programmes, girl child schemes',
        elig: 'Girls, women of all ages',
        ministry: 'Ministry of Women & Child Development'
    },
    {
        id: 8,
        name: 'Stand Up India Scheme',
        category: 'Financial Assistance',
        catKey: 'financial',
        level: 'Central Government',
        desc: 'Facilitates bank loans between ₹10 lakh and ₹1 crore to SC/ST borrowers and women entrepreneurs for greenfield enterprises.',
        benefit: 'Loans from ₹10 lakh to ₹1 crore',
        elig: 'SC/ST and women entrepreneurs (greenfield enterprises)',
        ministry: 'Ministry of Finance'
    },
    {
        id: 9,
        name: 'PM Gramin Awas Yojana',
        category: 'Housing',
        catKey: 'housing',
        level: 'Central Government',
        desc: 'Provides financial assistance to BPL families in rural areas for construction of houses with basic amenities.',
        benefit: '₹1.2 lakh – ₹1.3 lakh for house construction',
        elig: 'BPL families in rural areas, Houseless or kutcha house',
        ministry: 'Ministry of Rural Development'
    },
    {
        id: 10,
        name: 'National Social Assistance Programme',
        category: 'Social Welfare',
        catKey: 'welfare',
        level: 'Central Government',
        desc: 'Provides social protection to elderly, widows and persons with disabilities through central assistance for monthly pensions.',
        benefit: 'Monthly pension ₹200 – ₹500 from Central + State top-up',
        elig: 'BPL elderly (60+), widows, persons with disability',
        ministry: 'Ministry of Rural Development'
    },
    {
        id: 11,
        name: 'PM Ujjwala Yojana 2.0',
        category: 'Social Welfare',
        catKey: 'welfare',
        level: 'Central Government',
        desc: 'Provides LPG connections to BPL households to protect health of rural women and reduce indoor air pollution from cook-stoves.',
        benefit: 'Free LPG connection + first refill + hotplate',
        elig: 'BPL women aged 18+ years without existing LPG connection',
        ministry: 'Ministry of Petroleum & Natural Gas'
    },
    {
        id: 12,
        name: 'Kisan Credit Card Scheme',
        category: 'Agriculture',
        catKey: 'agriculture',
        level: 'Central Government',
        desc: 'Provides adequate and timely credit support from the banking system to farmers for their cultivation and other needs.',
        benefit: 'Credit limit up to ₹3 lakh at subsidized interest rates',
        elig: 'All farmers, sharecroppers, oral lessees, SHG members',
        ministry: 'Ministry of Agriculture & Farmers Welfare'
    }
];

const CATEGORIES = ['ALL', 'Education', 'Employment', 'Housing', 'Healthcare', 'Agriculture', 'Social Welfare', 'Financial Assistance', 'Women & Child'];

// ── DOM Helpers ───────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

// ── Wizard Navigation ────────────────────────────────────────
function nextStep() {
    if (state.step < state.totalSteps) {
        state.step++;
        renderWizard();
    } else {
        // Final step — show results
        showResults();
    }
}

function prevStep() {
    if (state.step > 1) {
        state.step--;
        renderWizard();
    }
}

function renderWizard() {
    const s = state.step;

    // Progress bar
    const pct = Math.round(((s - 1) / state.totalSteps) * 100);
    const progressEl = $('wizardProgress');
    if (progressEl) progressEl.style.width = pct + '%';

    // Panels
    document.querySelectorAll('.wizard-panel').forEach((p, i) => {
        p.classList.toggle('active', i + 1 === s);
    });

    // Tabs
    document.querySelectorAll('.wizard-tab').forEach((tab, i) => {
        tab.classList.remove('wizard-tab--active', 'wizard-tab--done');
        if (i + 1 === s) tab.classList.add('wizard-tab--active');
        if (i + 1 < s)   tab.classList.add('wizard-tab--done');
        const numEl = tab.querySelector('.wizard-tab-num');
        if (numEl) numEl.textContent = (i + 1 < s) ? '✓' : (i + 1);
    });

    // Step indicator
    const indEl = $('stepIndicator');
    if (indEl) indEl.textContent = `Step ${s} of ${state.totalSteps}`;

    // Back button state
    const backBtn = $('wizardBack');
    if (backBtn) backBtn.disabled = (s === 1);

    // Next button label
    const nextBtn = $('wizardNext');
    if (nextBtn) {
        nextBtn.innerHTML = s === state.totalSteps
            ? `Find Schemes For Me
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>`
            : `Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>`;
    }
}

// ── Need Toggles ─────────────────────────────────────────────
function initNeedToggles() {
    document.querySelectorAll('.need-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const need = toggle.dataset.need;
            if (state.profile.needs.has(need)) {
                state.profile.needs.delete(need);
                toggle.classList.remove('selected');
            } else {
                state.profile.needs.add(need);
                toggle.classList.add('selected');
            }
        });
    });
}

// ── Radio Groups ─────────────────────────────────────────────
function initRadioGroups() {
    document.querySelectorAll('.wiz-radio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.wiz-radio-group');
            if (!group) return;
            group.querySelectorAll('.wiz-radio-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
}

// ── Show Results ─────────────────────────────────────────────
function showResults() {
    // Collect selected needs
    const needs = state.profile.needs;

    // Hide wizard, show results
    const wizardCard = $('wizardCard');
    const resultsEl  = $('schemesResults');
    if (wizardCard) wizardCard.style.display = 'none';
    if (resultsEl)  { resultsEl.classList.add('visible'); }

    // Render profile summary
    renderProfileSummary();

    // Render category filter
    renderCategoryFilter();

    // Render cards
    renderSchemeCards();
}

function renderProfileSummary() {
    const el = $('profileSummary');
    if (!el) return;

    const needsArr = [...state.profile.needs];
    const needsText = needsArr.length ? needsArr.join(' · ') : 'All categories';

    // Read form values
    const age        = $('wizAge')?.value || '—';
    const gender     = document.querySelector('.wiz-radio-btn.selected[data-field="gender"]')?.dataset.value || '—';
    const stateVal   = $('wizState')?.value || '—';
    const area       = document.querySelector('.wiz-radio-btn.selected[data-field="area"]')?.dataset.value || '—';

    el.innerHTML = `
        <div class="restart-bar">
            <div class="restart-bar__text">
                Showing schemes for: <strong>${escapeHtml(age)} yrs · ${escapeHtml(gender)} · ${escapeHtml(stateVal)} · ${escapeHtml(area)}</strong>
                · Needs: <strong>${escapeHtml(needsText)}</strong>
            </div>
            <button class="restart-btn" onclick="restartWizard()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                Change profile
            </button>
        </div>`;
}

function renderCategoryFilter() {
    const el = $('categoryFilter');
    if (!el) return;

    el.innerHTML = CATEGORIES.map(cat => `
        <button
            class="cat-btn ${cat === state.activeCategory ? 'active' : ''}"
            onclick="filterByCategory('${cat}')"
            aria-pressed="${cat === state.activeCategory}"
        >${cat}</button>`
    ).join('');
}

function filterByCategory(cat) {
    state.activeCategory = cat;
    renderCategoryFilter();
    renderSchemeCards();
}

function renderSchemeCards() {
    const el = $('schemeCardsGrid');
    const countEl = $('resultsCount');
    if (!el) return;

    const needs = state.profile.needs;

    let filtered = SCHEMES;

    // Filter by active category
    if (state.activeCategory !== 'ALL') {
        filtered = filtered.filter(s => s.category === state.activeCategory);
    }

    if (countEl) {
        countEl.textContent = `${filtered.length} scheme${filtered.length !== 1 ? 's' : ''} found`;
    }

    if (!filtered.length) {
        el.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px 24px;color:var(--text-muted)">
                <div style="font-size:15px;font-weight:600;margin-bottom:8px">No schemes in this category</div>
                <div style="font-size:13px">Try selecting "ALL" or a different category.</div>
            </div>`;
        return;
    }

    el.innerHTML = filtered.map(s => renderSchemeCard(s)).join('');
}

const CAT_TAG_CLASSES = {
    'Education':          'scard__cat-tag--education',
    'Employment':         'scard__cat-tag--employment',
    'Housing':            'scard__cat-tag--housing',
    'Healthcare':         'scard__cat-tag--healthcare',
    'Agriculture':        'scard__cat-tag--agriculture',
    'Financial Assistance': 'scard__cat-tag--financial',
    'Social Welfare':     'scard__cat-tag--welfare',
    'Women & Child':      'scard__cat-tag--welfare',
};

function renderSchemeCard(s) {
    const catCls = CAT_TAG_CLASSES[s.category] || 'scard__cat-tag--employment';
    return `
        <div class="scard">
            <div class="scard__top">
                <span class="scard__cat-tag ${catCls}">${escapeHtml(s.category)}</span>
                <span class="scard__level">${escapeHtml(s.level)}</span>
            </div>
            <div class="scard__body">
                <div class="scard__name">${escapeHtml(s.name)}</div>
                <div class="scard__desc">${escapeHtml(s.desc)}</div>
                <div class="scard__benefit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;margin-top:1px">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <div>
                        <strong>${escapeHtml(s.benefit)}</strong><br>
                        <span style="font-size:11.5px;color:var(--text-muted)">${escapeHtml(s.ministry)}</span>
                    </div>
                </div>
            </div>
            <div class="scard__footer">
                <div class="scard__elig">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                    ${escapeHtml(s.elig)}
                </div>
                <button class="scard__btn" onclick="viewSchemeDetail(${s.id})">View Details →</button>
            </div>
        </div>`;
}

function viewSchemeDetail(id) {
    // Prototype: show a toast explaining this is a demo
    if (typeof toast !== 'undefined') {
        toast.info('This is a demo — full scheme detail pages are not yet connected to a live eligibility database.');
    } else {
        alert('This is a prototype. Full scheme details would open here in production.');
    }
}

// ── Restart Wizard ───────────────────────────────────────────
function restartWizard() {
    state.step = 1;
    state.profile.needs.clear();
    state.activeCategory = 'ALL';

    // Reset toggles
    document.querySelectorAll('.need-toggle.selected').forEach(t => t.classList.remove('selected'));
    document.querySelectorAll('.wiz-radio-btn.selected').forEach(b => b.classList.remove('selected'));

    // Show wizard, hide results
    const wizardCard = $('wizardCard');
    const resultsEl  = $('schemesResults');
    if (wizardCard) wizardCard.style.display = '';
    if (resultsEl)  resultsEl.classList.remove('visible');

    renderWizard();

    // Scroll to top of wizard
    if (wizardCard) wizardCard.scrollIntoView({ behavior: 'smooth' });
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

// ── URL Query Pre-fill ───────────────────────────────────────
function checkUrlQuery() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
        // Try to match to a category
        const lq = q.toLowerCase();
        CATEGORIES.forEach(cat => {
            if (lq.includes(cat.toLowerCase())) {
                state.activeCategory = cat;
            }
        });

        // Show a friendly message
        const searchEl = document.getElementById('searchQueryEl');
        if (searchEl) {
            searchEl.textContent = `Showing results for "${q}"`;
            searchEl.style.display = '';
        }
    }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initNeedToggles();
    initRadioGroups();
    renderWizard();
    checkUrlQuery();

    // Wire up navigation buttons
    const nextBtn = $('wizardNext');
    const backBtn = $('wizardBack');
    if (nextBtn) nextBtn.addEventListener('click', nextStep);
    if (backBtn) backBtn.addEventListener('click', prevStep);
});
