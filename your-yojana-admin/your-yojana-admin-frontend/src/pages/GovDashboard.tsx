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
  Clock,
} from "lucide-react"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { PriorityBadge } from "../components/civic/PriorityBadge"
import { CivicMap } from "../components/civic/CivicMap"
import { ThemeToggle } from "../components/ui/ThemeToggle"
import {
  fetchAdminSummary,
  fetchSchemesPerformance,
  fetchCivicPerformance,
  fetchCollabPerformance,
  fetchComplaintsList,
  updateComplaintStatus,
} from "../services/adminService"
import type {
  SummaryData,
  SchemesPerformanceData,
  CivicPerformanceData,
  CollabPerformanceData,
  ComplaintRecord,
} from "../services/adminService"

// Brutalist status colors matching theme guidelines
const statusBadgeStyles: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground border-2 border-foreground px-2.5 py-1 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5",
  ASSIGNED: "bg-[#bfdbfe] dark:bg-[#1e3a8a] text-foreground border-2 border-foreground px-2.5 py-1 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5",
  IN_PROGRESS: "bg-[#fde68a] dark:bg-[#78350f] text-foreground border-2 border-foreground px-2.5 py-1 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5",
  RESOLVED: "bg-[#bbf7d0] dark:bg-[#064e3b] text-foreground border-2 border-foreground px-2.5 py-1 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5",
}

