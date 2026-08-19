// =============================================================
// api.js — Your Yojana Centralized API Service Layer
// All backend calls to localhost:8000 are routed through here.
// DO NOT add endpoints that do not exist in the backend.
// =============================================================

const API_BASE = 'http://localhost:8001';

async function _request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    try {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
            throw new Error(errData.detail || `Request failed with status ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
            throw new Error(
                'Cannot reach the Your Yojana backend. ' +
                'Please ensure the server is running at localhost:8001.'
            );
        }
        throw err;
    }
}

const api = {

    // GET /complaints?priority=&department=&status=&location=
    async getComplaints(filters = {}) {
        const params = new URLSearchParams();
        if (filters.priority)   params.set('priority',   filters.priority);
        if (filters.department) params.set('department', filters.department);
        if (filters.status)     params.set('status',     filters.status);
        if (filters.location)   params.set('location',   filters.location);
        const qs = params.toString();
        return _request(`/complaints${qs ? '?' + qs : ''}`);
    },

    // GET /complaints/{complaint_id}
    async getComplaint(complaintId) {
        return _request(`/complaints/${complaintId}`);
    },

    // PATCH /complaints/{complaint_id}/status
    async updateStatus(complaintId, status) {
        return _request(`/complaints/${complaintId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },

    // GET /dashboard/stats
    async getDashboardStats() {
        return _request('/dashboard/stats');
    },

    // POST /complaint  (optional images: base64 / data-URL strings, max 3)
    async createComplaint(complaintText, images = null) {
        const body = { complaint: complaintText };
        if (images && images.length) {
            body.images = images.slice(0, 3);
        }
        return _request('/complaint', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    // POST /vision/assess — Groq multimodal visual assessment
    async assessVision(images, complaintText = '') {
        return _request('/vision/assess', {
            method: 'POST',
            body: JSON.stringify({
                images: (images || []).slice(0, 3),
                complaint: complaintText || null
            })
        });
    },

    // Resolution evidence still requires dedicated backend storage
    future: {
        async uploadResolutionEvidence(/* complaintId, payload */) {
            throw new Error('Resolution evidence storage requires backend support.');
        }
    }
};
