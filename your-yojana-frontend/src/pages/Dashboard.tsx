import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Clock, CheckCircle, IndianRupee, Loader2, RefreshCw, AlertTriangle, Play, Pause, PowerOff, ShieldAlert } from "lucide-react"
import { Button } from "../components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card"
import { useUser } from "../hooks/useUser"
import { getCitizenDashboard, updateLifecycleStatus } from "../services/saarthiService"
import { evaluateProfile } from "../services/swasthikaService"
import { Link, useNavigate } from "react-router-dom"

export function Dashboard() {
  const { user, updateProfile } = useUser()
  const navigate = useNavigate()
  
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingLifecycle, setUpdatingLifecycle] = useState<string | null>(null)
  
  // Re-evaluation / Profile change states
  const [evaluationAlert, setEvaluationAlert] = useState<{
    message: string
    schemeName: string
  } | null>(null)

  const fetchDashboard = async (showSpinner = false) => {
    if (!user) return
    if (showSpinner) setRefreshing(true)
    else setLoading(true)
    
    try {
      const data = await getCitizenDashboard(user.mobile || "USR-1001")
      setDashboardData(data)
      
      // Perform a silent check of eligibility based on current profile if they have active/approved schemes
      if (user.profile && data.enrollments?.length > 0) {
        checkContinuousEligibility(user.profile, data.enrollments)
      }
    } catch (err) {
      console.error("Error loading dashboard data", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!user) {
      navigate("/")
      return
    }
    fetchDashboard()
  }, [user, navigate])

  const checkContinuousEligibility = async (currentProfile: any, currentEnrollments: any[]) => {
    try {
      const evalResp = await evaluateProfile(currentProfile)
      const eligibleSlugs = new Set((evalResp.recommendations || []).map(r => r.scheme_id))
      
      // Find if any enrolled scheme is no longer in Swasthika's eligible recommendations
      const activeOrApproved = currentEnrollments.filter(e => e.status === "ACTIVE" || e.status === "APPROVED")
      
      for (const enr of activeOrApproved) {
        if (!eligibleSlugs.has(enr.scheme_id)) {
          setEvaluationAlert({
            schemeName: enr.scheme_name,
            message: `Based on your profile updates (e.g. age change), you are no longer deterministically eligible for this scheme.`
          })
          break
        }
      }
    } catch (err) {
      console.error("Silent eligibility evaluation failed", err)
    }
  }

  const handleUpdateAge = async (newAge: number) => {
    if (!user?.profile) return
    
    // Update local profile state
    const updatedProfile = { ...user.profile, age: newAge }
    updateProfile(updatedProfile)
    
    // Reset alert and check eligibility again
    setEvaluationAlert(null)
    if (dashboardData?.enrollments) {
      await checkContinuousEligibility(updatedProfile, dashboardData.enrollments)
    }
  }

  const handleLifecycleAction = async (enrollmentId: string, targetStatus: string) => {
    if (!user) return
    setUpdatingLifecycle(enrollmentId)
    
    try {
      await updateLifecycleStatus(enrollmentId, user.mobile || "USR-1001", targetStatus)
      await fetchDashboard(true)
    } catch (err: any) {
      alert(err.message || "Failed to update lifecycle status.")
    } finally {
      setUpdatingLifecycle(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const enrollments = dashboardData?.enrollments || []
  const activeCount = dashboardData?.active_enrollments_count || 0
  const pendingCount = enrollments.filter((e: any) => e.status !== "ACTIVE" && e.status !== "DISCONTINUED" && e.status !== "REJECTED").length
  const totalReceived = dashboardData?.total_benefits_amount || 0
  const estimatedSavings = totalReceived > 0 ? totalReceived * 0.25 : 0 // Generic savings mapping from support

  // Collect all disbursements across all schemes
  const allDisbursements: any[] = []
  enrollments.forEach((e: any) => {
    if (e.disbursements) {
      e.disbursements.forEach((d: any) => {
        allDisbursements.push({
          ...d,
          scheme_name: e.scheme_name,
          date: d.disbursed_at || new Date().toISOString()
        })
      })
    }
  })
  // Sort disbursements by date descending
  allDisbursements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-erode text-3xl font-black uppercase tracking-tight">Welcome back, {user?.name}.</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Here's what's happening with your support.</p>
        </div>
        <Button variant="outline" onClick={() => fetchDashboard(true)} disabled={refreshing} className="rounded-none border-2 border-foreground">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Re-evaluation Alert Notification */}
      <AnimatePresence>
        {evaluationAlert && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <div className="bg-destructive/10 border-2 border-destructive p-5 rounded-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-destructive shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]">
              <div className="flex gap-3">
                <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm uppercase tracking-wide">Continuous Eligibility Warning: Re-evaluation Required</h4>
                  <p className="text-xs font-mono mt-1 text-red-600 dark:text-red-400">
                    Your profile has changed. You may no longer qualify for: <strong>{evaluationAlert.schemeName}</strong>
                  </p>
                </div>
              </div>
              <Button className="rounded-none border-2 border-destructive hover:bg-destructive hover:text-white transition-all font-bold uppercase text-xs tracking-wider shrink-0 bg-transparent text-destructive" onClick={() => navigate("/schemes/questionnaire", { state: { profile: user?.profile } })}>
                Review Available Support
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <Card className="rounded-none border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">Active Schemes</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black font-mono text-foreground">{activeCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">Pending Applications</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black font-mono text-foreground">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">Support Utilized</CardTitle>
            <IndianRupee className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black font-mono text-emerald-600">₹{totalReceived.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">Estimated Savings</CardTitle>
            <IndianRupee className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black font-mono text-indigo-600">₹{estimatedSavings.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: My Schemes (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border-b border-border pb-2 flex justify-between items-center">
            <h2 className="font-erode text-2xl font-black uppercase tracking-tight">My Enrolled Schemes</h2>
            <Button size="xs" variant="outline" className="rounded-none border border-foreground" asChild>
              <Link to="/schemes">Find Schemes</Link>
            </Button>
          </div>

          {enrollments.length === 0 ? (
            <div className="text-center py-16 bg-muted/10 border-2 border-dashed border-border rounded-none p-6">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold uppercase tracking-tight">No active scheme applications</h3>
              <p className="text-muted-foreground mb-6 font-mono text-xs mt-1">Submit your welfare questionnaire to discover matching support.</p>
              <Button asChild className="rounded-none border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-xs tracking-wider">
                <Link to="/schemes/questionnaire">Find Schemes</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {enrollments.map((enr: any, i: number) => {
                const isUpdating = updatingLifecycle === enr.enrollment_id
                
                return (
                  <motion.div
                    key={enr.enrollment_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className={`rounded-none border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-card ${
                      evaluationAlert?.schemeName === enr.scheme_name ? "border-red-500 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)]" : ""
                    }`}>
                      <div className="flex flex-col p-6 gap-4">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold bg-muted text-muted-foreground px-2 py-0.5 border border-border">
                              {enr.enrollment_id}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center border
                              ${enr.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                                enr.status === "APPROVED" ? "bg-indigo-50 text-indigo-700 border-indigo-300" :
                                enr.status === "DOCUMENT_CORRECTION_REQUIRED" ? "bg-red-50 text-red-700 border-red-300" :
                                "bg-amber-50 text-amber-700 border-amber-300"}`}>
                              <Clock className="mr-1 h-3 w-3" /> {enr.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          
                          <div className="text-xs font-mono font-bold">
                            Total Disbursed: <span className="text-emerald-600">₹{enr.total_disbursed?.toLocaleString("en-IN") || 0}</span>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-erode font-black text-lg text-foreground uppercase tracking-tight">{enr.scheme_name}</h3>
                          
                          {enr.status === "DOCUMENT_CORRECTION_REQUIRED" && (
                            <p className="text-xs text-destructive font-mono mt-2 flex items-center gap-1.5 uppercase font-bold">
                              <AlertTriangle className="h-4 w-4" /> Correction required on certificates package.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border mt-1">
                          {/* Lifecycle controls */}
                          <div className="flex gap-2">
                            {enr.status === "ACTIVE" && (
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="rounded-none border border-foreground hover:bg-slate-100 flex items-center gap-1 text-[10px] font-bold"
                                onClick={() => handleLifecycleAction(enr.enrollment_id, "SUSPENDED")}
                                disabled={isUpdating}
                              >
                                <Pause className="w-3 h-3" /> Pause Benefit
                              </Button>
                            )}
                            
                            {enr.status === "SUSPENDED" && (
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="rounded-none border border-foreground hover:bg-slate-100 flex items-center gap-1 text-[10px] font-bold"
                                onClick={() => handleLifecycleAction(enr.enrollment_id, "ACTIVE")}
                                disabled={isUpdating}
                              >
                                <Play className="w-3 h-3" /> Resume Benefit
                              </Button>
                            )}

                            {(enr.status === "ACTIVE" || enr.status === "SUSPENDED") && (
                              <Button 
                                variant="ghost" 
                                size="xs" 
                                className="text-destructive hover:bg-destructive/10 rounded-none flex items-center gap-1 text-[10px] font-bold"
                                onClick={() => handleLifecycleAction(enr.enrollment_id, "DISCONTINUED")}
                                disabled={isUpdating}
                              >
                                <PowerOff className="w-3 h-3" /> Discontinue
                              </Button>
                            )}
                          </div>

                          <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <Button variant="outline" className="rounded-none border-2 border-foreground text-xs font-bold uppercase tracking-wider px-4 flex-1 sm:flex-initial" asChild>
                              <Link to={`/enrollment/${enr.enrollment_id}`}>
                                View Application
                              </Link>
                            </Button>
                          </div>
                        </div>

                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Profile & Payments Log (Col Span 1) */}
        <div className="space-y-8">
          
          {/* Profile & Eligibility Simulator */}
          <div className="bg-card border-2 border-foreground rounded-none p-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
            <h3 className="font-erode font-black text-md uppercase tracking-tight border-b border-foreground/10 pb-2 mb-4">Profile & Eligibility</h3>
            
            {user?.profile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="text-muted-foreground uppercase text-[10px]">CURRENT AGE:</div>
                  <div className="font-bold text-foreground text-right">{user.profile.age || "Unknown"}</div>
                  
                  <div className="text-muted-foreground uppercase text-[10px]">RESIDENT STATE:</div>
                  <div className="font-bold text-foreground text-right">{user.profile.state || "Unknown"}</div>

                  <div className="text-muted-foreground uppercase text-[10px]">ANNUAL INCOME:</div>
                  <div className="font-bold text-foreground text-right">₹{user.profile.family_annual_income?.toLocaleString("en-IN") || "0"}</div>

                  <div className="text-muted-foreground uppercase text-[10px]">DISABILITY STATUS:</div>
                  <div className="font-bold text-foreground text-right">{user.profile.disability || "No"}</div>
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Continuous Monitoring Simulator</span>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button size="xs" variant="outline" className="rounded-none border border-foreground font-mono text-[9px] font-bold" onClick={() => handleUpdateAge(59)}>
                      Set Age to 59
                    </Button>
                    <Button size="xs" variant="outline" className="rounded-none border border-foreground font-mono text-[9px] font-bold" onClick={() => handleUpdateAge(66)}>
                      Set Age to 66
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">Welfare profile questionnaire has not been created yet.</p>
            )}
          </div>

          {/* Payment Disbursement Timeline */}
          <div className="bg-card border-2 border-foreground rounded-none p-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
            <h3 className="font-erode font-black text-md uppercase tracking-tight border-b border-foreground/10 pb-2 mb-4">Welfare Benefit Logs</h3>
            
            {allDisbursements.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono text-center py-6">No benefit disbursement records cataloged yet.</p>
            ) : (
              <div className="relative border-l border-foreground/20 pl-4 ml-2 space-y-4">
                {allDisbursements.slice(0, 5).map((disb: any, index: number) => (
                  <div key={disb.disbursement_id || index} className="relative">
                    {/* Circle marker */}
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-foreground" />
                    
                    <div className="text-[9px] font-mono text-muted-foreground">
                      {new Date(disb.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                    <div className="font-bold text-xs uppercase tracking-wide mt-0.5 text-foreground truncate max-w-[190px]">
                      {disb.scheme_name}
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-600 mt-0.5">
                      + ₹{disb.amount.toLocaleString("en-IN")}
                    </div>
                    {disb.remarks && (
                      <div className="text-[9px] font-mono text-slate-400 mt-0.5 italic">
                        "{disb.remarks}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
