import { useLocation, useParams, Link } from "react-router-dom"
import { CheckCircle2, Clock, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "../components/ui/Button"
import type { Enrollment as EnrollmentType } from "../types"

const timelineSteps = [
  { id: "01", label: "Scheme Selected", status: "completed" },
  { id: "02", label: "Enrollment Created", status: "completed" },
  { id: "03", label: "Document Verification", status: "current" },
  { id: "04", label: "Admin Review", status: "pending" },
  { id: "05", label: "Scheme Activation", status: "pending" },
]

export function Enrollment() {
  const { enrollmentId } = useParams()
  const location = useLocation()
  const enrollment = location.state?.enrollment as EnrollmentType | undefined

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="text-center mb-12">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </motion.div>
        <h1 className="text-3xl font-bold mb-2">Your application journey has started.</h1>
        <p className="text-muted-foreground">Enrollment ID: <span className="font-mono text-foreground font-semibold bg-muted px-2 py-1 rounded">{enrollmentId}</span></p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-10 mb-8 shadow-sm">
        
        {/* Timeline */}
        <div className="relative mb-12">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border md:left-0 md:right-0 md:top-6 md:bottom-auto md:h-px md:w-full"></div>
          
          <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-4 relative z-10">
            {timelineSteps.map((step, i) => (
              <div key={i} className="flex md:flex-col items-start md:items-center gap-4 md:gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-card shrink-0 shadow-sm
                  ${step.status === "completed" ? "bg-primary text-primary-foreground" : 
                    step.status === "current" ? "bg-primary/20 text-primary border-primary/30" : 
                    "bg-muted text-muted-foreground"}`}
                >
                  {step.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : step.id}
                </div>
                <div className="md:text-center mt-2 md:mt-0">
                  <p className={`font-medium ${step.status === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-muted/30 p-6 rounded-xl border border-border">
          <div className="flex items-start gap-4">
            <Clock className="h-6 w-6 text-primary mt-1 shrink-0" />
            <div>
              <h3 className="font-semibold text-lg mb-1">Current Status: {enrollment?.status || "Registration Pending"}</h3>
              <p className="text-muted-foreground mb-4">
                {enrollment?.next_action || "Prepare the required documents for verification."}
              </p>
              
              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium">Required Documents:</p>
                <div className="flex flex-wrap gap-2">
                  {(enrollment?.required_documents || ["Aadhaar", "Income Certificate"]).map(doc => (
                    <span key={doc} className="text-xs bg-background border border-border px-2 py-1 rounded">
                      {doc}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      <div className="flex justify-center">
        <Button size="lg" className="rounded-full px-8" asChild>
          <Link to="/dashboard">Go to My Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>

    </div>
  )
}
