import { useState, useEffect } from "react"
import { useParams, Link, useNavigate, useLocation } from "react-router-dom"
import { CheckCircle2, Clock, ArrowRight, Upload, X, FileText, AlertCircle, RefreshCw, Trash2, Eye } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "../components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card"
import { useUser } from "../hooks/useUser"
import { getCitizenDashboard, updateLifecycleStatus } from "../services/saarthiService"

interface MockFile {
  name: string
  size: string
  url: string
  type: string
}

export function Enrollment() {
  const { enrollmentId } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const location = useLocation()
  
  const [enrollment, setEnrollment] = useState<any>(location.state?.enrollment || null)
  const [loading, setLoading] = useState(!enrollment)
  const [refreshing, setRefreshing] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, MockFile>>({})
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submittedForReview, setSubmittedForReview] = useState(false)

  // Fetch enrollment detail from citizen dashboard
  const fetchDetails = async (showRefreshSpinner = false) => {
    if (!user || !enrollmentId) return
    if (showRefreshSpinner) setRefreshing(true)
    else setLoading(true)
    
    try {
      const dash = await getCitizenDashboard(user.mobile || "USR-1001")
      const found = dash.enrollments.find((e: any) => e.enrollment_id === enrollmentId)
      if (found) {
        setEnrollment(found)
      }
    } catch (err) {
      console.error("Failed to fetch enrollment details", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDetails()
  }, [user, enrollmentId])

  // Get required documents list
  const getRequiredDocsList = () => {
    if (enrollment?.required_documents) return enrollment.required_documents
    
    // Fallback guess based on name keywords
    const docs = ["Aadhaar"]
    const name = (enrollment?.scheme_name || "").toLowerCase()
    if (name.includes("disability") || name.includes("kalakar")) docs.push("Disability Certificate")
    if (name.includes("kisan") || name.includes("farmer") || name.includes("income")) docs.push("Income Certificate")
    if (name.includes("scholarship") || name.includes("student")) docs.push("Student/Enrollment Certificate")
    if (name.includes("pension") || name.includes("bpl") || name.includes("old age")) docs.push("BPL/Ration Card")
    return docs
  }

  const requiredDocs = getRequiredDocsList()

  const handleSimulatedUpload = (docType: string, file: File) => {
    setUploadingDoc(docType)
    setUploadProgress(0)
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            const mockUrl = `https://mockyojana.gov/uploads/${enrollmentId}-${docType.replace(/\s+/g, "")}-${file.name}`
            setUploadedDocs(prevDocs => {
              const updated = {
                ...prevDocs,
                [docType]: {
                  name: file.name,
                  size: `${(file.size / 1024).toFixed(1)} KB`,
                  url: mockUrl,
                  type: file.type
                }
              }
              // Save mock URL mapping for Admin view share
              localStorage.setItem(`yoryojana-docs-${enrollmentId}`, JSON.stringify(
                Object.fromEntries(Object.entries(updated).map(([k, v]) => [k, v.url]))
              ))
              return updated
            })
            setUploadingDoc(null)
          }, 300)
          return 100
        }
        return prev + 20
      })
    }, 100)
  }

  const handleRemoveDoc = (docType: string) => {
    setUploadedDocs(prev => {
      const copy = { ...prev }
      delete copy[docType]
      localStorage.setItem(`yoryojana-docs-${enrollmentId}`, JSON.stringify(
        Object.fromEntries(Object.entries(copy).map(([k, v]) => [k, v.url]))
      ))
      return copy
    })
  }

  const handleSubmitForReview = async () => {
    setSubmitting(true)
    // Simulate short network delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    setSubmitting(false)
    setSubmittedForReview(true)
  }

  const handleActivateScheme = async () => {
    if (!enrollmentId || !user) return
    setSubmitting(true)
    try {
      await updateLifecycleStatus(enrollmentId, user.mobile || "USR-1001", "ACTIVE")
      await fetchDetails()
    } catch (err: any) {
      alert(err.message || "Failed to activate scheme.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentStatus = enrollment?.status || "REGISTRATION_PENDING"
  const allUploaded = requiredDocs.every(doc => uploadedDocs[doc])

  // Map backend status to timeline steps
  const timelineSteps = [
    { id: "01", label: "Scheme Selected", status: "completed" },
    { id: "02", label: "Enrollment Created", status: "completed" },
    { 
      id: "03", 
      label: "Documents Uploaded", 
      status: (currentStatus === "REGISTRATION_PENDING" || currentStatus === "DOCUMENT_CORRECTION_REQUIRED") 
        ? (allUploaded && submittedForReview ? "completed" : "current") 
        : "completed" 
    },
    { 
      id: "04", 
      label: "Admin Review", 
      status: (currentStatus === "APPROVED" || currentStatus === "ACTIVE")
        ? "completed" 
        : (currentStatus === "REGISTRATION_PENDING" && submittedForReview) ? "current" : "pending" 
    },
    { 
      id: "05", 
      label: "Scheme Active", 
      status: currentStatus === "ACTIVE" ? "completed" : "pending" 
    },
  ]

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-erode text-3xl font-black uppercase tracking-tight">Your application journey</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Enrollment ID: <span className="font-mono text-foreground font-semibold bg-muted px-2 py-0.5 border border-foreground">{enrollmentId}</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchDetails(true)} disabled={refreshing} className="rounded-none border-2 border-foreground">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="bg-card border-2 border-foreground rounded-none p-6 md:p-8 mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
        
        {/* Stark Brutalist Timeline */}
        <div className="relative mb-12 border-b border-foreground/10 pb-8">
          <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
            {timelineSteps.map((step, i) => (
              <div key={i} className="flex md:flex-col items-center md:text-center gap-4 md:gap-2 flex-1">
                <div className={`w-10 h-10 border-2 border-foreground flex items-center justify-center font-mono font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]
                  ${step.status === "completed" ? "bg-primary text-primary-foreground" : 
                    step.status === "current" ? "bg-amber-400 text-black animate-pulse" : 
                    "bg-background text-muted-foreground"}`}
                >
                  {step.status === "completed" ? "✓" : step.id}
                </div>
                <div className="md:mt-1">
                  <p className={`text-xs font-bold uppercase tracking-wider ${step.status === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current status block */}
        <div className="bg-muted/30 p-6 rounded-none border-2 border-foreground mb-8">
          <div className="flex items-start gap-4">
            <Clock className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-erode font-black text-lg uppercase tracking-tight mb-2">
                Status: {currentStatus.replace(/_/g, " ")}
              </h3>
              
              {currentStatus === "REGISTRATION_PENDING" && !submittedForReview && (
                <p className="text-xs font-mono text-muted-foreground">
                  Please upload all required certificates below to submit your application.
                </p>
              )}

              {currentStatus === "REGISTRATION_PENDING" && submittedForReview && (
                <div className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                  ✓ Documents uploaded. Awaiting manual review and AI verification by the administrator.
                </div>
              )}

              {currentStatus === "DOCUMENT_CORRECTION_REQUIRED" && (
                <div className="space-y-2">
                  <p className="text-xs font-mono text-destructive font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Action Required: Document Correction Requested
                  </p>
                  <p className="text-xs text-foreground bg-red-50 dark:bg-red-950/20 p-3 border border-red-500/20 font-mono">
                    <strong>Reason:</strong> {enrollment?.last_verification_reason || "The uploaded certificate appears blurry or invalid. Please re-upload a clear copy."}
                  </p>
                </div>
              )}

              {currentStatus === "APPROVED" && (
                <div className="space-y-4">
                  <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Documents Verified!
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your document verification succeeded. The scheme is approved and ready for activation.
                  </p>
                  <Button onClick={handleActivateScheme} disabled={submitting} className="rounded-none border-2 border-foreground font-bold uppercase text-xs tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    Activate Scheme
                  </Button>
                </div>
              )}

              {currentStatus === "ACTIVE" && (
                <div className="space-y-2">
                  <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Scheme is Active
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Benefits dispatches and welfare status is active. Check your dashboard for benefit disbursements.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Document Upload Area */}
        {(currentStatus === "REGISTRATION_PENDING" || currentStatus === "DOCUMENT_CORRECTION_REQUIRED") && !submittedForReview && (
          <div className="space-y-6">
            <h3 className="font-erode font-black text-lg uppercase tracking-tight border-b border-foreground/10 pb-2">Documents Required for Verification</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requiredDocs.map(doc => {
                const file = uploadedDocs[doc]
                const isUploading = uploadingDoc === doc
                
                return (
                  <Card key={doc} className="rounded-none border-2 border-foreground bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-black uppercase tracking-wider text-foreground">{doc}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {file ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 bg-muted/40 border border-border p-3 rounded-none">
                            <FileText className="h-8 w-8 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold font-mono truncate text-foreground">{file.name}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{file.size}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveDoc(doc)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex-1 border border-foreground px-3 py-1 text-center font-mono text-[10px] uppercase font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                              <Eye className="w-3.5 h-3.5" /> Preview File
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {isUploading ? (
                            <div className="space-y-2 py-4">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span>UPLOADING...</span>
                                <span>{uploadProgress}%</span>
                              </div>
                              <div className="h-1.5 bg-muted border border-foreground overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-100" style={{ width: `${uploadProgress}%` }} />
                              </div>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-border p-6 text-center hover:border-foreground/50 transition-colors relative cursor-pointer">
                              <input 
                                type="file" 
                                accept="application/pdf,image/*" 
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  const selected = e.target.files?.[0]
                                  if (selected) handleSimulatedUpload(doc, selected)
                                }}
                              />
                              <Upload className="h-6 w-6 mx-auto text-muted-foreground opacity-50 mb-2" />
                              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Upload PDF / Image</p>
                              <p className="text-[9px] font-mono text-slate-400 mt-1">PDF, JPG, JPEG, PNG</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="pt-4 flex justify-end">
              <Button 
                onClick={handleSubmitForReview} 
                disabled={!allUploaded || submitting}
                className="rounded-none border-2 border-foreground font-bold uppercase text-xs tracking-widest px-8 py-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Submit for Verification"}
              </Button>
            </div>
          </div>
        )}

        {submittedForReview && currentStatus === "REGISTRATION_PENDING" && (
          <div className="border-2 border-foreground p-6 bg-slate-50 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h3 className="font-erode font-black text-lg uppercase tracking-tight">Application Submitted Successfully</h3>
            <p className="text-xs text-muted-foreground font-mono max-w-md mx-auto leading-relaxed">
              Your document package is currently listed in the administrator resolution pending queue. Switch to the Government Control Center on the Admin portal to process and approve.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <Button size="lg" className="rounded-none border-2 border-foreground font-bold uppercase tracking-wider text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" asChild>
          <Link to="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>

    </div>
  )
}
