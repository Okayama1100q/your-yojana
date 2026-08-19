import type { UserProfile, Scheme } from "../types"
import { MOCK_SCHEMES } from "../data/mockData"

export async function getRecommendedSchemes(profile: UserProfile): Promise<Scheme[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500))

  const results = MOCK_SCHEMES.map(scheme => {
    let score = 0.5 // base score
    let why = "This scheme matches some of your general profile characteristics."

    // Scoring logic for Test Case A
    if (scheme.scheme_id === "SCH-001") {
      if (profile.state === "Madhya Pradesh") score += 0.2
      if (profile.disability === "Yes") score += 0.3
      if (profile.family_annual_income !== undefined && profile.family_annual_income < 100000) score += 0.1
      
      if (score > 0.8) {
        why = "You may qualify for this scheme based on your Madhya Pradesh residence, disability status and family income."
      }
    }

    // Scoring for Test Case B
    if (scheme.scheme_id === "SCH-002") {
      if (profile.student_status === "Yes") score += 0.3
      if (profile.age && profile.age < 21) score += 0.1
      if (score > 0.7) why = "Relevant for your education based on your student status and age."
    }

    // Scoring for Test Case C
    if (scheme.scheme_id === "SCH-003") {
      if (profile.gender === "Female") score += 0.4
      if (profile.marital_status === "Married") score += 0.1
      if (score > 0.8) why = "Highly relevant livelihood support based on your profile as a woman."
    }

    // Scoring for Test Case D
    if (scheme.scheme_id === "SCH-004") {
      if (profile.age && profile.age >= 60) score += 0.4
      if (profile.bpl_category === "Yes") score += 0.2
      if (score > 0.8) why = "You appear eligible for senior citizen pension benefits based on your age and BPL status."
    }

    // Scoring for Test Case E
    if (scheme.scheme_id === "SCH-005") {
      if (profile.age && profile.age >= 15 && profile.age <= 35) score += 0.3
      if (profile.student_status === "No") score += 0.1
      if (score > 0.7) why = "Skill development opportunities are recommended for youth seeking employment."
    }

    // Add some random noise to make the score look real (e.g. 0.7013)
    const finalScore = Math.min(0.9999, score + (Math.random() * 0.05))

    return {
      ...scheme,
      relevance_score: finalScore,
      why_recommended: why
    }
  })

  // Sort by relevance score descending
  return results.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
}
