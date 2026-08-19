import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { useQuestionnaire } from "../../hooks/useQuestionnaire"
import { INDIAN_STATES } from "../../data/mockData"
import { cn } from "../../utils/utils"

const steps = [
  { title: "Personal Details" },
  { title: "Location" },
  { title: "Community" },
  { title: "Identity" },
  { title: "Status" },
  { title: "Financials" },
  { title: "Documents" },
]

export function SchemeQuestionnaire() {
  const navigate = useNavigate()
  const { profile, updateProfile, currentStep, nextStep, prevStep } = useQuestionnaire()
  const [direction, setDirection] = useState(1)

  const handleNext = () => {
    setDirection(1)
    if (currentStep < steps.length - 1) {
      nextStep()
    } else {
      // Submit and go to results
      navigate("/schemes/results", { state: { profile } })
    }
  }

  const handlePrev = () => {
    setDirection(-1)
    prevStep()
  }

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  }

  // --- Step Components ---

  const Step1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Tell us about yourself</h2>
      
      <div className="space-y-4">
        <label className="text-lg font-medium">What is your gender?</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["Male", "Female", "Transgender"].map((option) => (
            <OptionCard 
              key={option} 
              label={option} 
              selected={profile.gender === option}
              onClick={() => updateProfile({ gender: option })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <label className="text-lg font-medium">What is your age?</label>
        <Input 
          type="number" 
          placeholder="e.g. 25" 
          className="max-w-xs text-lg py-6"
          value={profile.age || ""}
          onChange={(e) => updateProfile({ age: parseInt(e.target.value) || undefined })}
        />
      </div>
    </div>
  )

  const Step2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Where do you live?</h2>
      
      <div className="space-y-4">
        <label className="text-lg font-medium">Please select your state</label>
        <select 
          className="flex h-12 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          value={profile.state || ""}
          onChange={(e) => updateProfile({ state: e.target.value })}
        >
          <option value="" disabled>Select a state</option>
          {INDIAN_STATES.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4 pt-4">
        <label className="text-lg font-medium">Please select your area of residence</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["Urban", "Rural"].map((option) => (
            <OptionCard 
              key={option} 
              label={option} 
              selected={profile.area_of_residence === option}
              onClick={() => updateProfile({ area_of_residence: option })}
            />
          ))}
        </div>
      </div>
    </div>
  )

  const Step3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Tell us about your community</h2>
      
      <div className="space-y-4">
        <label className="text-lg font-medium">You belong to...</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            "General",
            "Other Backward Class (OBC)",
            "Particularly Vulnerable Tribal Group (PVTG)",
            "Scheduled Caste (SC)",
            "Scheduled Tribe (ST)",
            "De-Notified, Nomadic, and Semi-Nomadic (DNT) communities"
          ].map((option) => (
            <OptionCard 
              key={option} 
              label={option} 
              selected={profile.community === option}
              onClick={() => updateProfile({ community: option })}
              className="text-left justify-start px-6"
            />
          ))}
        </div>
      </div>
    </div>
  )

  const Step4 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Identity Details</h2>
      
      <div className="space-y-4">
        <label className="text-lg font-medium">Do you identify as a person with a disability?</label>
        <div className="grid grid-cols-2 gap-4">
          {["Yes", "No"].map((option) => (
            <OptionCard 
              key={option} 
              label={option} 
              selected={profile.disability === option}
              onClick={() => updateProfile({ disability: option as "Yes"|"No" })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <label className="text-lg font-medium">Do you belong to a minority community?</label>
        <div className="grid grid-cols-2 gap-4">
          {["Yes", "No"].map((option) => (
            <OptionCard 
              key={option} 
              label={option} 
              selected={profile.minority_status === option}
              onClick={() => updateProfile({ minority_status: option as "Yes"|"No" })}
            />
          ))}
        </div>
      </div>
    </div>
  )

  const Step5 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Current Status</h2>
      
      <div className="space-y-4">
        <label className="text-lg font-medium">Are you currently a student?</label>
        <div className="grid grid-cols-2 gap-4">
          {["Yes", "No"].map((option) => (
            <OptionCard 
              key={option} 
              label={option} 
              selected={profile.student_status === option}
              onClick={() => updateProfile({ student_status: option as "Yes"|"No" })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <label className="text-lg font-medium">What is your marital status?</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {["Single", "Married", "Widowed", "Divorced", "Separated"].map((option) => (
            <OptionCard 
              key={option} 
              label={option} 
              selected={profile.marital_status === option}
              onClick={() => updateProfile({ marital_status: option })}
            />
          ))}
        </div>
      </div>
    </div>
  )

  const Step6 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Financial Details</h2>
      
      <div className="space-y-4">
        <label className="text-lg font-medium">Do you belong to BPL category?</label>
        <div className="grid grid-cols-2 gap-4">
          {["Yes", "No"].map((option) => (
            <OptionCard 
              key={option} 
              label={option} 
              selected={profile.bpl_category === option}
              onClick={() => updateProfile({ bpl_category: option as "Yes"|"No" })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <label className="text-lg font-medium">What is your family's annual income?</label>
        <div className="relative max-w-sm">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
          <Input 
            type="number" 
            placeholder="0" 
            className="pl-8 text-lg py-6"
            value={profile.family_annual_income || ""}
            onChange={(e) => updateProfile({ family_annual_income: parseInt(e.target.value) || undefined })}
          />
        </div>
      </div>
      
      <div className="space-y-4 pt-4">
        <label className="text-lg font-medium">What is your parent / guardian's annual income? <span className="text-sm text-muted-foreground font-normal">(Optional)</span></label>
        <div className="relative max-w-sm">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
          <Input 
            type="number" 
            placeholder="0" 
            className="pl-8 text-lg py-6"
            value={profile.parent_guardian_annual_income || ""}
            onChange={(e) => updateProfile({ parent_guardian_annual_income: parseInt(e.target.value) || undefined })}
          />
        </div>
      </div>
    </div>
  )

  const Step7 = () => {
    const docs = [
      "Aadhaar", "Income Certificate", "Community/Caste Certificate",
      "Disability Certificate", "BPL/Ration Card", "Residence/Domicile Certificate",
      "Student/Enrollment Certificate", "Other"
    ]
    
    const toggleDoc = (doc: string) => {
      const current = profile.documents_available || []
      const updated = current.includes(doc) 
        ? current.filter(d => d !== doc)
        : [...current, doc]
      updateProfile({ documents_available: updated })
    }

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">What documents do you have?</h2>
        <p className="text-muted-foreground">This helps us match you with schemes you can apply for immediately.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {docs.map((doc) => {
            const isSelected = (profile.documents_available || []).includes(doc)
            return (
              <div 
                key={doc}
                onClick={() => toggleDoc(doc)}
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl cursor-pointer transition-all",
                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md border",
                  isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                )}>
                  {isSelected && <Check className="h-4 w-4" />}
                </div>
                <span className="font-medium">{doc}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <Step1 />
      case 1: return <Step2 />
      case 2: return <Step3 />
      case 3: return <Step4 />
      case 4: return <Step5 />
      case 5: return <Step6 />
      case 6: return <Step7 />
      default: return null
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        
        {/* Progress Indicator */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm font-medium text-primary">
              {steps[currentStep].title}
            </span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border shadow-sm rounded-3xl p-6 md:p-10 min-h-[500px] flex flex-col relative overflow-hidden">
          
          <div className="flex-1 relative">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={currentStep}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="w-full absolute inset-0"
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-8 pt-6 border-t border-border flex justify-between items-center">
            <Button 
              variant="ghost" 
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={currentStep === 0 ? "invisible" : ""}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            
            <Button size="lg" onClick={handleNext} className="rounded-full px-8">
              {currentStep === steps.length - 1 ? "View Results" : "Next"} 
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}

function OptionCard({ label, selected, onClick, className }: { label: string, selected: boolean, onClick: () => void, className?: string }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center h-16 px-4 rounded-xl border-2 transition-all font-medium text-lg w-full",
        selected 
          ? "border-primary bg-primary/5 text-primary shadow-sm" 
          : "border-border bg-card text-foreground hover:border-primary/40",
        className
      )}
    >
      {label}
      {selected && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="ml-3 h-5 w-5 bg-primary rounded-full flex items-center justify-center text-primary-foreground"
        >
          <Check className="h-3 w-3" />
        </motion.div>
      )}
    </motion.button>
  )
}
