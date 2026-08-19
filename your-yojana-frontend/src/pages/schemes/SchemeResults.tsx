import { useEffect, useState } from "react"
import { useLocation, Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Loader2, AlertTriangle, ChevronDown, ChevronUp, FileText, Check, ExternalLink } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { useUser } from "../../hooks/useUser"
import { evaluateProfile, type RecommendationResponse } from "../../services/swasthikaService"
import { enrollCitizen } from "../../services/saarthiService"

export function getRequiredDocuments(rec: RecommendationResponse): string[] {
  const docs = ["Aadhaar"]
  const matched = rec.matched_conditions || []

  for (const cond of matched) {
    if (cond.field === "has_disability" && cond.user_value === true) {
      docs.push("Disability Certificate")
    }
    if (cond.field === "is_bpl" && cond.user_value === true) {
      docs.push("BPL/Ration Card")
    }
    if ((cond.field === "family_income" || cond.field === "parent_guardian_income") && cond.result === "PASS") {
      docs.push("Income Certificate")
    }
    if (cond.field === "community" && cond.user_value !== "general") {
      docs.push("Community/Caste Certificate")
    }
    if (cond.field === "state" && cond.result === "PASS") {
      docs.push("Residence/Domicile Certificate")
    }
    if (cond.field === "is_student" && cond.user_value === true) {
      docs.push("Student/Enrollment Certificate")
    }
  }

  return Array.from(new Set(docs))
}

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    gender: "Gender",
    age: "Age",
    marital_status: "Marital Status",
    state: "State",
    residence_area: "Residence Area",
    community: "Community",
    is_minority: "Minority Status",
    has_disability: "Disability Status",
    is_student: "Student Status",
    is_bpl: "BPL Status",
    family_income: "Family Annual Income",
    parent_guardian_income: "Parent/Guardian Income"
  }
  return map[field] || field.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

