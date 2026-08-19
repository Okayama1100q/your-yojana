// ──────────────────────────────────────────────
// Civic Service — API layer for Priority backend
// ──────────────────────────────────────────────

import type {
  CivicIssueInput,
  ComplaintResponse,
  ComplaintsListResponse,
  ComplaintRecord,
  DashboardStats,
} from "../types/civicTypes"

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

/**
 * Submit a civic complaint.
 * Backend runs: Understanding Agent → Priority Agent → Routing Agent
 * Returns the full analysis result in one call.
 */
export async function submitComplaint(
  input: CivicIssueInput
): Promise<ComplaintResponse> {
  const res = await fetch(`${API_BASE}/complaint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as Record<string, string>).detail || `Server error (${res.status})`
    )
  }

  return res.json()
}

/**
 * Fetch all complaints with optional filters.
 */
export async function getComplaints(filters?: {
  priority?: string
  department?: string
  status?: string
  location?: string
}): Promise<ComplaintsListResponse> {
  const params = new URLSearchParams()
  if (filters?.priority) params.set("priority", filters.priority)
  if (filters?.department) params.set("department", filters.department)
  if (filters?.status) params.set("status", filters.status)
  if (filters?.location) params.set("location", filters.location)

  const qs = params.toString()
  const url = `${API_BASE}/complaints${qs ? `?${qs}` : ""}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch complaints (${res.status})`)

  return res.json()
}

/**
 * Fetch a single complaint by ID.
 */
export async function getComplaint(
  complaintId: string
): Promise<ComplaintRecord> {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}`)
  if (!res.ok) throw new Error(`Complaint not found (${res.status})`)

  return res.json()
}

/**
 * Standalone vision assessment (without creating a complaint).
 */
export async function assessImages(
  images: string[],
  complaint?: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/vision/assess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images, complaint }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as Record<string, string>).detail ||
        `Vision assessment failed (${res.status})`
    )
  }

  return res.json()
}

/**
 * Fetch statistics for the government dashboard.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/dashboard/stats`)
  if (!res.ok) throw new Error(`Failed to fetch dashboard stats (${res.status})`)
  return res.json()
}

/**
 * Update the status of a complaint.
 */
export async function updateComplaintStatus(
  complaintId: string,
  status: string
): Promise<{ message: string; complaint: ComplaintRecord }> {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as Record<string, string>).detail || `Failed to update status (${res.status})`
    )
  }

  return res.json()
}

