// ──────────────────────────────────────────────
// GovDashboard — Government Resolution Control Center
// Redesigned to match the requested resolution queue and dashboard layout exactly,
// including sidebar, styled table, action drawers, and high-fidelity SVG analytics charts.
// ──────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  RefreshCw,
  X,
  FileText,
  UserCheck,
  Loader2,
  Inbox,
  LayoutDashboard,
  Calendar,
} from "lucide-react"
import { Button } from "../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"
import { PriorityBadge } from "../components/civic/PriorityBadge"
import { CivicMap } from "../components/civic/CivicMap"
import {
  getComplaints,
  getDashboardStats,
  updateComplaintStatus,
} from "../services/civicService"
import {
  getPendingEnrollments,
  verifyEnrollment,
  disburseBenefits,
} from "../services/saarthiService"
import type {
  ComplaintRecord,
  DashboardStats,
  LocationData,
} from "../types/civicTypes"

// Pill-based status colors matching the screenshot exactly
const statusBadgeStyles: Record<string, string> = {
  PENDING: "bg-[#f8fafc] text-[#64748b] border-[#cbd5e1] border rounded px-2.5 py-1 text-[10px] font-bold tracking-wide flex items-center gap-1.5",
  ASSIGNED: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe] border rounded px-2.5 py-1 text-[10px] font-bold tracking-wide flex items-center gap-1.5",
  IN_PROGRESS: "bg-[#fef3c7] text-[#d97706] border-[#fde68a] border rounded px-2.5 py-1 text-[10px] font-bold tracking-wide flex items-center gap-1.5",
  RESOLVED: "bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0] border rounded px-2.5 py-1 text-[10px] font-bold tracking-wide flex items-center gap-1.5",
}

