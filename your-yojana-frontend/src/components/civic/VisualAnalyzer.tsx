// ──────────────────────────────────────────────
// VisualAnalyzer — Standalone AI Visual assessment component
// ──────────────────────────────────────────────

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, X, Loader2, Info, Sparkles, AlertTriangle } from "lucide-react"
import { Button } from "../ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card"
import { Label } from "../ui/Label"
import { PriorityBadge } from "./PriorityBadge"
import { assessImages } from "../../services/civicService"
import type { VisionAssessment } from "../../types/civicTypes"

// Animation variants
const fadeSlideUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
}

export function VisualAnalyzer() {
  const [images, setImages] = useState<string[]>([])
  const [complaintText, setComplaintText] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<VisionAssessment | null>(null)
  const [error, setError] = useState<string | null>(null)

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

    e.target.value = "" // Reset
  }, [images.length])

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (images.length === 0) return

    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      const response = await assessImages(images, complaintText.trim() || undefined)
      if (response && response.vision) {
        setAnalysisResult(response.vision as VisionAssessment)
      } else {
        throw new Error("No analysis data returned from the vision agent.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze image(s)")
    } finally {
      setIsAnalyzing(false)
    }
  }, [images, complaintText])

  const handleReset = useCallback(() => {
    setImages([])
    setComplaintText("")
    setAnalysisResult(null)
    setError(null)
  }, [])

  return (
    <div className="space-y-6">
      <div className="border border-border p-6 bg-card">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-erode text-xl font-black uppercase tracking-tight">
            STANDALONE VISUAL AI ANALYZER
          </h3>
        </div>

        <p className="text-xs text-muted-foreground tracking-wide uppercase mb-6 leading-relaxed">
          Upload up to 3 photos of a civic issue. The AI Vision Agent will scan the images,
          identify defects, assess hazards, and recommend routing categories without saving a ticket.
        </p>

        {/* Image upload area */}
        <div className="space-y-3 mb-6">
          <Label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            SELECT IMAGES (MAX 3)
          </Label>
          <div className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative w-24 h-24 border border-border group">
                <img src={img} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemoveImage(i)}
                  disabled={isAnalyzing}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <label className="w-24 h-24 border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-foreground transition-colors bg-background">
                <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-[10px] tracking-wider text-muted-foreground uppercase">UPLOAD</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageAdd}
                  disabled={isAnalyzing}
                />
              </label>
            )}
          </div>
        </div>

        {/* Optional text input */}
        <div className="space-y-3 mb-6">
          <Label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            CITIZEN COMPLAINT TEXT (OPTIONAL CONTEXT)
          </Label>
          <textarea
            value={complaintText}
            onChange={(e) => setComplaintText(e.target.value)}
            placeholder="Add any details you want the AI visual assessment to consider..."
            rows={3}
            disabled={isAnalyzing}
            className="flex w-full border border-border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:border-foreground disabled:opacity-50 resize-none transition-colors"
          />
        </div>

        {/* Action button */}
        <Button
          variant="default"
          onClick={handleAnalyze}
          disabled={images.length === 0 || isAnalyzing}
          className="w-full rounded-none font-bold tracking-widest uppercase text-xs"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              RUNNING VISION SCAN...
            </>
          ) : (
            <>ANALYZE PHOTOS</>
          )}
        </Button>
      </div>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 border-2 border-foreground bg-card text-xs flex gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-foreground" />
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standalone results */}
      <AnimatePresence>
        {analysisResult && (
          <motion.div
            variants={fadeSlideUp}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            <Card className="rounded-none border-2">
              <CardHeader className="pb-3 border-b border-border bg-foreground text-background">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <CardTitle className="text-xs font-bold tracking-widest uppercase">
                      STANDALONE AI ASSESSMENT
                    </CardTitle>
                  </div>
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">
                    ADVISORY ONLY
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                
                {/* Severity Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                      VISUAL SEVERITY
                    </p>
                    <div className="flex items-center gap-2">
                      <PriorityBadge level={analysisResult.severity} />
                      <span className="text-xs font-mono font-bold">
                        {analysisResult.severity_score}/100
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                      CONFIDENCE
                    </p>
                    <p className="text-sm font-mono font-bold">
                      {Math.round(analysisResult.confidence * 100)}%
                    </p>
                  </div>
                </div>

                {/* Score bar */}
                <div className="w-full h-1.5 bg-muted overflow-hidden">
                  <div
                    className="h-full bg-foreground"
                    style={{ width: `${analysisResult.severity_score}%` }}
                  />
                </div>

                {/* Detections */}
                {analysisResult.detections.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                      DETECTED ANOMALIES
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.detections.map((d, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 border border-border text-[10px] tracking-wider uppercase font-semibold bg-background"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Situation Analysis */}
                {analysisResult.situation_analysis && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                      SITUATION ANALYSIS
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {analysisResult.situation_analysis}
                    </p>
                  </div>
                )}

                {/* Category Recommendations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                      RECOMMENDED CATEGORY
                    </p>
                    <p className="text-xs font-bold uppercase">
                      {analysisResult.recommended_category}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                      CLASSIFICATION
                    </p>
                    <p className="text-xs font-bold uppercase">
                      {analysisResult.is_civic_issue ? "CIVIC INFRASTRUCTURE ISSUE" : "NON-CIVIC / OTHER"}
                    </p>
                  </div>
                </div>

                {/* Priority cues */}
                {analysisResult.summary_for_priority && (
                  <div className="p-3 border border-border bg-card text-xs">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
                      PRIORITY BRIEF (INPUT TO PRIORITY AGENT)
                    </p>
                    <p className="text-muted-foreground leading-relaxed italic">
                      "{analysisResult.summary_for_priority}"
                    </p>
                  </div>
                )}

                {/* Disclaimer info */}
                <div className="flex items-start gap-1.5 p-3 border border-border bg-muted/30">
                  <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    This visual assessment is generated using experimental computer vision. Output is advisory
                    and intended solely to assist citizens in diagnostic testing.
                  </p>
                </div>

                {/* Reset button */}
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full rounded-none font-bold tracking-widest uppercase text-xs"
                >
                  CLEAR & ANALYZE ANOTHER PHOTO
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
