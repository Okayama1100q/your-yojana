import { useEffect, useState } from "react"
import { useLocation, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Bookmark, Loader2, Filter } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import type { Scheme, UserProfile } from "../../types"
import { getRecommendedSchemes } from "../../services/mockSwasthika"

export function SchemeResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const profile = location.state?.profile as UserProfile | undefined
  
  const [loading, setLoading] = useState(true)
  const [schemes, setSchemes] = useState<Scheme[]>([])

  useEffect(() => {
    if (!profile) {
      navigate("/schemes/questionnaire")
      return
    }

    const fetchSchemes = async () => {
      setLoading(true)
      const results = await getRecommendedSchemes(profile)
      setSchemes(results)
      setLoading(false)
    }

    fetchSchemes()
  }, [profile, navigate])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        >
          <Loader2 className="h-12 w-12 text-primary" />
        </motion.div>
        <h2 className="text-2xl font-bold mt-6">Finding support relevant to your profile...</h2>
        <p className="text-muted-foreground mt-2">Matching your details with government databases</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left Column: Profile Summary & Filters */}
        <div className="w-full md:w-1/3 space-y-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Edit Answers
          </Button>
          
          <div className="bg-muted/30 rounded-2xl p-6 border border-border">
            <h3 className="font-semibold text-lg mb-4">Your Profile</h3>
            <ul className="space-y-3 text-sm text-foreground">
              {profile?.state && <li><span className="text-muted-foreground">State:</span> {profile.state}</li>}
              {profile?.age && <li><span className="text-muted-foreground">Age:</span> {profile.age}</li>}
              {profile?.gender && <li><span className="text-muted-foreground">Gender:</span> {profile.gender}</li>}
              {profile?.disability === "Yes" && <li className="font-medium text-primary">Disability Support</li>}
              {profile?.bpl_category === "Yes" && <li className="font-medium text-primary">BPL Category</li>}
            </ul>
          </div>
          
          <div className="bg-muted/30 rounded-2xl p-6 border border-border hidden md:block">
            <div className="flex items-center gap-2 font-semibold text-lg mb-4">
              <Filter className="h-4 w-4" /> Filters
            </div>
            {/* Mock filters */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded text-primary focus:ring-primary" checked readOnly />
                <span>Recommended</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                <span>Highest Benefit</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="w-full md:w-2/3 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Your recommendations are ready.</h1>
            <p className="text-muted-foreground mt-2 text-lg">Support matched to you based on the information you shared.</p>
          </div>

          <div className="space-y-6">
            {schemes.map((scheme, i) => (
              <motion.div
                key={scheme.scheme_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2">
                        <span className="text-xs font-semibold px-2 py-1 bg-secondary text-secondary-foreground rounded-full">
                          {scheme.category}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">
                          {scheme.state}
                        </span>
                      </div>
                      
                      {scheme.relevance_score && (
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-success">
                            {Math.round(scheme.relevance_score * 100)}% Match
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <CardTitle className="text-xl leading-tight mt-2">{scheme.scheme_name}</CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-foreground">
                      <strong className="text-primary block mb-1">Why this may help you:</strong>
                      {scheme.why_recommended}
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1 rounded-full" asChild>
                        <Link to={`/schemes/${scheme.scheme_id}`}>View Details</Link>
                      </Button>
                      <Button variant="outline" size="icon" className="rounded-full">
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
