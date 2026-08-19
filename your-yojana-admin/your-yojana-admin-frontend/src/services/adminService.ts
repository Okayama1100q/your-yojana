const API_URL = "http://127.0.0.1:8001/api"

export interface SummaryData {
  schemes: {
    total_recommendations: number
    success_rate: number
  }
  collaboration: {
    index: number
    projects: number
  }
}

export interface SchemesPerformanceData {
  categories: Array<{ name: string; count: number; percentage: number }>
  matching_efficiency: Array<{ month: string; accuracy: number }>
}

export interface CivicPerformanceData {
  categories: Array<{ name: string; count: number; percentage: number }>
  trends: Array<{ month: string; reported: number; resolved: number }>
}

export interface CollabPerformanceData {
  synergy_scores: Array<{ sector_a: string; sector_b: string; synergy: number }>
  cooperative_projects: Array<{ id: string; name: string; status: string; efficiency_gain: string }>
}

export interface ComplaintRecord {
  id: number
  complaint_id: string
  description: string
  location: string
  category: string
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  priority_score: number
  priority_reasons: Array<{ factor: string; points: number }>
  department: string
  status: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED"
  created_at: string
}

export async function fetchAdminSummary(): Promise<SummaryData> {
  const res = await fetch(`${API_URL}/performance/summary`)
  if (!res.ok) throw new Error("Failed to fetch admin summary")
  return res.json()
}

export async function fetchSchemesPerformance(): Promise<SchemesPerformanceData> {
  const res = await fetch(`${API_URL}/performance/schemes`)
  if (!res.ok) throw new Error("Failed to fetch schemes performance")
  return res.json()
}

export async function fetchCivicPerformance(): Promise<CivicPerformanceData> {
  const res = await fetch(`${API_URL}/performance/civic`)
  if (!res.ok) throw new Error("Failed to fetch civic performance")
  return res.json()
}

export async function fetchCollabPerformance(): Promise<CollabPerformanceData> {
  const res = await fetch(`${API_URL}/performance/collaboration`)
  if (!res.ok) throw new Error("Failed to fetch collaboration performance")
  return res.json()
}

export async function fetchComplaintsList(): Promise<{ count: number; complaints: ComplaintRecord[] }> {
  const res = await fetch(`${API_URL}/complaints`)
  if (!res.ok) throw new Error("Failed to fetch complaints list")
  return res.json()
}

export async function updateComplaintStatus(complaintId: string, status: string): Promise<any> {
  const res = await fetch(`${API_URL}/complaints/${complaintId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error("Failed to update status")
  return res.json()
}