export function GovDashboard() {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [schemes, setSchemes] = useState<SchemesPerformanceData | null>(null)
  const [civic, setCivic] = useState<CivicPerformanceData | null>(null)
  const [collab, setCollab] = useState<CollabPerformanceData | null>(null)
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([])
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Active Tab/Panel Selection (Dashboard, Queue, All, Departments, Reports)
  const [activePanel, setActivePanel] = useState<"dashboard" | "queue" | "all" | "departments" | "reports">("queue")
  
  // Sub-tabs inside the Dashboard Panel
  const [dashTab, setDashTab] = useState<"summary" | "schemes" | "civic" | "collab">("summary")

  // Filters state (from resolution queue)
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [priorityFilter, setPriorityFilter] = useState("ALL")
  const [deptFilter, setDeptFilter] = useState("ALL")
  const [locationSearch, setLocationSearch] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Selected complaint details drawer
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRecord | null>(null)
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Load dashboard data from admin API (port 8001)
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const [sumData, schData, civData, colData, listData] = await Promise.all([
        fetchAdminSummary(),
        fetchSchemesPerformance(),
        fetchCivicPerformance(),
        fetchCollabPerformance(),
        fetchComplaintsList(),
      ])
      setSummary(sumData)
      setSchemes(schData)
      setCivic(civData)
      setCollab(colData)
      setComplaints(listData.complaints)
    } catch {
      setError("Unable to retrieve performance telemetry. Ensure admin backend is running on port 8001.")
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
      setSelectedComplaint((prev: ComplaintRecord | null) => (prev ? { ...prev, status: newStatus as any } : null))
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

  // Clear filters
  const handleClearFilters = () => {
    setStatusFilter("ALL")
    setPriorityFilter("ALL")
    setDeptFilter("ALL")
    setLocationSearch("")
    setSearchQuery("")
  }

  // Count priorities inside current results for resolution badges
  const totalCount = complaints.length
  const criticalCount = complaints.filter((c) => c.priority === "CRITICAL").length
  const highCount = complaints.filter((c) => c.priority === "HIGH").length
  const mediumCount = complaints.filter((c) => c.priority === "MEDIUM").length
  const lowCount = complaints.filter((c) => c.priority === "LOW").length

  const pendingCount = complaints.filter((c) => c.status === "PENDING").length
  const progressCount = complaints.filter((c) => c.status === "IN_PROGRESS").length
  const resolvedCount = complaints.filter((c) => c.status === "RESOLVED").length

  // Departments List
  const departmentsList = Array.from(new Set(complaints.map((c) => c.department).filter(Boolean)))

  if (loading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-background text-foreground dot-grid">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-foreground" />
        <p className="text-xs font-black tracking-widest uppercase animate-pulse text-foreground">
          LOADING GOVERNMENT CONTROL PANEL...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[90vh] bg-background flex flex-col font-sans antialiased text-foreground selection:bg-foreground selection:text-background relative">
      
      {/* ─── Top Header Portal Bar (Brutalist Style) ─── */}
      <header className="sticky top-0 z-50 w-full border-b-2 border-foreground bg-background px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border-2 border-foreground flex items-center justify-center font-erode font-black text-xl bg-foreground text-background">
            YY
          </div>
          <div>
            <h1 className="font-erode text-lg font-black tracking-tighter flex flex-wrap items-center gap-2 uppercase">
              Your Yojana.
              <span className="text-[9px] bg-foreground text-background border border-foreground px-1.5 py-0.5 font-mono font-bold tracking-widest">
                GOVERNMENT RESOLUTION PORTAL
              </span>
            </h1>
            <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">INTELLIGENT URBAN RESOLUTION MATRIX</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="hidden lg:flex items-center gap-1.5 border-2 border-foreground bg-card px-3 py-1.5 text-[10px] uppercase font-bold">
            <span className="text-amber-600 dark:text-amber-400 font-black">Municipal Corporation</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">Updated: Live Feed</span>
          </div>
          <div className="flex items-center gap-2 border-l-2 border-foreground pl-6">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-black text-foreground uppercase tracking-wider">Officer Singh</span>
          </div>
          <ThemeToggle />
          <a
            href="http://localhost:5173/civic"
            className="border-2 border-foreground bg-card hover:bg-foreground hover:text-background px-3 py-1.5 uppercase font-black tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all text-xs"
          >
            Citizen Portal
          </a>
        </div>
      </header>

      {/* ─── Split Sidebar & Content Grid ─── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* Left Sidebar Menu */}
        <aside className="w-full lg:w-60 bg-card text-foreground border-r-2 border-foreground p-4 space-y-8 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-3 px-3">
                OPERATIONS
              </p>
              <nav className="space-y-2">
                <button
                  onClick={() => setActivePanel("dashboard")}
                  className={`w-full text-left px-3 py-2.5 text-xs font-black tracking-widest uppercase border-2 transition-all flex items-center justify-between cursor-pointer ${
                    activePanel === "dashboard"
                      ? "bg-foreground text-background border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] translate-x-[-1px] translate-y-[-1px]"
                      : "bg-card border-transparent hover:border-foreground hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                  </span>
                  <span className="text-[9px] border border-current px-1.5 py-0.5 font-mono font-bold tracking-widest">ANALYTICS</span>
                </button>
                <button
                  onClick={() => setActivePanel("queue")}
                  className={`w-full text-left px-3 py-2.5 text-xs font-black tracking-widest uppercase border-2 transition-all flex items-center justify-between cursor-pointer ${
                    activePanel === "queue"
                      ? "bg-foreground text-background border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] translate-x-[-1px] translate-y-[-1px]"
                      : "bg-card border-transparent hover:border-foreground hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Inbox className="w-3.5 h-3.5" /> Queue
                  </span>
                  {pendingCount > 0 && (
                    <span className="bg-red-600 text-white border border-foreground font-mono text-[9px] font-bold px-1.5 py-0.5">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActivePanel("all")}
                  className={`w-full text-left px-3 py-2.5 text-xs font-black tracking-widest uppercase border-2 transition-all flex items-center justify-between cursor-pointer ${
                    activePanel === "all"
                      ? "bg-foreground text-background border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] translate-x-[-1px] translate-y-[-1px]"
                      : "bg-card border-transparent hover:border-foreground hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> Tickets
                  </span>
                  <span className="text-[9px] font-mono font-bold">({complaints.length})</span>
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-3 px-3">
                MANAGEMENT
              </p>
              <nav className="space-y-2">
                <button
                  onClick={() => setActivePanel("departments")}
                  className={`w-full text-left px-3 py-2.5 text-xs font-black tracking-widest uppercase border-2 transition-all flex items-center justify-between cursor-pointer ${
                    activePanel === "departments"
                      ? "bg-foreground text-background border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] translate-x-[-1px] translate-y-[-1px]"
                      : "bg-card border-transparent hover:border-foreground hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" /> Sectors
                  </span>
                  <span className="text-[9px] font-mono font-bold">({departmentsList.length})</span>
                </button>
                <button
                  onClick={() => setActivePanel("reports")}
                  className={`w-full text-left px-3 py-2.5 text-xs font-black tracking-widest uppercase border-2 transition-all flex items-center justify-between cursor-pointer ${
                    activePanel === "reports"
                      ? "bg-foreground text-background border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] translate-x-[-1px] translate-y-[-1px]"
                      : "bg-card border-transparent hover:border-foreground hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" /> Reports
                  </span>
                </button>
              </nav>
            </div>
          </div>

          <div className="border-t-2 border-foreground pt-4 space-y-3 text-xs">
            <div className="px-3 py-1.5 text-muted-foreground text-[10px] uppercase font-mono flex items-center justify-between border-b border-foreground/10">
              <span>SYSTEM STATE</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">ONLINE</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="w-full text-left px-3 py-2.5 border-2 border-foreground hover:bg-foreground hover:text-background hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all flex items-center gap-2 text-foreground font-black uppercase text-xs tracking-widest bg-card cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>REFRESH FEED</span>
            </button>
          </div>
        </aside>

        {/* ─── Main Content Workspace ─── */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6 bg-background text-foreground dot-grid">
          {error && (
            <div className="border-2 border-red-600 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-4 text-xs tracking-wider uppercase font-black mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
              {error}
            </div>
          )}

          {/* PANEL 1: Analytics Dashboard (Embedding Schemes, Civic, and Collab telemetry) */}
          {activePanel === "dashboard" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b-2 border-foreground pb-4">
                <div>
                  <h2 className="font-erode text-2xl font-black uppercase tracking-tight">Analytics Dashboard</h2>
                  <p className="text-xs text-muted-foreground mt-1 uppercase font-bold tracking-wide">Live visual graphs and performance analysis metrics</p>
                </div>
              </div>

              {/* Sub tabs inside the Dashboard Panel */}
              <div className="flex flex-wrap gap-2 border-b-2 border-foreground pb-2">
                {(["summary", "schemes", "civic", "collab"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDashTab(tab)}
                    className={`py-2.5 px-4 text-xs font-black tracking-widest uppercase border-2 transition-all cursor-pointer ${
                      dashTab === tab
                        ? "bg-foreground text-background border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] translate-x-[-1px] translate-y-[-1px]"
                        : "bg-card border-foreground text-foreground hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                    }`}
                  >
                    {tab === "summary" && "Summary Index"}
                    {tab === "schemes" && "Schemes Matches"}
                    {tab === "civic" && "Civic Resolutions"}
                    {tab === "collab" && "Cross-Sector Synergy"}
                  </button>
                ))}
              </div>

              {/* Dashboard Sub-tab 1: Summary Index */}
              {dashTab === "summary" && summary && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card border-2 border-foreground p-6 flex flex-col justify-between hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all duration-300">
                      <div>
                        <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Scheme Matching</p>
                        <p className="text-4xl font-black font-mono mt-2 text-foreground">{summary.schemes.total_recommendations}</p>
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-black uppercase mt-4">Match Accuracy: {summary.schemes.success_rate}%</p>
                    </div>

                    <div className="bg-card border-2 border-foreground p-6 flex flex-col justify-between hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all duration-300">
                      <div>
                        <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Civic Action Tickets</p>
                        <p className="text-4xl font-black font-mono mt-2 text-foreground">{complaints.length}</p>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-black uppercase mt-4">Active Queue: {pendingCount} Pending</p>
                    </div>

                    <div className="bg-card border-2 border-foreground p-6 flex flex-col justify-between hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all duration-300">
                      <div>
                        <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Collaboration Index</p>
                        <p className="text-4xl font-black font-mono mt-2 text-foreground">{summary.collaboration.index}%</p>
                      </div>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-black uppercase mt-4">Cooperative Projects: {summary.collaboration.projects}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-none border-2 border-foreground p-6 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-300">
                      <h3 className="font-erode text-xs font-black uppercase tracking-widest mb-6">RESOLUTION SPEED INDEX (SLA)</h3>
                      <div className="space-y-4 pt-2">
                        <div>
                          <div className="flex justify-between text-xs font-mono font-bold mb-1 uppercase text-foreground">
                            <span>Critical (Target &lt; 8h)</span>
                            <span>6.2 Hours</span>
                          </div>
                          <div className="h-3 bg-muted overflow-hidden border-2 border-foreground">
                            <div className="h-full bg-red-600 border-r border-foreground" style={{ width: "77%" }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-mono font-bold mb-1 uppercase text-foreground">
                            <span>High (Target &lt; 16h)</span>
                            <span>12.4 Hours</span>
                          </div>
                          <div className="h-3 bg-muted overflow-hidden border-2 border-foreground">
                            <div className="h-full bg-amber-500 border-r border-foreground" style={{ width: "77%" }} />
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-none border-2 border-foreground p-6 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-300">
                      <h3 className="font-erode text-xs font-black uppercase tracking-widest mb-6">JOINT PROJECT TRACKER</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs p-3 border-2 border-foreground bg-background hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all">
                          <strong className="uppercase">Road & Utility excavation</strong>
                          <span className="text-[9px] bg-foreground text-background px-2 py-0.5 border border-foreground uppercase font-black tracking-widest">Done</span>
                        </div>
                        <div className="flex justify-between items-center text-xs p-3 border-2 border-foreground bg-background hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all">
                          <strong className="uppercase">Waterlogging prevention Grid</strong>
                          <span className="text-[9px] bg-amber-500 text-black px-2 py-0.5 border border-foreground uppercase font-black tracking-widest">Active</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* Dashboard Sub-tab 2: Schemes matches */}
              {dashTab === "schemes" && schemes && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-none border-2 border-foreground p-6 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-300">
                      <h3 className="font-erode text-xs font-black uppercase tracking-widest mb-6">SCHEMES MATCHES BY CATEGORIES</h3>
                      <div className="space-y-4">
                        {schemes.categories.map((cat: any, idx: number) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-black uppercase text-foreground">
                              <span>{cat.name}</span>
                              <span>{cat.count} matches ({cat.percentage}%)</span>
                            </div>
                            <div className="h-3 bg-muted overflow-hidden border-2 border-foreground">
                              <div className="h-full bg-foreground border-r border-foreground" style={{ width: `${cat.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="rounded-none border-2 border-foreground p-6 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-300">
                      <h3 className="font-erode text-xs font-black uppercase tracking-widest mb-6">MATCHING ACCURACY RATE (%)</h3>
                      <div className="w-full h-64">
                        <svg viewBox="0 0 500 240" className="w-full h-full">
                          <line x1="40" y1="30" x2="480" y2="30" stroke="var(--border)" strokeOpacity={0.2} strokeWidth="1" />
                          <line x1="40" y1="100" x2="480" y2="100" stroke="var(--border)" strokeOpacity={0.2} strokeWidth="1" />
                          <line x1="40" y1="180" x2="480" y2="180" stroke="var(--foreground)" strokeWidth="2" />
                          <text x="15" y="34" className="text-[9px] fill-muted-foreground font-black" textAnchor="middle">100%</text>
                          <text x="15" y="104" className="text-[9px] fill-muted-foreground font-black" textAnchor="middle">50%</text>
                          <text x="15" y="184" className="text-[9px] fill-muted-foreground font-black" textAnchor="middle">0%</text>

                          {schemes.matching_efficiency.map((e: any, i: number) => (
                            <g key={i}>
                              <text x={60 + i * 70} y="210" className="text-[9px] fill-foreground font-black uppercase" textAnchor="middle">{e.month}</text>
                              <rect x={50 + i * 70} y={180 - e.accuracy * 1.5} width="20" height={e.accuracy * 1.5} fill="var(--foreground)" border-width="2" stroke="var(--foreground)" />
                              <text x={60 + i * 70} y={170 - e.accuracy * 1.5} className="text-[9px] font-mono font-bold fill-foreground" textAnchor="middle">{e.accuracy}%</text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* Dashboard Sub-tab 3: Civic Resolutions */}
              {dashTab === "civic" && civic && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-none border-2 border-foreground p-6 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-300">
                      <h3 className="font-erode text-xs font-black uppercase tracking-widest mb-6">REPORTED VS RESOLVED CIVIC TICKETS</h3>
                      <div className="w-full h-64">
                        <svg viewBox="0 0 500 240" className="w-full h-full">
                          <line x1="40" y1="30" x2="480" y2="30" stroke="var(--border)" strokeOpacity={0.2} strokeWidth="1" />
                          <line x1="40" y1="100" x2="480" y2="100" stroke="var(--border)" strokeOpacity={0.2} strokeWidth="1" />
                          <line x1="40" y1="180" x2="480" y2="180" stroke="var(--foreground)" strokeWidth="2" />
                          <text x="15" y="34" className="text-[9px] fill-muted-foreground font-black" textAnchor="middle">50</text>
                          <text x="15" y="104" className="text-[9px] fill-muted-foreground font-black" textAnchor="middle">25</text>
                          <text x="15" y="184" className="text-[9px] fill-muted-foreground font-black" textAnchor="middle">0</text>

                          {civic.trends.map((t: any, i: number) => (
                            <g key={i}>
                              <text x={60 + i * 90} y="210" className="text-[9px] fill-foreground font-black uppercase" textAnchor="middle">{t.month}</text>
                              <circle cx={60 + i * 90} cy={180 - t.reported * 3} r="4" fill="var(--foreground)" />
                              <text x={60 + i * 90} y={170 - t.reported * 3} className="text-[9px] font-mono font-bold fill-foreground" textAnchor="middle">{t.reported}</text>
                              <circle cx={60 + i * 90} cy={180 - t.resolved * 3} r="4" fill="#10b981" />
                              <text x={60 + i * 90} y={192 - t.resolved * 3} className="text-[9px] font-mono font-bold fill-emerald-600 dark:fill-emerald-400" textAnchor="middle">{t.resolved}</text>
                            </g>
                          ))}

                          <path d={`M 60,${180 - civic.trends[0].reported * 3} L 150,${180 - civic.trends[1].reported * 3} L 240,${180 - civic.trends[2].reported * 3} L 330,${180 - civic.trends[3].reported * 3} L 420,${180 - civic.trends[4].reported * 3}`} fill="none" stroke="var(--foreground)" strokeWidth="2.5" />
                          <path d={`M 60,${180 - civic.trends[0].resolved * 3} L 150,${180 - civic.trends[1].resolved * 3} L 240,${180 - civic.trends[2].resolved * 3} L 330,${180 - civic.trends[3].resolved * 3} L 420,${180 - civic.trends[4].resolved * 3}`} fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="3" />
                        </svg>
                      </div>
                    </Card>

                    <Card className="rounded-none border-2 border-foreground p-6 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-300">
                      <h3 className="font-erode text-xs font-black uppercase tracking-widest mb-6">DEPARTMENT TICKET RESOLUTIONS</h3>
                      <div className="space-y-4">
                        {civic.categories.map((c: any, i: number) => (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-black uppercase text-foreground">
                              <span>{c.name}</span>
                              <span>{c.count} tickets ({c.percentage}%)</span>
                            </div>
                            <div className="h-3 bg-muted overflow-hidden border-2 border-foreground">
                              <div className="h-full bg-foreground border-r border-foreground" style={{ width: `${c.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* Dashboard Sub-tab 4: Cross-Sector Synergy */}
              {dashTab === "collab" && collab && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-none border-2 border-foreground p-6 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-300">
                      <h3 className="font-erode text-xs font-black uppercase tracking-widest mb-6">SECTOR INTERACTION RATINGS</h3>
                      <div className="space-y-4">
                        {collab.synergy_scores.map((score: any, idx: number) => (
                          <div key={idx} className="p-4 border-2 border-foreground bg-background space-y-2 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all">
                            <div className="flex justify-between items-center text-xs font-black uppercase">
                              <span>{score.sector_a} ↔ {score.sector_b}</span>
                              <span>Synergy: {score.synergy}%</span>
                            </div>
                            <div className="h-3 bg-muted overflow-hidden border-2 border-foreground">
                              <div className="h-full bg-foreground border-r border-foreground" style={{ width: `${score.synergy}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="rounded-none border-2 border-foreground p-6 bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-300">
                      <h3 className="font-erode text-xs font-black uppercase tracking-widest mb-6">COOPERATIVE JOINT PROJECTS</h3>
                      <div className="space-y-3">
                        {collab.cooperative_projects.map((proj: any) => (
                          <div key={proj.id} className="p-4 border-2 border-foreground bg-background space-y-3 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-mono text-[9px] bg-foreground text-background px-1.5 py-0.5 border border-foreground font-black uppercase mr-2">{proj.id}</span>
                                <strong className="text-xs uppercase">{proj.name}</strong>
                              </div>
                              <span className="text-[9px] font-black px-2 py-0.5 border-2 border-foreground bg-card uppercase tracking-widest">{proj.status}</span>
                            </div>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> EFFICIENCY SAVING: {proj.efficiency_gain}
                            </p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* PANEL 2: Resolution Queue Panel (Matches user Gov Dashboard screenshot exactly) */}
          {activePanel === "queue" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-erode text-2xl md:text-3xl font-black uppercase tracking-tight">Resolution Queue</h2>
                  <p className="text-xs text-muted-foreground mt-1 uppercase font-bold tracking-wide">AI-prioritized civic complaints sorted by priority score (highest first)</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="rounded-none font-black tracking-widest uppercase text-xs border-2 border-foreground bg-card hover:bg-foreground hover:text-background hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  {refreshing ? (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>

              {/* KPI Counter Cards Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="bg-card border-2 border-foreground p-4 text-center hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all">
                  <p className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">TOTAL</p>
                  <p className="text-2xl font-black font-mono mt-1 text-foreground">{totalCount}</p>
                </div>
                <div className="bg-card border-2 border-foreground p-4 text-center hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all">
                  <p className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">CRITICAL</p>
                  <p className="text-2xl font-black font-mono text-red-600 dark:text-red-400 mt-1">{criticalCount}</p>
                </div>
                <div className="bg-card border-2 border-foreground p-4 text-center hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all">
                  <p className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">HIGH</p>
                  <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">{highCount}</p>
                </div>
                <div className="bg-card border-2 border-foreground p-4 text-center hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all">
                  <p className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">MEDIUM</p>
                  <p className="text-2xl font-black font-mono text-yellow-600 dark:text-yellow-400 mt-1">{mediumCount}</p>
                </div>
                <div className="bg-card border-2 border-foreground p-4 text-center hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all">
                  <p className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">LOW</p>
                  <p className="text-2xl font-black font-mono text-muted-foreground mt-1">{lowCount}</p>
                </div>
                <div className="bg-card border-2 border-foreground p-4 text-center hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] transition-all">
                  <p className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">PENDING</p>
                  <p className="text-2xl font-black font-mono text-orange-600 dark:text-orange-400 mt-1">{pendingCount}</p>
                </div>
                <div className="bg-card border-2 border-foreground p-4 text-center hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all">
                  <p className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">IN PROGRESS</p>
                  <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">{progressCount}</p>
                </div>
                <div className="bg-card border-2 border-foreground p-4 text-center hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-all">
                  <p className="text-[9px] font-black tracking-widest uppercase text-muted-foreground">RESOLVED</p>
                  <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">{resolvedCount}</p>
                </div>
              </div>

              {/* Filters Row */}
              <div className="bg-card border-2 border-foreground p-4 flex flex-wrap items-center gap-3">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-9 border-2 border-foreground px-2 text-xs font-black uppercase tracking-widest focus:outline-none bg-background text-foreground cursor-pointer"
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
                  className="h-9 border-2 border-foreground px-2 text-xs font-black uppercase tracking-widest focus:outline-none bg-background text-foreground cursor-pointer"
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
                  className="h-9 border-2 border-foreground px-2 text-xs font-black uppercase tracking-widest focus:outline-none bg-background text-foreground cursor-pointer"
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
                  className="h-9 border-2 border-foreground px-3 text-xs font-black uppercase tracking-wider placeholder:text-muted-foreground/60 focus:outline-none bg-background text-foreground w-44"
                />

                <input
                  type="text"
                  placeholder="Search complaints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 border-2 border-foreground px-3 text-xs font-black uppercase tracking-wider placeholder:text-muted-foreground/60 focus:outline-none bg-background text-foreground flex-1 min-w-[150px]"
                />

                {(priorityFilter !== "ALL" || statusFilter !== "ALL" || deptFilter !== "ALL" || locationSearch !== "" || searchQuery !== "") && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline transition-colors uppercase font-black tracking-widest px-2 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Grid Layout: Table vs Action Drawer */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                
                {/* Complaints Table */}
                <div className="xl:col-span-2 bg-card border-2 border-foreground overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                  <div className="px-4 py-3 bg-muted border-b-2 border-foreground flex justify-between items-center">
                    <span className="text-xs font-black tracking-widest uppercase text-foreground">
                      Complaints ({filteredComplaints.length})
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
                      Sorted by AI priority score ↓
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-muted text-foreground border-b-2 border-foreground uppercase text-[9px] font-black tracking-widest">
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
                      <tbody className="divide-y divide-foreground/10">
                        {filteredComplaints.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-16 text-muted-foreground font-black uppercase tracking-widest">
                              No tickets match your filter parameters
                            </td>
                          </tr>
                        ) : (
                          filteredComplaints.map((c) => (
                            <tr
                              key={c.complaint_id}
                              onClick={() => setSelectedComplaint(c)}
                              className={`border-b border-foreground/10 hover:bg-muted/50 transition-colors cursor-pointer ${
                                selectedComplaint?.complaint_id === c.complaint_id
                                  ? "bg-muted font-black text-foreground border-l-4 border-foreground"
                                  : ""
                              }`}
                            >
                              <td className="px-4 py-3.5">
                                <PriorityBadge level={c.priority} className="text-[9px] px-1.5 py-0.5" />
                              </td>
                              <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                                {c.complaint_id}
                              </td>
                              <td className="px-4 py-3.5 max-w-[180px] truncate uppercase font-medium">
                                {c.description}
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground font-medium uppercase">
                                {c.category}
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground uppercase truncate max-w-[120px]">
                                {c.location}
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground max-w-[140px] truncate">
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
                                  className="text-foreground hover:underline transition-colors font-black uppercase tracking-widest cursor-pointer"
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

                {/* Selected Complaint Detail Drawer */}
                <div className="bg-card border-2 border-foreground p-5 space-y-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                  <h3 className="text-xs font-black tracking-widest uppercase text-muted-foreground border-b-2 border-foreground pb-2">
                    Resolution Actions
                  </h3>

                  <AnimatePresence mode="wait">
                    {!selectedComplaint ? (
                      <div className="text-center py-16 text-muted-foreground space-y-2">
                        <UserCheck className="w-8 h-8 mx-auto opacity-30" />
                        <p className="text-xs uppercase font-black tracking-widest">No Complaint Selected</p>
                        <p className="text-[10px] text-muted-foreground leading-normal uppercase font-bold tracking-wide">
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
                            <span className="font-mono text-xs font-black tracking-widest bg-muted border border-foreground px-2 py-0.5">
                              {selectedComplaint.complaint_id}
                            </span>
                            <div className="flex gap-2 mt-2">
                              <PriorityBadge level={selectedComplaint.priority} className="text-[9px] px-1.5 py-0.5" />
                              <span className={statusBadgeStyles[selectedComplaint.status] || ""}>
                                {selectedComplaint.status}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedComplaint(null)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">Description</label>
                          <p className="text-xs leading-relaxed border-2 border-foreground p-3 bg-background text-foreground uppercase font-medium">
                            {selectedComplaint.description}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">Routed Department</label>
                          <p className="text-xs font-black uppercase flex items-center gap-1.5 text-foreground">
                            <Building2 className="w-4 h-4" /> {selectedComplaint.department}
                          </p>
                        </div>

                        {/* Status Selectors */}
                        <div className="space-y-3 pt-3 border-t border-foreground/10">
                          <label className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">Set Resolution Status</label>
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              variant={selectedComplaint.status === "ASSIGNED" ? "default" : "outline"}
                              onClick={() => handleStatusUpdate("ASSIGNED")}
                              disabled={updatingStatus}
                              className="rounded-none font-black tracking-widest uppercase text-xs h-9 cursor-pointer border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
                            >
                              Assign Department
                            </Button>
                            <Button
                              variant={selectedComplaint.status === "IN_PROGRESS" ? "default" : "outline"}
                              onClick={() => handleStatusUpdate("IN_PROGRESS")}
                              disabled={updatingStatus}
                              className="rounded-none font-black tracking-widest uppercase text-xs h-9 cursor-pointer border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
                            >
                              Mark In Progress
                            </Button>
                            <Button
                              variant={selectedComplaint.status === "RESOLVED" ? "default" : "outline"}
                              onClick={() => handleStatusUpdate("RESOLVED")}
                              disabled={updatingStatus}
                              className="rounded-none font-black tracking-widest uppercase text-xs h-9 cursor-pointer border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
                            >
                              Resolve Ticket
                            </Button>
                          </div>
                        </div>

                        {/* Route map coordinates */}
                        <div className="space-y-2 pt-3 border-t border-foreground/10">
                          <label className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">Geocode & Route Map</label>
                          {isGeocoding ? (
                            <div className="h-40 flex items-center justify-center bg-muted border-2 border-foreground">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                              <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground">Loading Map...</span>
                            </div>
                          ) : mapLocation ? (
                            <div className="space-y-1.5">
                              <div className="border-2 border-foreground overflow-hidden">
                                <CivicMap
                                  issueLocation={mapLocation}
                                  height="180px"
                                />
                              </div>
                              <p className="text-[9px] text-muted-foreground font-mono leading-tight uppercase font-bold">
                                Coordinates: {mapLocation.lat.toFixed(4)}, {mapLocation.lng.toFixed(4)}
                              </p>
                            </div>
                          ) : (
                            <div className="h-20 flex items-center justify-center bg-muted border-2 border-foreground text-center p-3 text-[10px] text-muted-foreground uppercase leading-relaxed tracking-widest font-black">
                              No location coordinates plotted
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

          {/* PANEL 3: All Complaints Grid List */}
          {activePanel === "all" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <h2 className="font-erode text-2xl font-black uppercase tracking-tight">All Complaints</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {complaints.map((c) => (
                  <Card key={c.complaint_id} className="p-5 bg-card border-2 border-foreground flex flex-col justify-between min-h-[160px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] transition-all duration-300">
                    <div>
                      <div className="flex justify-between">
                        <span className="font-mono text-xs text-muted-foreground font-black">{c.complaint_id}</span>
                        <PriorityBadge level={c.priority} className="text-[9px] px-1.5 py-0.5" />
                      </div>
                      <p className="text-xs font-black uppercase mt-3 text-foreground leading-relaxed truncate">{c.description}</p>
                    </div>
                    <div className="flex justify-between items-center text-[10px] uppercase font-black text-muted-foreground mt-4 border-t border-foreground/10 pt-2">
                      <span>{c.category}</span>
                      <span className={statusBadgeStyles[c.status] || ""}>{c.status}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* PANEL 4: Departments list */}
          {activePanel === "departments" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <h2 className="font-erode text-2xl font-black uppercase tracking-tight">Active Sectors</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {departmentsList.map((dept) => {
                  const deptTicketsCount = complaints.filter((c) => c.department === dept).length
                  const resolvedTicketsCount = complaints.filter((c) => c.department === dept && c.status === "RESOLVED").length
                  return (
                    <Card key={dept} className="p-5 bg-card border-2 border-foreground space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] transition-all duration-300">
                      <h3 className="font-erode text-sm font-black uppercase tracking-widest border-b-2 border-foreground pb-2 text-foreground">{dept}</h3>
                      <div className="flex justify-between text-xs font-black uppercase text-muted-foreground">
                        <span>Total Workload: {deptTicketsCount} Tickets</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Resolved: {resolvedTicketsCount}</span>
                      </div>
                      <div className="h-3 bg-muted overflow-hidden border-2 border-foreground">
                        <div className="h-full bg-foreground" style={{ width: `${(resolvedTicketsCount / (deptTicketsCount || 1)) * 100}%` }} />
                      </div>
                    </Card>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* PANEL 5: Reports Export */}
          {activePanel === "reports" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <h2 className="font-erode text-2xl font-black uppercase tracking-tight">Reports Generation</h2>
              <Card className="p-6 bg-card border-2 border-foreground max-w-xl space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                <p className="text-xs uppercase text-muted-foreground font-black tracking-wider leading-relaxed">
                  Export complete urban performance indexes, schemes recommended count, and collaboration matrices.
                </p>
                <Button className="rounded-none font-black tracking-widest uppercase text-xs h-10 w-full border-2 border-foreground shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all bg-foreground text-background">
                  Generate PDF Summary Report
                </Button>
              </Card>
            </motion.div>
          )}

        </main>
      </div>

      <footer className="border-t-2 border-foreground bg-card py-6 text-center text-[10px] tracking-widest uppercase font-black text-muted-foreground">
        &copy; {new Date().getFullYear()} YOUR YOJANA INTEL-MATRIX. ALL RIGHTS RESERVED.
      </footer>
    </div>
  )
}
export default GovDashboard
