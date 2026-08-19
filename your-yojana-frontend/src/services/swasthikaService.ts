import type { UserProfile, Scheme } from "../types"

const SWASTHIKA_URL = import.meta.env.VITE_SWASTHIKA_API_URL || "http://127.0.0.1:8002"
const SWASTHIKA_API_KEY = import.meta.env.VITE_SWASTHIKA_API_KEY || "swasthika_secret_key_123"

export interface RecommendationResponse {
  scheme_id: string
  scheme_name: string
  eligibility_status: string
  matched_conditions: any[]
  audit_trail: any
  explanation: string
  official_url?: string
  application_url?: string
  preference_notes?: string
}

export interface EvaluationResponse {
  status: string
  total_schemes_evaluated: number
  eligible_count: number
  needs_more_information_count: number
  ineligible_count: number
  recommendations: RecommendationResponse[]
  needs_more_information: any[]
  missing_fields_summary: Record<string, string[]>
}

export function mapProfileToBackend(profile: UserProfile): any {
  let gender = profile.gender ? profile.gender.toLowerCase() : undefined

  let marital_status = undefined
  if (profile.marital_status) {
    const statusMap: Record<string, string> = {
      "Single": "never_married",
      "Married": "married",
      "Widowed": "widowed",
      "Divorced": "divorced",
      "Separated": "separated"
    }
    marital_status = statusMap[profile.marital_status] || profile.marital_status.toLowerCase()
  }

  let residence_area = profile.area_of_residence ? profile.area_of_residence.toLowerCase() : undefined

  let community = undefined
  if (profile.community) {
    const communityMap: Record<string, string> = {
      "General": "general",
      "Other Backward Class (OBC)": "OBC",
      "Particularly Vulnerable Tribal Group (PVTG)": "PVTG",
      "Scheduled Caste (SC)": "SC",
      "Scheduled Tribe (ST)": "ST",
      "De-Notified, Nomadic, and Semi-Nomadic (DNT) communities": "DNSNT"
    }
    community = communityMap[profile.community] || profile.community
  }

  return {
    gender,
    age: profile.age,
    marital_status,
    state: profile.state,
    residence_area,
    community,
    is_minority: profile.minority_status === "Yes",
    has_disability: profile.disability === "Yes",
    is_student: profile.student_status === "Yes",
    is_bpl: profile.bpl_category === "Yes",
    family_income: profile.family_annual_income,
    parent_guardian_income: profile.parent_guardian_annual_income,
    extra_attributes: {}
  }
}

export async function evaluateProfile(profile: UserProfile): Promise<EvaluationResponse> {
  const backendProfile = mapProfileToBackend(profile)

  const response = await fetch(`${SWASTHIKA_URL}/api/swasthika/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SWASTHIKA-API-KEY": SWASTHIKA_API_KEY
    },
    body: JSON.stringify(backendProfile)
  })

  if (!response.ok) {
    throw new Error(`Swasthika API error: ${response.status} - ${response.statusText}`)
  }

  return response.json()
}
