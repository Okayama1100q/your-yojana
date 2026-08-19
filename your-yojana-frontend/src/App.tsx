import { Routes, Route } from "react-router-dom"
import { Header } from "./components/layout/Header"
import { Footer } from "./components/layout/Footer"
import { Home } from "./pages/Home"
import { Schemes } from "./pages/schemes/Schemes"
import { SchemeQuestionnaire } from "./pages/schemes/SchemeQuestionnaire"
import { SchemeResults } from "./pages/schemes/SchemeResults"
import { SchemeDetails } from "./pages/schemes/SchemeDetails"
import { Dashboard } from "./pages/Dashboard"
import { Enrollment } from "./pages/Enrollment"
import { CivicIssues } from "./pages/CivicIssues"
import { GovDashboard } from "./pages/GovDashboard"
import { Chatbot } from "./components/Chatbot"


const Collaboration = () => (
  <div className="container mx-auto px-4 py-16 text-center max-w-2xl min-h-[60vh]">
    <h1 className="text-4xl font-bold mb-4">Cross-Sector Collaboration</h1>
    <p className="text-xl text-muted-foreground mb-8">Connect with NGOs, CSR organizations and community groups.</p>
    <div className="bg-card border border-border p-8 rounded-2xl shadow-sm">
      <div className="h-16 w-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mx-auto mb-4 text-2xl">🤝</div>
      <h2 className="text-2xl font-semibold mb-2">Module Under Development</h2>
      <p className="text-muted-foreground">The SETU connection platform is currently being integrated.</p>
    </div>
  </div>
)

const Chat = () => (
  <div className="container mx-auto px-4 py-16 text-center max-w-2xl min-h-[60vh]">
    <h1 className="text-4xl font-bold mb-4">Your Yojana Assistant</h1>
    <p className="text-xl text-muted-foreground mb-8">Full screen chat interface.</p>
    <div className="bg-card border border-border p-8 rounded-2xl shadow-sm">
      <div className="h-16 w-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mx-auto mb-4 text-2xl">💬</div>
      <h2 className="text-2xl font-semibold mb-2">Use the floating assistant</h2>
      <p className="text-muted-foreground">Please use the floating chat button in the bottom right corner for now.</p>
    </div>
  </div>
)

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/schemes" element={<Schemes />} />
          <Route path="/schemes/questionnaire" element={<SchemeQuestionnaire />} />
          <Route path="/schemes/results" element={<SchemeResults />} />
          <Route path="/schemes/:schemeId" element={<SchemeDetails />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/enrollment/:enrollmentId" element={<Enrollment />} />
          <Route path="/civic" element={<CivicIssues />} />
          <Route path="/gov-dashboard" element={<GovDashboard />} />
          <Route path="/collaboration" element={<Collaboration />} />
          <Route path="/chat" element={<Chat />} />
        </Routes>
      </main>
      <Chatbot />
      <Footer />
    </div>
  )
}

export default App
