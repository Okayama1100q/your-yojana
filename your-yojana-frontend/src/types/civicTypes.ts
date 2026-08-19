// ──────────────────────────────────────────────
// Civic Issue Types — mirrors backend schemas
// ──────────────────────────────────────────────

/** Input sent to POST /complaint */
export interface CivicIssueInput {
  complaint: string
  images?: string[]
}

/** Complaint Understanding Agent output */
export interface ComplaintAnalysis {
  category: string
  issue: string
  health_risk: boolean
  safety_risk: boolean
  essential_service: boolean
  vulnerable_population: boolean
  duration_days: number
  affected_count: number
  affected_unit: string
  location: string
}

/** Priority Agent output */
export interface PriorityResult {
  score: number
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  reasons: PriorityReason[]
  recommended_response_hours: number
}

export interface PriorityReason {
  factor: string
  points: number
}

/** Routing Agent (Civic Router) output */
export interface RoutingResult {
  department: string
  reason: string
  confidence: number
}

/** Vision Agent output */
export interface VisionAssessment {
  detections: string[]
  situation_analysis: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  severity_score: number
  confidence: number
  recommended_category: string
  summary_for_priority: string
  is_civic_issue: boolean
}

/** Stored complaint record from database */
export interface ComplaintRecord {
  id: number
  complaint_id: string
  description: string
  location: string
  category: string
  priority: string
  priority_score: number
  priority_reasons: PriorityReason[]
  department: string
  status: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED"
  created_at: string | null
}

/** Full response from POST /complaint */
export interface ComplaintResponse {
  message: string
  complaint: ComplaintRecord
  analysis: ComplaintAnalysis
  priority: PriorityResult
  routing: RoutingResult
  vision?: VisionAssessment
}

/** Complaints list response from GET /complaints */
export interface ComplaintsListResponse {
  count: number
  complaints: ComplaintRecord[]
}

/** Location data for map */
export interface LocationData {
  lat: number
  lng: number
  address: string
}

/** Dashboard stats response from GET /dashboard/stats */
export interface DashboardStats {
  total: number
  priority: {
    critical: number
    high: number
    medium: number
    low: number
  }
  status: {
    pending: number
    assigned: number
    in_progress: number
    resolved: number
  }
  departments: Record<string, number>
}