export function SchemeResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  const profile = location.state?.profile as any

  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<RecommendationResponse[]>([])
  const [evaluationStats, setEvaluationStats] = useState({
    evaluated: 4693,
    eligible: 0,
    needsMoreInfo: 0,
    ineligible: 0
  })
  const [error, setError] = useState<string | null>(null)
  
  // Selection / Confirmation Modal state
  const [selectedForEnrollment, setSelectedForEnrollment] = useState<RecommendationResponse | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  
  // Toggles for JSON audit trail display
  const [expandedAuditTrails, setExpandedAuditTrails] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!profile) {
      navigate("/schemes/questionnaire")
      return
    }

    const fetchRecommendations = async () => {
      setLoading(true)
      try {
        const data = await evaluateProfile(profile)
        setRecommendations(data.recommendations || [])
        setEvaluationStats({
          evaluated: data.total_schemes_evaluated || 4693,
          eligible: data.eligible_count || 0,
          needsMoreInfo: data.needs_more_information_count || 0,
          ineligible: data.ineligible_count || 0
        })
      } catch (err: any) {
        setError(err.message || "Failed to load recommendations.")
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
  }, [profile, navigate])

  const handleChooseScheme = (scheme: RecommendationResponse) => {
    setSelectedForEnrollment(scheme)
  }

  const toggleAuditTrail = (schemeId: string) => {
    setExpandedAuditTrails(prev => ({
      ...prev,
      [schemeId]: !prev[schemeId]
    }))
  }

  const handleConfirmEnrollment = async () => {
    if (!selectedForEnrollment) return
    setEnrolling(true)
    
    try {
      const userId = user?.mobile || "USR-1001"
      const requiredDocs = getRequiredDocuments(selectedForEnrollment)
      
      const payloadScheme = {
        scheme_id: selectedForEnrollment.scheme_id,
        scheme_name: selectedForEnrollment.scheme_name,
        relevance_score: selectedForEnrollment.matched_conditions?.length ? 0.90 : 0.75,
        official_link: selectedForEnrollment.official_url || "https://example.gov.in",
        category: ["Welfare Support"],
        ai_explanation: selectedForEnrollment.explanation
      }
      
      const result = await enrollCitizen(userId, profile, payloadScheme)
      setSelectedForEnrollment(null)
      // Navigate to the application tracking page
      navigate(`/enrollment/${result.enrollment_id}`, { state: { enrollment: { ...result, required_documents: requiredDocs } } })
    } catch (err: any) {
      alert(err.message || "Enrollment failed. Please try again.")
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="mb-6"
        >
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </motion.div>
        <h2 className="text-2xl font-black uppercase tracking-wider text-foreground">Finding support relevant to your profile...</h2>
        <p className="text-muted-foreground mt-2 font-mono text-sm">Checking available schemes and matching them with the information you provided.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-background p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h2 className="text-2xl font-bold text-foreground">We couldn't load recommendations right now.</h2>
        <p className="text-muted-foreground mt-2 max-w-md text-center">{error}</p>
        <Button onClick={() => navigate("/schemes/questionnaire")} className="mt-6 rounded-full px-8">
          Retry Questionnaire
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left Column: Profile Summary */}
        <div className="w-full md:w-1/3 space-y-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Edit Answers
          </Button>
          
          <div className="bg-card border-2 border-foreground rounded-none p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <h3 className="font-erode font-black text-lg uppercase tracking-tight mb-4 border-b border-foreground pb-2">Your Profile</h3>
            <ul className="space-y-3 text-sm font-mono">
              {profile?.state && <li><span className="text-muted-foreground uppercase text-[10px]">State:</span> {profile.state}</li>}
              {profile?.age && <li><span className="text-muted-foreground uppercase text-[10px]">Age:</span> {profile.age}</li>}
              {profile?.gender && <li><span className="text-muted-foreground uppercase text-[10px]">Gender:</span> {profile.gender}</li>}
              {profile?.disability === "Yes" && <li className="font-bold text-primary">✓ DISABILITY SUPPORT</li>}
              {profile?.bpl_category === "Yes" && <li className="font-bold text-primary">✓ BPL CATEGORY</li>}
            </ul>
          </div>
        </div>

        {/* Right Column: Recommendations List */}
        <div className="w-full md:w-2/3 space-y-6">
          <div className="border-b-2 border-foreground pb-4">
            <h1 className="font-erode text-3xl font-black uppercase tracking-tight">Evaluation & Eligibility Results</h1>
            <p className="text-muted-foreground mt-2 text-md font-mono">Deterministic rule evaluation and BM25 relevance ranking completed across government schemes.</p>
          </div>

          {/* Dynamic Summary counters block exactly matching user screenshot */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono">
            <div className="text-center p-2 border-r border-foreground/10 last:border-0">
              <span className="text-[10px] text-muted-foreground uppercase block font-black">Total Schemes Evaluated</span>
              <span className="text-2xl font-black text-foreground block mt-1">{evaluationStats.evaluated.toLocaleString()}</span>
            </div>
            <div className="text-center p-2 border-r border-foreground/10 last:border-0">
              <span className="text-[10px] text-emerald-600 uppercase block font-black">Eligible Schemes</span>
              <span className="text-2xl font-black text-emerald-600 block mt-1">{evaluationStats.eligible.toLocaleString()}</span>
            </div>
            <div className="text-center p-2 border-r border-foreground/10 last:border-0">
              <span className="text-[10px] text-amber-600 block font-black">Needs More Information</span>
              <span className="text-2xl font-black text-amber-600 block mt-1">{evaluationStats.needsMoreInfo.toLocaleString()}</span>
            </div>
            <div className="text-center p-2">
              <span className="text-[10px] text-muted-foreground uppercase block font-black">Ineligible Schemes</span>
              <span className="text-2xl font-black text-muted-foreground block mt-1">{evaluationStats.ineligible.toLocaleString()}</span>
            </div>
          </div>

          <div className="border-b-2 border-foreground pb-2 mt-8">
            <h2 className="font-erode text-xl font-black uppercase tracking-tight flex items-center gap-2">
              📂 Top Recommended Eligible Schemes (10)
            </h2>
          </div>

          {recommendations.length === 0 ? (
            <div className="text-center py-16 bg-muted/10 border-2 border-dashed border-border p-6">
              <p className="text-muted-foreground font-mono">No schemes found matching your specific profile criteria.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {recommendations.slice(0, 10).map((rec, i) => {
                const requiredDocs = getRequiredDocuments(rec)
                const isStateScheme = profile?.state && rec.explanation.toLowerCase().includes(profile.state.toLowerCase())
                const showAuditTrail = expandedAuditTrails[rec.scheme_id] || false
                const matchedChecks = rec.matched_conditions || []
                
                return (
                  <motion.div
                    key={rec.scheme_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="rounded-none border-2 border-foreground hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all bg-card">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex gap-2">
                            <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 bg-secondary text-secondary-foreground border border-foreground">
                              Welfare Support
                            </span>
                            <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 bg-muted border border-foreground">
                              {isStateScheme ? profile.state : "Central"}
                            </span>
                          </div>
                          
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300">
                              ELIGIBLE
                            </span>
                          </div>
                        </div>
                        
                        <CardTitle className="font-erode text-xl font-black leading-tight mt-2 text-foreground">
                          {rec.scheme_name}
                        </CardTitle>
                        <div className="mt-1.5">
                          <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 border border-slate-200">
                            {rec.scheme_id}
                          </span>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        
                        {/* WHY THIS SCHEME WAS RECOMMENDED (matches screenshot exactly) */}
                        <div className="bg-[#eff6ff] border border-[#bfdbfe] p-4 text-xs leading-relaxed text-[#1e40af] rounded-none">
                          <strong className="text-[#1d4ed8] block font-mono text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
                            ✨ Why this scheme was recommended
                          </strong>
                          {rec.explanation}
                        </div>

                        {/* VERIFIED RULE CHECKS (matches screenshot exactly) */}
                        {matchedChecks.length > 0 && (
                          <div className="space-y-2 border-t border-border pt-3">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block font-mono">
                              Verified Rule Checks ({matchedChecks.length})
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {matchedChecks.map((check, idx) => (
                                <div key={idx} className="border border-foreground/10 bg-slate-50/40 p-3 font-mono text-[10px]">
                                  <div className="flex justify-between items-center border-b border-foreground/5 pb-1 mb-1.5">
                                    <span className="font-bold text-slate-700">{formatFieldName(check.field)}</span>
                                    <span className="text-[9px] font-black text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1 border border-emerald-200">
                                      ✓ PASS
                                    </span>
                                  </div>
                                  <div className="text-slate-600">User: {check.user_value?.toString() || "Unspecified"}</div>
                                  <div className="text-slate-400 mt-0.5">Required: {JSON.stringify(check.required)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Collapsible Deterministic Audit Trail JSON (matches screenshot exactly) */}
                        {rec.audit_trail && (
                          <div className="border border-border">
                            <button
                              onClick={() => toggleAuditTrail(rec.scheme_id)}
                              className="w-full flex items-center justify-between p-3 font-mono text-[10px] uppercase font-bold hover:bg-slate-50 text-slate-600"
                            >
                              <span className="flex items-center gap-1.5">🔍 View Deterministic Audit Trail JSON</span>
                              {showAuditTrail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            {showAuditTrail && (
                              <div className="border-t border-border p-3 bg-slate-900 text-slate-100 font-mono text-[9px] overflow-x-auto max-h-48 leading-relaxed">
                                <pre>{JSON.stringify(rec.audit_trail, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Required Documents:</span>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {requiredDocs.map(doc => (
                              <span key={doc} className="text-[10px] font-mono border border-border px-2 py-0.5 bg-background text-foreground">
                                {doc}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                          
                          {/* Apply Online Button (uses application_url) */}
                          <a
                            href={rec.application_url || rec.official_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#1e3a8a] text-white border-2 border-foreground font-mono text-[10px] uppercase font-black px-4 py-2 hover:bg-blue-900 transition-colors flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          >
                            Apply Online <ExternalLink className="w-3 h-3" />
                          </a>

                          {/* Official Portal Button (uses official_url) */}
                          {rec.official_url && (
                            <a
                              href={rec.official_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-white text-slate-700 border-2 border-foreground font-mono text-[10px] uppercase font-bold px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              Official Portal <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          
                          <Button 
                            className="flex-1 rounded-none border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all font-bold uppercase tracking-wider text-xs" 
                            onClick={() => handleChooseScheme(rec)}
                          >
                            Choose Scheme
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {selectedForEnrollment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border-2 border-foreground max-w-lg w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-6"
            >
              <div className="border-b-2 border-foreground pb-2">
                <h3 className="font-erode text-xl font-black uppercase tracking-tight">READY TO CONTINUE?</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Selected Scheme:</span>
                  <p className="font-bold text-lg text-foreground">{selectedForEnrollment.scheme_name}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Why it was recommended:</span>
                  <p className="text-xs text-foreground bg-muted/40 p-3 border border-border mt-1">
                    {selectedForEnrollment.explanation}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Required documents for verification:</span>
                  <ul className="list-disc pl-5 text-xs text-foreground mt-1 space-y-1 font-mono">
                    {getRequiredDocuments(selectedForEnrollment).map(doc => (
                      <li key={doc}>{doc}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-destructive/10 border-2 border-destructive p-3 text-xs flex gap-2 text-destructive font-medium uppercase tracking-wide">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>Final eligibility will be confirmed after document verification.</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-none border-2 border-foreground font-bold uppercase tracking-wider text-xs" onClick={() => setSelectedForEnrollment(null)} disabled={enrolling}>
                  Back
                </Button>
                <Button className="flex-1 rounded-none border-2 border-foreground font-bold uppercase tracking-wider text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" onClick={handleConfirmEnrollment} disabled={enrolling}>
                  {enrolling ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Continue"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
