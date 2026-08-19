import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FileText, Clock, CheckCircle, IndianRupee, Loader2 } from "lucide-react"
import { Button } from "../components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card"
import { useUser } from "../hooks/useUser"
import { getDashboard } from "../services/mockSaarthi"
import type { Enrollment } from "../types"
import { Link, useNavigate } from "react-router-dom"

export function Dashboard() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate("/")
      return
    }

    const fetchDashboard = async () => {
      const data = await getDashboard(user.mobile)
      setEnrollments(data)
      setLoading(false)
    }

    fetchDashboard()
  }, [user, navigate])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name}.</h1>
        <p className="text-muted-foreground mt-2">Here's what's happening with your support.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Schemes</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Applications</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrollments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Benefits Received <span className="text-[10px] bg-muted px-1 rounded ml-1">DEMO</span></CardTitle>
            <IndianRupee className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹4,500</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Savings <span className="text-[10px] bg-muted px-1 rounded ml-1">DEMO</span></CardTitle>
            <IndianRupee className="h-4 w-4 text-secondary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹1,500</div>
          </CardContent>
        </Card>

      </div>

      {/* My Schemes List */}
      <div>
        <h2 className="text-2xl font-bold mb-6">My Schemes</h2>
        
        {enrollments.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No saved schemes yet.</h3>
            <p className="text-muted-foreground mb-6">Explore schemes that may be relevant to you.</p>
            <Button asChild>
              <Link to="/schemes">Find Schemes</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {enrollments.map((enr, i) => (
              <motion.div
                key={enr.enrollment_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row p-6 items-start md:items-center gap-6">
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded">
                          {enr.enrollment_id}
                        </span>
                        <span className="text-xs font-medium text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-full flex items-center">
                          <Clock className="mr-1 h-3 w-3" /> {enr.status}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg line-clamp-1">{enr.scheme_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        <strong>Next Action:</strong> {enr.next_action}
                      </p>
                    </div>

                    <div className="w-full md:w-48 shrink-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{enr.progress}%</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary"
                          style={{ width: `${enr.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-full md:w-auto shrink-0 flex justify-end">
                      <Button variant="outline" className="w-full md:w-auto" asChild>
                        <Link to={`/enrollment/${enr.enrollment_id}`}>
                          View Application
                        </Link>
                      </Button>
                    </div>

                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
