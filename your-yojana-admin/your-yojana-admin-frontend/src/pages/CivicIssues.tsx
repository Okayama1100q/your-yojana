// ──────────────────────────────────────────────
// CivicIssues — Full civic issue report page
// Unified layout: Form + Inline Visual AI on the left, permanent map on the right.
// Allows manual location text entry (geocode search) or map click location picking.
// ──────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin,
  Send,
  AlertTriangle,
  Building2,
  Clock,
  Camera,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
  Sparkles,
} from "lucide-react"
import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"
import { Label } from "../components/ui/Label"
import { PriorityBadge } from "../components/civic/PriorityBadge"
import { CivicMap } from "../components/civic/CivicMap"
import { submitComplaint, getComplaints, assessImages } from "../services/civicService"
import type {
  ComplaintResponse,
  ComplaintRecord,
  LocationData,
  VisionAssessment,
} from "../types/civicTypes"

// ── Animation variants ──────────────────────
const fadeSlideUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.3 } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
}

// ── Page ─────────────────────────────────────
export function CivicIssues() {
  // Form state
  const [complaintText, setComplaintText] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [issueLocation, setIssueLocation] = useState<LocationData | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Manual Geocode Search State
  const [addressSearch, setAddressSearch] = useState("")
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null)

  // Real-time Visual AI Scan State
  const [isScanningImages, setIsScanningImages] = useState(false)
  const [imageAnalysisResult, setImageAnalysisResult] = useState<VisionAssessment | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingStage, setLoadingStage] = useState("")
  const [result, setResult] = useState<ComplaintResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Previous complaints
  const [pastComplaints, setPastComplaints] = useState<ComplaintRecord[]>([])
  const [showPast, setShowPast] = useState(false)
  const [loadingPast, setLoadingPast] = useState(false)

  const [gettingLocation, setGettingLocation] = useState(false)

  // ── Auto-scan photos when uploaded ──────────────────────
  useEffect(() => {
    if (images.length === 0) {
      setImageAnalysisResult(null)
      setScanError(null)
      return
    }

    const scanPhotos = async () => {
      setIsScanningImages(true)
      setScanError(null)
      try {
        const response = await assessImages(images, complaintText.trim() || undefined)
        if (response && response.vision) {
          setImageAnalysisResult(response.vision as VisionAssessment)
        }
      } catch {
        setScanError("Visual AI scan failed to analyze the uploaded photos.")
      } finally {
        setIsScanningImages(false)
      }
    }

    const timer = setTimeout(() => {
      scanPhotos()
    }, 500)

    return () => clearTimeout(timer)
  }, [images, complaintText])

  // ── Handlers ───────────────────────────────

  const handleSearchLocation = useCallback(async () => {
    if (!addressSearch.trim()) return
    setIsSearchingLocation(true)
    setLocationSearchError(null)

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          addressSearch.trim()
        )}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      )
      if (res.ok) {
        const data = await res.json()
        if (data && data.length > 0) {
          const first = data[0]
          const lat = parseFloat(first.lat)
          const lng = parseFloat(first.lon)
          const address = first.display_name
          setIssueLocation({ lat, lng, address })
        } else {
          setLocationSearchError("Location not found. Try adding city name e.g., Besant Nagar, Chennai")
        }
      } else {
        setLocationSearchError("Failed to fetch coordinates. Please try again.")
      }
    } catch {
      setLocationSearchError("Failed to fetch coordinates. Check your connection.")
    } finally {
      setIsSearchingLocation(false)
    }
  }, [addressSearch])

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setGettingLocation(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(coords)

        // Reverse geocode with Nominatim (best effort)
        let address = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          )
          if (res.ok) {
            const data = await res.json()
            if (data.display_name) {
              address = data.display_name
            }
          }
        } catch {
          // Keep coordinate address
        }

        setIssueLocation({ ...coords, address })
        setGettingLocation(false)
      },
      () => {
        setGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const handleImageAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).slice(0, 3 - images.length).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setImages((prev) => {
          if (prev.length >= 3) return prev
          return [...prev, reader.result as string]
        })
      }
      reader.readAsDataURL(file)
    })

    e.target.value = "" // reset
  }, [images.length])

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!complaintText.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)
    setResult(null)

    try {
      setLoadingStage("Assessing issue priority...")
      await new Promise((r) => setTimeout(r, 400))
      setLoadingStage("Analyzing complaint & finding responsible authority...")

      const response = await submitComplaint({
        complaint: complaintText.trim(),
        images: images.length > 0 ? images : undefined,
      })

      setLoadingStage("Preparing results...")
      await new Promise((r) => setTimeout(r, 300))

      setResult(response)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      )
    } finally {
      setIsSubmitting(false)
      setLoadingStage("")
    }
  }, [complaintText, images])

  const handleLoadPast = useCallback(async () => {
    if (showPast) {
      setShowPast(false)
      return
    }

    setLoadingPast(true)
    try {
      const data = await getComplaints()
      setPastComplaints(data.complaints)
      setShowPast(true)
    } catch {
      // Silently fail for past complaints
    } finally {
      setLoadingPast(false)
    }
  }, [showPast])

  const handleReset = useCallback(() => {
    setComplaintText("")
    setImages([])
    setIssueLocation(null)
    setResult(null)
    setSubmitError(null)
    setImageAnalysisResult(null)
    setAddressSearch("")
    setLocationSearchError(null)
  }, [])

  // ── Render ─────────────────────────────────
  return (
    <div className="min-h-[80vh]">
      {/* Hero / Page Header */}
      <section className="border-b-2 border-foreground bg-background">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="font-erode text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-none"
          >
            CIVIC ISSUES.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-3 text-sm md:text-base font-bold tracking-widest uppercase text-muted-foreground"
          >
            REPORT • PRIORITIZE • RESOLVE
          </motion.p>
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-2 border-foreground bg-background min-h-[650px]">

          {/* ─── LEFT COLUMN: Form, Loader, and Results ─── */}
          <div className="border-b-2 lg:border-b-0 lg:border-r-2 border-foreground p-6 md:p-10">
            {isSubmitting ? (
              <div className="flex flex-col items-center justify-center min-h-[450px] text-center">
                <Loader2 className="w-10 h-10 animate-spin mb-6" />
                <p className="text-sm font-bold tracking-widest uppercase animate-pulse">
                  {loadingStage || "PROCESSING..."}
                </p>
                <p className="text-xs text-muted-foreground mt-2 tracking-wide uppercase">
                  AI agents are analyzing your report
                </p>
              </div>
            ) : result ? (
              <motion.div
                key="results"
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                {/* Complaint Registered Banner */}
                <motion.div variants={fadeSlideUp}>
                  <div className="p-4 border-2 border-foreground bg-foreground text-background">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold tracking-widest uppercase opacity-70">
                          COMPLAINT REGISTERED
                        </p>
                        <p className="font-erode text-2xl font-black tracking-tight mt-1">
                          {result.complaint.complaint_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold tracking-widest uppercase opacity-70">
                          CATEGORY
                        </p>
                        <p className="font-bold tracking-wide uppercase mt-1">
                          {result.analysis.category}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Priority Assessment */}
                <motion.div variants={fadeSlideUp}>
                  <Card className="rounded-none border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <CardTitle className="text-xs font-bold tracking-widest uppercase">
                          AI PRIORITY ASSESSMENT
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <PriorityBadge level={result.priority.level} className="text-sm px-4 py-1.5" />
                        <span className="text-xs text-muted-foreground tracking-widest uppercase">
                          SCORE: {result.priority.score}/100
                        </span>
                      </div>

                      {/* Score Bar */}
                      <div className="w-full h-2 bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.priority.score}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                          className="h-full bg-foreground"
                        />
                      </div>

                      {/* Reasons */}
                      {result.priority.reasons.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
                            CONTRIBUTING FACTORS
                          </p>
                          {result.priority.reasons.map((r, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0"
                            >
                              <span className="tracking-wide">{r.factor}</span>
                              <span className="font-bold tracking-widest">
                                +{r.points}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Response Time */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs tracking-widest uppercase text-muted-foreground">
                          RECOMMENDED RESPONSE:{" "}
                          <strong className="text-foreground">
                            {result.priority.recommended_response_hours}H
                          </strong>
                        </span>
                      </div>

                      {/* Disclaimer */}
                      <div className="flex items-start gap-1.5 pt-2">
                        <Info className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Priority is an automated assessment intended to help organize
                          issue handling. Final action remains with the responsible authority.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Recommended Authority */}
                <motion.div variants={fadeSlideUp}>
                  <Card className="rounded-none border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <CardTitle className="text-xs font-bold tracking-widest uppercase">
                          RECOMMENDED AUTHORITY
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="font-erode text-xl md:text-2xl font-black tracking-tight uppercase">
                        {result.routing.department}
                      </p>

                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {result.routing.reason}
                      </p>

                      {/* Confidence */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs tracking-widest uppercase text-muted-foreground">
                          CONFIDENCE
                        </span>
                        <div className="flex-1 h-1.5 bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${result.routing.confidence * 100}%` }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
                            className="h-full bg-foreground"
                          />
                        </div>
                        <span className="text-xs font-bold tracking-widest">
                          {Math.round(result.routing.confidence * 100)}%
                        </span>
                      </div>

                      {/* Disclaimer */}
                      <div className="flex items-start gap-1.5 pt-2 border-t border-border">
                        <Info className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Recommended authority based on the information provided.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Vision Assessment (if available) */}
                {result.vision && (
                  <motion.div variants={fadeSlideUp}>
                    <Card className="rounded-none border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4" />
                          <CardTitle className="text-xs font-bold tracking-widest uppercase">
                            AI VISUAL ASSESSMENT
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                          <PriorityBadge level={result.vision.severity} />
                          <span className="text-xs text-muted-foreground tracking-widest uppercase">
                            VISUAL SEVERITY: {result.vision.severity_score}/100
                          </span>
                        </div>

                        {result.vision.detections.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {result.vision.detections.map((d, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 border border-border text-[11px] tracking-wider uppercase"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        )}

                        {result.vision.situation_analysis && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {result.vision.situation_analysis}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Analysis Summary */}
                <motion.div variants={fadeSlideUp}>
                  <Card className="rounded-none border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-bold tracking-widest uppercase">
                        ANALYSIS SUMMARY
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground tracking-widest uppercase">ISSUE</p>
                          <p className="font-bold">{result.analysis.issue}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground tracking-widest uppercase">LOCATION</p>
                          <p className="font-bold">{result.analysis.location || "—"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground tracking-widest uppercase">AFFECTED</p>
                          <p className="font-bold">
                            {result.analysis.affected_count > 0
                              ? `${result.analysis.affected_count} ${result.analysis.affected_unit}`
                              : "—"}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground tracking-widest uppercase">DURATION</p>
                          <p className="font-bold">
                            {result.analysis.duration_days > 0
                              ? `${result.analysis.duration_days} days`
                              : "—"}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground tracking-widest uppercase">STATUS</p>
                          <p className="font-bold uppercase">{result.complaint.status}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground tracking-widest uppercase">RISKS</p>
                          <div className="flex flex-wrap gap-1">
                            {result.analysis.health_risk && (
                              <span className="px-1.5 py-0.5 bg-foreground text-background text-[10px] tracking-wider uppercase">
                                HEALTH
                              </span>
                            )}
                            {result.analysis.safety_risk && (
                              <span className="px-1.5 py-0.5 bg-foreground text-background text-[10px] tracking-wider uppercase">
                                SAFETY
                              </span>
                            )}
                            {result.analysis.essential_service && (
                              <span className="px-1.5 py-0.5 border border-foreground text-[10px] tracking-wider uppercase">
                                ESSENTIAL
                              </span>
                            )}
                            {result.analysis.vulnerable_population && (
                              <span className="px-1.5 py-0.5 border border-foreground text-[10px] tracking-wider uppercase">
                                VULNERABLE
                              </span>
                            )}
                            {!result.analysis.health_risk &&
                              !result.analysis.safety_risk &&
                              !result.analysis.essential_service &&
                              !result.analysis.vulnerable_population && (
                                <span className="text-muted-foreground">—</span>
                              )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* New Report Button */}
                <motion.div variants={fadeSlideUp}>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleReset}
                    className="w-full rounded-none font-bold tracking-widest uppercase text-xs border-2"
                  >
                    FILE ANOTHER REPORT
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <>
                <h2 className="font-erode text-2xl md:text-3xl font-black tracking-tight uppercase mb-8">
                  REPORT AN ISSUE
                </h2>

                {/* Complaint Text */}
                <div className="space-y-3 mb-6">
                  <Label className="text-xs font-bold tracking-widest uppercase">
                    DESCRIBE THE ISSUE
                  </Label>
                  <textarea
                    id="civic-complaint-input"
                    value={complaintText}
                    onChange={(e) => setComplaintText(e.target.value)}
                    placeholder="e.g. Large pothole on Anna Salai road near Teynampet junction causing traffic accidents..."
                    rows={5}
                    disabled={isSubmitting}
                    className="flex w-full border-2 border-border bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-colors"
                  />
                </div>

                {/* Image Upload */}
                <div className="space-y-3 mb-6">
                  <Label className="text-xs font-bold tracking-widest uppercase">
                    PHOTOS (OPTIONAL — MAX 3)
                  </Label>
                  <div className="flex flex-wrap gap-3">
                    {images.map((img, i) => (
                      <div key={i} className="relative w-20 h-20 border border-border group">
                        <img src={img} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemoveImage(i)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity"
                          aria-label="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {images.length < 3 && (
                      <label className="w-20 h-20 border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-foreground transition-colors bg-background">
                        <Camera className="w-5 h-5 text-muted-foreground" />
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleImageAdd}
                          disabled={isSubmitting}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Real-time Inline Visual AI Scan Results */}
                <AnimatePresence>
                  {(isScanningImages || imageAnalysisResult || scanError) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border border-border p-4 bg-muted/10 mb-6 space-y-4 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 border-b border-border pb-2">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        <span className="text-[10px] font-black tracking-widest uppercase">
                          REAL-TIME AI VISUAL DIAGNOSTICS
                        </span>
                      </div>

                      {isScanningImages && (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs text-muted-foreground tracking-wide uppercase">
                            AI scanning uploaded photo(s)...
                          </span>
                        </div>
                      )}

                      {scanError && (
                        <div className="flex items-center gap-2 py-2 text-red-500">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span className="text-xs uppercase tracking-wider">{scanError}</span>
                        </div>
                      )}

                      {!isScanningImages && imageAnalysisResult && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">
                                ADVISE SEVERITY
                              </p>
                              <div className="flex items-center gap-1.5">
                                <PriorityBadge level={imageAnalysisResult.severity} />
                                <span className="text-[11px] font-mono font-bold">
                                  {imageAnalysisResult.severity_score}/100
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">
                                RECOMMENDED CATEGORY
                              </p>
                              <p className="text-xs font-bold uppercase truncate">
                                {imageAnalysisResult.recommended_category}
                              </p>
                            </div>
                          </div>

                          {imageAnalysisResult.detections.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">
                                DETECTED FEATURES
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {imageAnalysisResult.detections.map((d, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 border border-border text-[9px] font-semibold bg-background uppercase tracking-wider"
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {imageAnalysisResult.situation_analysis && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">
                                SITUATION DIAGNOSIS
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {imageAnalysisResult.situation_analysis}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Location Input & Geocode Search */}
                <div className="space-y-3 mb-8">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold tracking-widest uppercase">
                      ENTER ISSUE LOCATION
                    </Label>
                    <span className="text-[9px] text-muted-foreground tracking-widest uppercase">
                      * OR CLICK MAP ON RIGHT
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Besant Nagar, Chennai"
                      value={addressSearch}
                      onChange={(e) => setAddressSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSearchLocation()
                        }
                      }}
                      className="flex-1 border-2 border-border bg-background px-4 py-2.5 text-xs font-medium focus-visible:outline-none focus-visible:border-foreground"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSearchLocation}
                      disabled={isSearchingLocation}
                      className="rounded-none font-bold tracking-widest uppercase text-xs px-6 border-2"
                    >
                      {isSearchingLocation ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "SEARCH"
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleUseMyLocation}
                      disabled={gettingLocation}
                      className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {gettingLocation ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <MapPin className="w-3 h-3" />
                      )}
                      OR USE CURRENT LOCATION
                    </button>
                  </div>

                  {locationSearchError && (
                    <p className="text-xs text-red-500 uppercase font-bold tracking-wider">{locationSearchError}</p>
                  )}

                  {issueLocation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="flex items-start gap-2 p-3 border border-border bg-card text-xs mt-2"
                    >
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="tracking-wide font-bold">{issueLocation.address}</span>
                    </motion.div>
                  )}
                </div>

                {/* Submit */}
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!complaintText.trim() || !issueLocation || isSubmitting}
                  className="w-full rounded-none font-black tracking-widest uppercase text-sm"
                  id="civic-submit-button"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {loadingStage || "PROCESSING..."}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      SUBMIT REPORT
                    </>
                  )}
                </Button>

                {/* Error */}
                <AnimatePresence>
                  {submitError && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 p-4 border-2 border-foreground bg-card text-sm"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{submitError}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Past Complaints Toggle */}
                <div className="mt-8 border-t border-border pt-6">
                  <button
                    onClick={handleLoadPast}
                    className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors w-full cursor-pointer"
                    disabled={loadingPast}
                  >
                    {loadingPast ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : showPast ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    {showPast ? "HIDE" : "VIEW"} PREVIOUS REPORTS
                  </button>

                  <AnimatePresence>
                    {showPast && pastComplaints.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 space-y-2 overflow-hidden"
                      >
                        {pastComplaints.slice(0, 10).map((c) => (
                          <div
                            key={c.complaint_id}
                            className="p-3 border border-border text-xs space-y-1 bg-background"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold tracking-widest uppercase">
                                {c.complaint_id}
                              </span>
                              <PriorityBadge level={c.priority} />
                            </div>
                            <p className="text-muted-foreground line-clamp-2">
                              {c.description}
                            </p>
                            <div className="flex gap-4 text-muted-foreground">
                              <span>{c.department}</span>
                              <span className="uppercase">{c.status}</span>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>

          {/* ─── RIGHT COLUMN: Permanent Map ─── */}
          <div className="p-0 h-[650px] lg:h-auto min-h-[500px] flex flex-col justify-stretch">
            <CivicMap
              issueLocation={issueLocation}
              userLocation={userLocation}
              showRoute={!!userLocation && !!issueLocation}
              height="100%"
              pickMode
              onLocationPick={setIssueLocation}
            />
          </div>

        </div>
      </section>
    </div>
  )
}
