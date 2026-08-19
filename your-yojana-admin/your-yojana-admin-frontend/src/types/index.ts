export interface UserProfile {
  gender?: string
  age?: number
  marital_status?: string
  state?: string
  area_of_residence?: string
  community?: string
  disability?: "Yes" | "No"
  minority_status?: "Yes" | "No"
  student_status?: "Yes" | "No"
  bpl_category?: "Yes" | "No"
  family_annual_income?: number
  parent_guardian_annual_income?: number
  documents_available?: string[]
}

export interface Scheme {
  scheme_id: string
  scheme_name: string
  state: string
  category: string
  relevance_score?: number
  benefits: string[]
  why_recommended?: string
  required_documents: string[]
  ministry: string
  description: string
  eligibility_criteria: string[]
  application_process: string[]
  faqs: { question: string; answer: string }[]
}

export type EnrollmentStatus = 
  | "Registration Pending"
  | "Verification Pending"
  | "Under Review"
  | "Correction Required"
  | "Approved"
  | "Active"
  | "Rejected"
  | "Expired"

export interface Enrollment {
  enrollment_id: string
  scheme_id: string
  scheme_name: string
  status: EnrollmentStatus
  required_documents: string[]
  next_action: string
  progress: number
  last_updated: string
}
