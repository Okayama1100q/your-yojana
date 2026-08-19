import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, CheckCircle, Share2, Bookmark, ExternalLink } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { MOCK_SCHEMES } from "../../data/mockData"
import { useUser } from "../../hooks/useUser"
import { startEnrollment } from "../../services/mockSaarthi"

export function SchemeDetails() {
  const { schemeId } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  
  const [showProceed, setShowProceed] = useState(false)
  const [isEnrollmentStarting, setIsEnrollmentStarting] = useState(false)

  const scheme = MOCK_SCHEMES.find(s => s.scheme_id === schemeId)

  if (!scheme) {
    return <div className="p-12 text-center text-xl">Scheme not found.</div>
  }

  const handleProceedClick = () => {
    if (!user) {
      alert("Please sign in first to apply for schemes. Demo note: Use 9876543210 and OTP 123456.")
      return
    }
    setShowProceed(true)
  }

  const handleConfirmProceed = async () => {
    if (!user) return
    setIsEnrollmentStarting(true)
    const enrollment = await startEnrollment(user.profile || {}, scheme)
    setIsEnrollmentStarting(false)
    navigate(`/enrollment/${enrollment.enrollment_id}`, { state: { enrollment } })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
      </Button>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Main Content */}
        <div className="w-full md:w-2/3 space-y-12">
          
          <header className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{scheme.ministry}</p>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{scheme.scheme_name}</h1>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-3 py-1 bg-secondary text-secondary-foreground text-sm font-medium rounded-full">{scheme.category}</span>
              <span className="px-3 py-1 bg-muted text-muted-foreground text-sm font-medium rounded-full">{scheme.state}</span>
            </div>
            
            <p className="text-lg text-foreground/80 leading-relaxed pt-4">
              {scheme.description}
            </p>
          </header>

          <section>
            <h3 className="text-2xl font-bold mb-4 flex items-center"><CheckCircle className="mr-2 h-6 w-6 text-primary" /> Benefits</h3>
            <ul className="space-y-3">
              {scheme.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start bg-card p-4 rounded-xl border border-border">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary mr-3 flex-shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-2xl font-bold mb-4">Eligibility Criteria</h3>
            <ul className="list-disc list-outside ml-5 space-y-2 text-foreground/80">
              {scheme.eligibility_criteria.map((criteria, i) => (
                <li key={i} className="pl-1">{criteria}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-2xl font-bold mb-4">Required Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scheme.required_documents.map((doc, i) => (
                <div key={i} className="flex items-center p-3 border border-border rounded-lg bg-card">
                  <span className="text-sm font-medium">{doc}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        <div className="w-full md:w-1/3">
          <div className="sticky top-24 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-bold mb-4">Apply Now</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Ready to claim your benefits? Start your application journey with Saarthi.
              </p>
              <Button size="lg" className="w-full rounded-full mb-3" onClick={handleProceedClick}>
                Proceed to Apply
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-full"><Bookmark className="mr-2 h-4 w-4" /> Save</Button>
                <Button variant="outline" className="flex-1 rounded-full"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-2xl p-6">
              <h4 className="font-semibold mb-2">Sources & References</h4>
              <a href="#" className="flex items-center text-sm text-primary hover:underline">
                Official Scheme Guidelines <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* Proceed Modal */}
      <AnimatePresence>
        {showProceed && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
              onClick={() => setShowProceed(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-4"
            >
              <div className="bg-card text-card-foreground border border-border shadow-xl rounded-2xl p-6 md:p-8">
                <h2 className="text-2xl font-bold mb-4">Ready to apply?</h2>
                <div className="bg-muted/30 p-4 rounded-xl border border-border mb-6">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Scheme Selected</h4>
                  <p className="font-medium">{scheme.scheme_name}</p>
                </div>

                <div className="bg-warning/10 border border-warning/30 p-4 rounded-xl mb-6">
                  <p className="text-sm text-foreground/90">
                    <strong>Note:</strong> Final eligibility and verification will be completed by the concerned authority. This platform assists with discovery and initial application packaging.
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <Button variant="ghost" onClick={() => setShowProceed(false)}>Cancel</Button>
                  <Button onClick={handleConfirmProceed} disabled={isEnrollmentStarting}>
                    {isEnrollmentStarting ? "Creating Enrollment..." : "I understand, Continue"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
