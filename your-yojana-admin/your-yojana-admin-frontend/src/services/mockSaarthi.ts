import type { UserProfile, Scheme, Enrollment } from "../types"

export async function startEnrollment(_profile: UserProfile, scheme: Scheme): Promise<Enrollment> {
  await new Promise(resolve => setTimeout(resolve, 1200))
  
  const id = Math.floor(10000 + Math.random() * 90000)
  
  return {
    enrollment_id: `ENR-${id}`,
    scheme_id: scheme.scheme_id,
    scheme_name: scheme.scheme_name,
    status: "Registration Pending",
    required_documents: scheme.required_documents,
    next_action: "Submit required documents for verification.",
    progress: 10,
    last_updated: new Date().toISOString()
  }
}

export async function getDashboard(_userId: string): Promise<Enrollment[]> {
  await new Promise(resolve => setTimeout(resolve, 800))
  
  // Return some mock dashboard data
  return [
    {
      enrollment_id: "ENR-10001",
      scheme_id: "SCH-001",
      scheme_name: "Madhya Pradesh Kalakar Evam Sahityakar Kalyan Kosh Niyam - Disability Assistance",
      status: "Verification Pending",
      required_documents: ["Aadhaar", "Disability Certificate", "Income Certificate"],
      next_action: "Document verification in progress.",
      progress: 50,
      last_updated: new Date(Date.now() - 86400000).toISOString()
    }
  ]
}
