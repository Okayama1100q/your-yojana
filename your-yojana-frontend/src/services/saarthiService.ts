import type { UserProfile } from "../types"

const SAARTHI_URL = import.meta.env.VITE_SAARTHI_API_URL || "http://127.0.0.1:8003"

export interface SelectedScheme {
  scheme_id: string
  scheme_name: string
  relevance_score: number
  official_link: string
  category: string[]
  ai_explanation: string
}

function mapProfileToSaarthi(profile: UserProfile): any {
  return {
    gender: profile.gender || "Male",
    age: profile.age || 30,
    marital_status: profile.marital_status || "Single",
    state: profile.state || "Madhya Pradesh",
    area_of_residence: profile.area_of_residence || "Urban",
    community: profile.community || "General",
    disability: profile.disability === "Yes",
    minority_status: profile.minority_status === "Yes",
    student_status: profile.student_status === "Yes",
    bpl_category: profile.bpl_category === "Yes",
    family_annual_income: profile.family_annual_income || 0,
    parent_guardian_annual_income: profile.parent_guardian_annual_income || 0
  }
}

export async function enrollCitizen(userId: string, profile: UserProfile, scheme: SelectedScheme) {
  const payload = {
    user_id: userId,
    profile: mapProfileToSaarthi(profile),
    selected_scheme: scheme
  }

  const response = await fetch(`${SAARTHI_URL}/api/v1/saarthi/enroll`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `Saarthi enrollment error: ${response.status}`)
  }

  return response.json()
}

export async function getCitizenDashboard(userId: string) {
  const response = await fetch(`${SAARTHI_URL}/api/v1/saarthi/citizen/dashboard?user_id=${userId}`)
  if (!response.ok) {
    throw new Error(`Saarthi dashboard error: ${response.status}`)
  }
  return response.json()
}

export async function updateLifecycleStatus(enrollmentId: string, userId: string, status: string) {
  const response = await fetch(`${SAARTHI_URL}/api/v1/saarthi/enrollments/${enrollmentId}/lifecycle`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_id: userId, status })
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `Saarthi lifecycle error: ${response.status}`)
  }
  return response.json()
}

export async function getPendingEnrollments() {
  const response = await fetch(`${SAARTHI_URL}/api/v1/saarthi/admin/enrollments/pending`)
  if (!response.ok) {
    throw new Error(`Saarthi pending list error: ${response.status}`)
  }
  return response.json()
}

export async function verifyEnrollment(enrollmentId: string, documentUrl: string) {
  const response = await fetch(`${SAARTHI_URL}/api/v1/saarthi/admin/enrollments/${enrollmentId}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ document_url: documentUrl })
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `Saarthi verify error: ${response.status}`)
  }
  return response.json()
}

export async function disburseBenefits(enrollmentId: string, amount: number, remarks: string) {
  const response = await fetch(`${SAARTHI_URL}/api/v1/saarthi/admin/enrollments/${enrollmentId}/disbursements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount, remarks })
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `Saarthi disbursement error: ${response.status}`)
  }
  return response.json()
}
