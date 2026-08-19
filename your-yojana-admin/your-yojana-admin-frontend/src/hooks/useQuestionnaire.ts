import { useState } from "react"
import type { UserProfile } from "../types"

export function useQuestionnaire() {
  const [profile, setProfile] = useState<UserProfile>({})
  const [currentStep, setCurrentStep] = useState(0)

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => setCurrentStep(prev => prev + 1)
  const prevStep = () => setCurrentStep(prev => Math.max(0, prev - 1))
  const reset = () => {
    setProfile({})
    setCurrentStep(0)
  }

  return {
    profile,
    updateProfile,
    currentStep,
    nextStep,
    prevStep,
    reset
  }
}