export function GovDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Active Tab/Panel Selection
  const [activePanel, setActivePanel] = useState<"dashboard" | "queue" | "all" | "departments" | "reports" | "welfare-applications">("queue")

  // Welfare Scheme applications state
  const [welfareApps, setWelfareApps] = useState<any[]>([])
  const [selectedWelfareApp, setSelectedWelfareApp] = useState<any>(null)
  const [disbursementAmount, setDisbursementAmount] = useState<number>(2000)
  const [disbursementRemarks, setDisbursementRemarks] = useState<string>("Approved first installment")
  const [verifyingWelfare, setVerifyingWelfare] = useState(false)
  const [disbursingWelfare, setDisbursingWelfare] = useState(false)

  const loadWelfareApplications = async () => {
    try {
      const apps = await getPendingEnrollments()
      setWelfareApps(apps)
    } catch (err) {
      console.error("Failed to load welfare applications", err)
    }
  }

  const handleWelfareVerify = async (enrollmentId: string, approve: boolean) => {
    setVerifyingWelfare(true)
    try {
      const docUrl = approve 
        ? "https://mockyojana.gov/uploads/valid-verification.pdf" 
        : "https://mockyojana.gov/uploads/invalid-verification.pdf"
      
      const result = await verifyEnrollment(enrollmentId, docUrl)
      setSelectedWelfareApp((prev: any) => prev ? { ...prev, status: result.new_status, last_verification_reason: result.agent_reason } : null)
      await loadWelfareApplications()
    } catch (err: any) {
      alert(err.message || "Verification failed.")
    } finally {
      setVerifyingWelfare(false)
    }
  }

  const handleWelfareDisburse = async (enrollmentId: string) => {
    setDisbursingWelfare(true)
    try {
      await disburseBenefits(enrollmentId, disbursementAmount, disbursementRemarks)
      setSelectedWelfareApp((prev: any) => prev ? { ...prev, status: "ACTIVE" } : null)
      await loadWelfareApplications()
      alert("Disbursement recorded successfully. Scheme is now ACTIVE!")
    } catch (err: any) {
      alert(err.message || "Disbursement failed.")
    } finally {
      setDisbursingWelfare(false)
    }
  }

  useEffect(() => {
    if (activePanel === "welfare-applications") {
      loadWelfareApplications()
    }
  }, [activePanel])

  // Filters state (from resolution queue)
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [priorityFilter, setPriorityFilter] = useState("ALL")
  const [deptFilter, setDeptFilter] = useState("ALL")
  const [locationSearch, setLocationSearch] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Selected complaint details drawer
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRecord | null>(null)
  const [mapLocation, setMapLocation] = useState<LocationData | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Load dashboard data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [statsData, listData, apps] = await Promise.all([
        getDashboardStats(),
        getComplaints(),
        getPendingEnrollments().catch(() => [])
      ])
      setStats(statsData)
      setComplaints(listData.complaints)
      setWelfareApps(apps)
    } catch {
      // Silently handle load errors
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Geocode address when selecting a complaint
  useEffect(() => {
    if (!selectedComplaint) {
      setMapLocation(null)
      return
    }

    const geocode = async () => {
      const locText = selectedComplaint.location
      if (!locText) {
        setMapLocation(null)
        return
      }

      // Check if location is coordinates e.g., "13.0827, 80.2707"
      const coordMatch = locText.match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/)
      if (coordMatch) {
        setMapLocation({
          lat: parseFloat(coordMatch[1]),
          lng: parseFloat(coordMatch[2]),
          address: locText,
        })
        return
      }

      setIsGeocoding(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            locText
          )}&format=json&limit=1`,
          { headers: { "Accept-Language": "en" } }
        )
        if (res.ok) {
          const data = await res.json()
          if (data && data[0]) {
            setMapLocation({
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon),
              address: data[0].display_name || locText,
            })
          }
        }
      } catch {
        setMapLocation(null)
      } finally {
        setIsGeocoding(false)
      }
    }

    geocode()
  }, [selectedComplaint])

  // Handle status update
  const handleStatusUpdate = useCallback(async (newStatus: string) => {
    if (!selectedComplaint || updatingStatus) return
    setUpdatingStatus(true)

    try {
      await updateComplaintStatus(selectedComplaint.complaint_id, newStatus)
      setSelectedComplaint((prev) => (prev ? { ...prev, status: newStatus as any } : null))
      await loadData(true)
    } catch {
      // Handle error state
    } finally {
      setUpdatingStatus(false)
    }
  }, [selectedComplaint, updatingStatus, loadData])

  // Filter complaints list
  const filteredComplaints = complaints.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status.toUpperCase() === statusFilter
    const matchesPriority = priorityFilter === "ALL" || c.priority.toUpperCase() === priorityFilter
    const matchesDept = deptFilter === "ALL" || c.department === deptFilter
    const matchesLocation =
      locationSearch === "" || c.location.toLowerCase().includes(locationSearch.toLowerCase())
    const matchesSearch =
      searchQuery === "" ||
      c.complaint_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.location.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesStatus && matchesPriority && matchesDept && matchesLocation && matchesSearch
  })

  // Count priorities inside current results for resolution badges
  const criticalCount = complaints.filter((c) => c.priority === "CRITICAL").length
  const highCount = complaints.filter((c) => c.priority === "HIGH").length
  const mediumCount = complaints.filter((c) => c.priority === "MEDIUM").length
  const lowCount = complaints.filter((c) => c.priority === "LOW").length

  const pendingCount = complaints.filter((c) => c.status === "PENDING").length
  const progressCount = complaints.filter((c) => c.status === "IN_PROGRESS").length
  const resolvedCount = complaints.filter((c) => c.status === "RESOLVED").length

  // Clear filters
  const handleClearFilters = () => {
    setStatusFilter("ALL")
    setPriorityFilter("ALL")
    setDeptFilter("ALL")
    setLocationSearch("")
    setSearchQuery("")
  }

  // Get departments list for filter
  const departmentsList = stats ? Object.keys(stats.departments) : []

  if (loading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#1e293b]" />
        <p className="text-xs font-bold tracking-widest uppercase animate-pulse text-[#64748b]">
          LOADING GOVERNMENT CONTROL PANEL...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[90vh] bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-800">
      
      {/* ─── Top Header Portal Bar ─── */}
      <header className="bg-[#0f172a] text-white border-b-2 border-slate-900 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border-2 border-white flex items-center justify-center font-erode font-black text-xl bg-[#e2e8f0] text-black">
            YY
          </div>
          <div>
            <h1 className="font-erode text-lg font-black tracking-tight flex flex-wrap items-center gap-2">
              Your Yojana
              <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                GOVERNMENT RESOLUTION PORTAL
              </span>
            </h1>
            <p className="text-[9px] text-slate-400 font-mono">INTELLIGENT URBAN RESOLUTION MATRIX</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="hidden lg:flex items-center gap-1.5 border border-slate-700 bg-slate-800/40 px-3 py-1.5 rounded text-[10px]">
            <span className="text-amber-500 font-bold uppercase">Municipal Corporation</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Updated: Live Feed</span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-300">Officer Singh</span>
          </div>
          <a
            href="/civic"
            className="border border-slate-700 px-3 py-1.5 hover:bg-slate-850 hover:text-white transition-colors uppercase font-bold tracking-wider"
          >
            Citizen Portal
          </a>
        </div>
      </header>

      {/* ─── Split Sidebar & Content Grid ─── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* Left Sidebar Menu */}
        <aside className="w-full lg:w-60 bg-[#1e293b] text-slate-300 border-r border-slate-800 p-4 space-y-8 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-3 px-3">
                OPERATIONS
              </p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActivePanel("dashboard")}
                  className={`w-full text-left px-3 py-2 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${
                    activePanel === "dashboard"
                      ? "bg-slate-800 text-white border-l-4 border-amber-500"
                      : "hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                  </span>
                  <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">ANALYTICS</span>
                </button>
                <button
                  onClick={() => setActivePanel("queue")}
                  className={`w-full text-left px-3 py-2 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${
                    activePanel === "queue"
                      ? "bg-slate-800 text-white border-l-4 border-amber-500"
                      : "hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Inbox className="w-3.5 h-3.5" /> Resolution Queue
                  </span>
                  {pendingCount > 0 && (
                    <span className="bg-red-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActivePanel("all")}
                  className={`w-full text-left px-3 py-2 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${
                    activePanel === "all"
                      ? "bg-slate-800 text-white border-l-4 border-amber-500"
                      : "hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> All Complaints
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">({complaints.length})</span>
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-3 px-3">
                MANAGEMENT
              </p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActivePanel("departments")}
                  className={`w-full text-left px-3 py-2 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${
                    activePanel === "departments"
                      ? "bg-slate-800 text-white border-l-4 border-amber-500"
                      : "hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" /> Departments
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">({departmentsList.length})</span>
                </button>
                <button
                  onClick={() => setActivePanel("reports")}
                  className={`w-full text-left px-3 py-2 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${
                    activePanel === "reports"
                      ? "bg-slate-800 text-white border-l-4 border-amber-500"
                      : "hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> Reports
                  </span>
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-3 px-3">
                WELFARE PORTAL
              </p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActivePanel("welfare-applications")}
                  className={`w-full text-left px-3 py-2 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-between ${
                    activePanel === "welfare-applications"
                      ? "bg-slate-800 text-white border-l-4 border-amber-500"
                      : "hover:bg-slate-800/40 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5" /> Scheme Applications
                  </span>
                  {welfareApps.length > 0 && (
                    <span className="bg-amber-50 text-black font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {welfareApps.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
            <div className="px-3 py-1.5 hover:bg-slate-800/20 text-slate-500 text-[10px] uppercase font-mono flex items-center justify-between">
              <span>SYSTEM STATE</span>
              <span className="text-[#10b981] font-bold">ONLINE</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2 text-[#cbd5e1] font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>REFRESH DATA FEED</span>
            </button>
          </div>
        </aside>

        {/* ─── Main Content Panels Container ─── */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6">

          {/* Tab 1: Analytics Dashboard (Graphs and Representation) */}
          {activePanel === "dashboard" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="font-erode text-2xl font-black uppercase tracking-tight">Analytics Dashboard</h2>
                  <p className="text-xs text-muted-foreground mt-1">Live visual graphs and performance analysis metrics</p>
                </div>
                <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] animate-pulse" />
                  GRAPH SECTORS ACTIVE
                </div>
              </div>

              {/* Stat summary cards row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-none border-2 bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">INTAKE TOTAL</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-black font-mono text-[#0f172a]">{complaints.length}</p>
                    <p className="text-[10px] text-slate-500 uppercase mt-1">Reported citizen issues</p>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-2 bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">CRITICAL TICKETS</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-black font-mono text-red-600">{criticalCount}</p>
                    <p className="text-[10px] text-slate-500 uppercase mt-1">Require immediate response</p>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-2 bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">IN WORKFLOW</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-black font-mono text-amber-500">{progressCount}</p>
                    <p className="text-[10px] text-slate-500 uppercase mt-1">Active resolving status</p>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-2 bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">RESOLVED</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-black font-mono text-emerald-600">{resolvedCount}</p>
                    <p className="text-[10px] text-slate-500 uppercase mt-1">Completed resolution cards</p>
                  </CardContent>
                </Card>
              </div>

              {/* Graphic representations layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* SVG Graph 1: Resolution Rate Trends over time */}
                <Card className="rounded-none border-2 bg-white">
                  <CardHeader className="border-b border-slate-100 pb-3">
                    <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center justify-between">
                      <span>INTAKE VS RESOLUTION TRENDS</span>
                      <span className="text-[9px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">6 MONTH HISTORY</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="w-full h-64">
                      <svg viewBox="0 0 500 240" className="w-full h-full">
                        {/* Grid lines */}
                        <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="40" y1="80" x2="480" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="40" y1="130" x2="480" y2="130" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="40" y1="180" x2="480" y2="180" stroke="#e2e8f0" strokeWidth="1" />

                        {/* Line labels */}
                        <text x="15" y="34" className="text-[9px] fill-slate-400 font-bold" textAnchor="middle">100</text>
                        <text x="15" y="84" className="text-[9px] fill-slate-400 font-bold" textAnchor="middle">50</text>
                        <text x="15" y="134" className="text-[9px] fill-slate-400 font-bold" textAnchor="middle">25</text>
                        <text x="15" y="184" className="text-[9px] fill-slate-400 font-bold" textAnchor="middle">0</text>

                        {/* Months labels */}
                        <text x="60" y="210" className="text-[9px] fill-slate-500 font-bold uppercase" textAnchor="middle">JAN</text>
                        <text x="130" y="210" className="text-[9px] fill-slate-500 font-bold uppercase" textAnchor="middle">FEB</text>
                        <text x="200" y="210" className="text-[9px] fill-slate-500 font-bold uppercase" textAnchor="middle">MAR</text>
                        <text x="270" y="210" className="text-[9px] fill-slate-500 font-bold uppercase" textAnchor="middle">APR</text>
                        <text x="340" y="210" className="text-[9px] fill-slate-500 font-bold uppercase" textAnchor="middle">MAY</text>
                        <text x="410" y="210" className="text-[9px] fill-slate-500 font-bold uppercase" textAnchor="middle">JUN</text>

                        {/* Intake Area & Line (Blue) */}
                        <path d="M 60,160 Q 130,120 200,90 T 270,140 T 340,60 T 410,35" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
                        <circle cx="410" cy="35" r="5" fill="#2563eb" />
                        
                        {/* Resolution Line (Green) */}
                        <path d="M 60,175 Q 130,150 200,120 T 270,150 T 340,90 T 410,50" fill="none" stroke="#16a34a" strokeWidth="3" strokeDasharray="4" strokeLinecap="round" />
                        <circle cx="410" cy="50" r="5" fill="#16a34a" />

                        {/* Legend */}
                        <g transform="translate(140, 225)">
                          <line x1="0" y1="0" x2="20" y2="0" stroke="#2563eb" strokeWidth="3" />
                          <text x="25" y="4" className="text-[9px] fill-slate-600 font-bold uppercase">Intake Tickets</text>
                          <line x1="120" y1="0" x2="140" y2="0" stroke="#16a34a" strokeWidth="3" strokeDasharray="4" />
                          <text x="145" y="4" className="text-[9px] fill-slate-600 font-bold uppercase">Resolved</text>
                        </g>
                      </svg>
                    </div>
                  </CardContent>
                </Card>

                {/* SVG Graph 2: Department Performance Comparison Bar Chart */}
                <Card className="rounded-none border-2 bg-white">
                  <CardHeader className="border-b border-slate-100 pb-3">
                    <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center justify-between">
                      <span>DEPARTMENT TICKET ALLOCATION</span>
                      <span className="text-[9px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">LOAD BREAKDOWN</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="w-full h-64">
                      <svg viewBox="0 0 500 240" className="w-full h-full">
                        {/* Grid Y lines */}
                        <line x1="160" y1="20" x2="160" y2="200" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="240" y1="20" x2="240" y2="200" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="320" y1="20" x2="320" y2="200" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="400" y1="20" x2="400" y2="200" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="470" y1="20" x2="470" y2="200" stroke="#f1f5f9" strokeWidth="1" />

                        {/* X coordinates */}
                        <text x="160" y="215" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">0</text>
                        <text x="240" y="215" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">5</text>
                        <text x="320" y="215" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">10</text>
                        <text x="400" y="215" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">15</text>
                        <text x="470" y="215" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">20+</text>

                        {/* Bars representing tickets load per department */}
                        {/* Bar 1: Water Supply */}
                        <text x="10" y="45" className="text-[9px] fill-slate-600 font-black uppercase">Water Supply</text>
                        <rect x="160" y="32" width="220" height="18" fill="#3b82f6" />
                        <text x="390" y="45" className="text-[9px] fill-slate-700 font-bold">14 Tickets</text>

                        {/* Bar 2: Sanitation */}
                        <text x="10" y="95" className="text-[9px] fill-slate-600 font-black uppercase">Sanitation</text>
                        <rect x="160" y="82" width="160" height="18" fill="#d97706" />
                        <text x="330" y="95" className="text-[9px] fill-slate-700 font-bold">10 Tickets</text>

                        {/* Bar 3: Roads / Highways */}
                        <text x="10" y="145" className="text-[9px] fill-slate-600 font-black uppercase">Roads & Traffic</text>
                        <rect x="160" y="132" width="110" height="18" fill="#16a34a" />
                        <text x="280" y="145" className="text-[9px] fill-slate-700 font-bold">7 Tickets</text>

                        {/* Bar 4: Electricity */}
                        <text x="10" y="195" className="text-[9px] fill-slate-600 font-black uppercase">Electricity</text>
                        <rect x="160" y="182" width="70" height="18" fill="#6366f1" />
                        <text x="240" y="195" className="text-[9px] fill-slate-700 font-bold">4 Tickets</text>
                      </svg>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </motion.div>
          )}

          {/* Tab 2: Resolution Queue Panel (Sleek List, Filters & Details Drawer matching image) */}
          {activePanel === "queue" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-erode text-2xl md:text-3xl font-black uppercase tracking-tight">Resolution Queue</h2>
                  <p className="text-xs text-slate-400 mt-1">AI-prioritized civic complaints sorted by priority score (highest first)</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="rounded-none font-bold tracking-widest uppercase text-xs border border-slate-300 bg-white"
                >
                  {refreshing ? (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>

              {/* ── KPI Counter Cards matching image ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="bg-white border border-slate-200 p-4 rounded shadow-sm text-center">
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">TOTAL</p>
                  <p className="text-2xl font-black font-mono mt-1">{complaints.length}</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded shadow-sm text-center">
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">CRITICAL</p>
                  <p className="text-2xl font-black font-mono text-red-600 mt-1">{criticalCount}</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded shadow-sm text-center">
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">HIGH</p>
                  <p className="text-2xl font-black font-mono text-amber-600 mt-1">{highCount}</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded shadow-sm text-center">
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">MEDIUM</p>
                  <p className="text-2xl font-black font-mono text-yellow-600 mt-1">{mediumCount}</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded shadow-sm text-center">
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">LOW</p>
                  <p className="text-2xl font-black font-mono text-slate-500 mt-1">{lowCount}</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded shadow-sm text-center">
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">PENDING</p>
                  <p className="text-2xl font-black font-mono text-[#d97706] mt-1">{pendingCount}</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded shadow-sm text-center">
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">IN PROGRESS</p>
                  <p className="text-2xl font-black font-mono text-[#3b82f6] mt-1">{progressCount}</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded shadow-sm text-center">
                  <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">RESOLVED</p>
                  <p className="text-2xl font-black font-mono text-emerald-600 mt-1">{resolvedCount}</p>
                </div>
              </div>

              {/* ── Filters Row matching image exactly ── */}
              <div className="bg-white border border-slate-200 p-4 rounded shadow-sm flex flex-wrap items-center gap-3">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-9 border border-slate-300 rounded px-2 text-xs font-medium focus:outline-none focus:border-slate-500 bg-white"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 border border-slate-300 rounded px-2 text-xs font-medium focus:outline-none focus:border-slate-500 bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                </select>

                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-9 border border-slate-300 rounded px-2 text-xs font-medium focus:outline-none focus:border-slate-500 bg-white"
                >
                  <option value="ALL">All Departments</option>
                  {departmentsList.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Filter by location..."
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  className="h-9 border border-slate-300 rounded px-3 text-xs placeholder:text-slate-400 focus:outline-none focus:border-slate-500 w-44"
                />

                <input
                  type="text"
                  placeholder="Search complaints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 border border-slate-300 rounded px-3 text-xs placeholder:text-slate-400 focus:outline-none focus:border-slate-500 flex-1 min-w-[150px]"
                />

                {(priorityFilter !== "ALL" || statusFilter !== "ALL" || deptFilter !== "ALL" || locationSearch !== "" || searchQuery !== "") && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors uppercase font-bold tracking-wider px-2 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* ── Table Grid & Details split workspace ── */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                
                {/* Complaints List Table (Left 2 cols) */}
                <div className="xl:col-span-2 bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-55 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
                      Complaints ({filteredComplaints.length})
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                      Sorted by AI priority score ↓
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[9px] font-black tracking-wider">
                          <th className="px-4 py-3">Priority</th>
                          <th className="px-4 py-3">Complaint ID</th>
                          <th className="px-4 py-3">Complaint</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Location</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3 text-center">AI Score</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredComplaints.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-16 text-slate-400 font-bold uppercase tracking-wider">
                              No tickets match your filter parameters
                            </td>
                          </tr>
                        ) : (
                          filteredComplaints.map((c) => (
                            <tr
                              key={c.complaint_id}
                              onClick={() => setSelectedComplaint(c)}
                              className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                                selectedComplaint?.complaint_id === c.complaint_id
                                  ? "bg-slate-50 font-medium"
                                  : ""
                              }`}
                            >
                              <td className="px-4 py-3.5">
                                <PriorityBadge level={c.priority} className="text-[9px] px-1.5 py-0.5" />
                              </td>
                              <td className="px-4 py-3.5 font-mono font-bold text-slate-600">
                                {c.complaint_id}
                              </td>
                              <td className="px-4 py-3.5 max-w-[180px] truncate uppercase font-medium">
                                {c.description}
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 font-medium uppercase">
                                {c.category}
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 uppercase truncate max-w-[120px]">
                                {c.location}
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 max-w-[140px] truncate">
                                {c.department}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-bold">
                                {c.priority_score}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={statusBadgeStyles[c.status] || ""}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  {c.status}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedComplaint(c)
                                  }}
                                  className="text-amber-600 hover:text-amber-800 transition-colors font-bold uppercase tracking-wide cursor-pointer"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Selected Complaint Detail Pane (Right 1 col) */}
                <div className="bg-white border border-slate-200 rounded shadow-sm p-5 space-y-6">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400 border-b border-slate-100 pb-2">
                    Resolution Actions
                  </h3>

                  <AnimatePresence mode="wait">
                    {!selectedComplaint ? (
                      <div className="text-center py-16 text-slate-400 space-y-2">
                        <UserCheck className="w-8 h-8 mx-auto opacity-30" />
                        <p className="text-xs uppercase font-bold tracking-wider">No Complaint Selected</p>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Click "View" on any queue record to update resolution status, view details, and trace routing maps.
                        </p>
                      </div>
                    ) : (
                      <motion.div
                        key={selectedComplaint.complaint_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-5"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="font-mono text-xs font-black tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                              {selectedComplaint.complaint_id}
                            </span>
                            <div className="flex gap-2 mt-2">
                              <PriorityBadge level={selectedComplaint.priority} />
                              <span className={statusBadgeStyles[selectedComplaint.status] || ""}>
                                {selectedComplaint.status}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedComplaint(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Description</label>
                          <p className="text-xs leading-relaxed border border-slate-100 p-3 bg-slate-50 rounded uppercase">
                            {selectedComplaint.description}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Routed Department</label>
                          <p className="text-xs font-bold uppercase flex items-center gap-1.5 text-slate-700">
                            <Building2 className="w-4 h-4" /> {selectedComplaint.department}
                          </p>
                        </div>

                        {/* Status Change selectors */}
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                          <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Set Resolution Status</label>
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              variant={selectedComplaint.status === "ASSIGNED" ? "default" : "outline"}
                              onClick={() => handleStatusUpdate("ASSIGNED")}
                              disabled={updatingStatus}
                              className="rounded-none font-bold tracking-widest uppercase text-xs h-9"
                            >
                              Assign Department
                            </Button>
                            <Button
                              variant={selectedComplaint.status === "IN_PROGRESS" ? "default" : "outline"}
                              onClick={() => handleStatusUpdate("IN_PROGRESS")}
                              disabled={updatingStatus}
                              className="rounded-none font-bold tracking-widest uppercase text-xs h-9"
                            >
                              Mark In Progress
                            </Button>
                            <Button
                              variant={selectedComplaint.status === "RESOLVED" ? "default" : "outline"}
                              onClick={() => handleStatusUpdate("RESOLVED")}
                              disabled={updatingStatus}
                              className="rounded-none font-bold tracking-widest uppercase text-xs h-9"
                            >
                              Resolve Ticket
                            </Button>
                          </div>
                        </div>

                        {/* Location mini-map */}
                        <div className="space-y-2 pt-3 border-t border-slate-100">
                          <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Geocode & Route Map</label>
                          {isGeocoding ? (
                            <div className="h-40 flex items-center justify-center bg-slate-50 border border-slate-100">
                              <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
                              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Loading Map...</span>
                            </div>
                          ) : mapLocation ? (
                            <div className="space-y-1.5">
                              <CivicMap
                                issueLocation={mapLocation}
                                height="180px"
                              />
                              <p className="text-[9px] text-slate-400 font-mono leading-tight">
                                COORDS: {mapLocation.lat.toFixed(4)}, {mapLocation.lng.toFixed(4)}
                              </p>
                            </div>
                          ) : (
                            <div className="h-20 flex items-center justify-center bg-slate-50 border border-slate-100 text-center p-3 text-[10px] text-slate-400 uppercase leading-relaxed tracking-wider">
                              No coordinates available
                            </div>
                          )}
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          )}

          {/* Tab 3: All Complaints list view */}
          {activePanel === "all" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <h2 className="font-erode text-2xl font-black uppercase tracking-tight">All Stored Complaints</h2>
              <div className="bg-white border border-slate-200 p-4 rounded shadow-sm space-y-3">
                {complaints.map((c) => (
                  <div key={c.complaint_id} className="p-3 border-b last:border-0 border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-mono font-bold text-slate-600">{c.complaint_id}</p>
                      <p className="text-slate-500 uppercase mt-1">{c.description}</p>
                    </div>
                    <PriorityBadge level={c.priority} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tab 4: Departments performance tracker */}
          {activePanel === "departments" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <h2 className="font-erode text-2xl font-black uppercase tracking-tight">Departments Control Index</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {departmentsList.map((dept) => (
                  <Card key={dept} className="rounded-none border-2 bg-white">
                    <CardHeader>
                      <CardTitle className="text-xs font-bold tracking-widest uppercase">{dept}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-mono font-black">{stats?.departments[dept] || 0} Tickets</p>
                      <p className="text-[10px] text-slate-400 uppercase mt-1">Pending allocation & workload</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tab 5: Civic Reports index */}
          {activePanel === "reports" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 text-center py-16 bg-white border border-slate-200 rounded"
            >
              <FileText className="w-12 h-12 mx-auto text-slate-400 opacity-40" />
              <h2 className="font-erode text-xl font-black uppercase tracking-tight">Performance Reports Registry</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Generate monthly departmental audit reports, AI routing efficiency indicators, and citizens feedback metrics.
              </p>
              <Button variant="outline" className="rounded-none font-bold text-xs uppercase tracking-wider px-6 mt-4">
                Generate Audit PDF
              </Button>
            </motion.div>
          )}

          {/* Tab 6: Welfare Applications management */}
          {activePanel === "welfare-applications" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-erode text-2xl font-black uppercase tracking-tight">Welfare Scheme Applications</h2>
                  <p className="text-xs text-slate-400 mt-1">Review pending citizen scheme applications, execute AI verification checks, and dispatch initial benefits.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { loadWelfareApplications(); }}
                  className="rounded-none font-bold tracking-widest uppercase text-xs border border-slate-300 bg-white"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Refresh Apps
                </Button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                
                {/* Applications list table */}
                <div className="xl:col-span-2 bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
                      Pending Review ({welfareApps.length})
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[9px] font-black tracking-wider">
                          <th className="px-4 py-3">Citizen ID</th>
                          <th className="px-4 py-3">Welfare Scheme</th>
                          <th className="px-4 py-3 text-center">Score</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {welfareApps.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-16 text-slate-400 font-bold uppercase tracking-wider">
                              No pending scheme applications found
                            </td>
                          </tr>
                        ) : (
                          welfareApps.map((app) => (
                            <tr
                              key={app.enrollment_id}
                              onClick={() => setSelectedWelfareApp(app)}
                              className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                                selectedWelfareApp?.enrollment_id === app.enrollment_id
                                  ? "bg-slate-50 font-medium"
                                  : ""
                              }`}
                            >
                              <td className="px-4 py-3.5 font-mono font-bold text-slate-600">
                                {app.user_id}
                              </td>
                              <td className="px-4 py-3.5 uppercase font-medium truncate max-w-[250px]">
                                {app.scheme_name}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-bold">
                                {Math.round((app.relevance_score || 0.75) * 100)}%
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="bg-amber-50 text-amber-700 border-amber-300 border rounded px-2.5 py-1 text-[10px] font-bold tracking-wide flex items-center gap-1.5 w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  {app.status.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedWelfareApp(app);
                                  }}
                                  className="text-amber-600 hover:text-amber-800 transition-colors font-bold uppercase tracking-wide cursor-pointer"
                                >
                                  Review
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Details drawer */}
                <div className="bg-white border border-slate-200 rounded shadow-sm p-5 space-y-6">
                  <h3 className="text-xs font-bold tracking-widest uppercase text-slate-400 border-b border-slate-100 pb-2">
                    Application Review
                  </h3>

                  <AnimatePresence mode="wait">
                    {!selectedWelfareApp ? (
                      <div className="text-center py-16 text-slate-400 space-y-2">
                        <UserCheck className="w-8 h-8 mx-auto opacity-30" />
                        <p className="text-xs uppercase font-bold tracking-wider">No Application Selected</p>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Select a record from the applications queue to execute verify checks and disburse benefits.
                        </p>
                      </div>
                    ) : (
                      <motion.div
                        key={selectedWelfareApp.enrollment_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-5"
                      >
                        <div>
                          <span className="font-mono text-xs font-black tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                            {selectedWelfareApp.enrollment_id}
                          </span>
                          <p className="text-xs font-bold text-slate-700 uppercase mt-2">{selectedWelfareApp.scheme_name}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Citizen: {selectedWelfareApp.user_id}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Relevance Score: {Math.round((selectedWelfareApp.relevance_score || 0.75) * 100)}%</p>
                        </div>

                        {selectedWelfareApp.eligibility_snapshot && (
                          <div className="space-y-1.5 border-t border-slate-150 pt-3">
                            <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Profile Snapshot</label>
                            <div className="bg-slate-50 p-3 border border-slate-100 font-mono text-[10px] space-y-1.5 text-slate-600">
                              <div>AGE: {selectedWelfareApp.eligibility_snapshot.age}</div>
                              <div>GENDER: {selectedWelfareApp.eligibility_snapshot.gender}</div>
                              <div>STATE: {selectedWelfareApp.eligibility_snapshot.state}</div>
                              <div>INCOME: ₹{(selectedWelfareApp.eligibility_snapshot.family_annual_income || selectedWelfareApp.eligibility_snapshot.family_income || 0).toLocaleString("en-IN")}</div>
                              <div>BPL CATEGORY: {selectedWelfareApp.eligibility_snapshot.bpl_category ? "YES" : "NO"}</div>
                              <div>DISABILITY: {selectedWelfareApp.eligibility_snapshot.disability || selectedWelfareApp.eligibility_snapshot.has_disability ? "YES" : "NO"}</div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 border-t border-slate-150 pt-3">
                          <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Verification Document URLs</label>
                          <div className="space-y-1">
                            {Object.entries(
                              JSON.parse(localStorage.getItem(`yoryojana-docs-${selectedWelfareApp.enrollment_id}`) || "{}")
                            ).map(([docName, docUrl]: any) => (
                              <div key={docName} className="flex justify-between items-center bg-slate-50 p-2 border border-slate-100 text-[10px] font-mono">
                                <span className="font-bold">{docName}:</span>
                                <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[140px]">
                                  {docUrl}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>

                        {selectedWelfareApp.status === "REGISTRATION_PENDING" && (
                          <div className="space-y-3 pt-3 border-t border-slate-150">
                            <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Saarthi AI Verification Agent</label>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                onClick={() => handleWelfareVerify(selectedWelfareApp.enrollment_id, true)}
                                disabled={verifyingWelfare}
                                className="rounded-none font-bold tracking-widest uppercase text-xs h-9 bg-emerald-600 text-white"
                              >
                                {verifyingWelfare ? "..." : "Approve & Verify"}
                              </Button>
                              <Button
                                onClick={() => handleWelfareVerify(selectedWelfareApp.enrollment_id, false)}
                                disabled={verifyingWelfare}
                                className="rounded-none font-bold tracking-widest uppercase text-xs h-9 bg-red-600 text-white"
                              >
                                {verifyingWelfare ? "..." : "Request Correction"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedWelfareApp.status === "APPROVED" && (
                          <div className="space-y-3 pt-3 border-t border-slate-150">
                            <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Disburse Initial Benefits (ACTIVE Transition)</label>
                            <div className="space-y-2">
                              <input 
                                type="number" 
                                value={disbursementAmount}
                                onChange={(e) => setDisbursementAmount(Number(e.target.value))}
                                className="w-full border border-slate-300 px-2 py-1 text-xs" 
                                placeholder="Disbursement Amount (INR)"
                              />
                              <input 
                                type="text" 
                                value={disbursementRemarks}
                                onChange={(e) => setDisbursementRemarks(e.target.value)}
                                className="w-full border border-slate-300 px-2 py-1 text-xs" 
                                placeholder="Remarks"
                              />
                              <Button
                                onClick={() => handleWelfareDisburse(selectedWelfareApp.enrollment_id)}
                                disabled={disbursingWelfare}
                                className="w-full rounded-none font-bold tracking-widest uppercase text-xs h-9 bg-primary text-white"
                              >
                                {disbursingWelfare ? "Recording..." : "Disburse Benefit"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedWelfareApp.status === "ACTIVE" && (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 text-xs font-bold text-center uppercase tracking-wide">
                            ✓ Scheme Active & Enrolled
                          </div>
                        )}
                        
                        {selectedWelfareApp.status === "DOCUMENT_CORRECTION_REQUIRED" && (
                          <div className="bg-red-50 border border-red-200 text-red-800 p-3 text-xs font-mono text-center uppercase tracking-wide">
                            Awaiting Citizen Correction Upload
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

        </main>
      </div>

    </div>
  )
}
export default GovDashboard
