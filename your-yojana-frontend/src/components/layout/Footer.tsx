import { Link } from "react-router-dom"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-foreground">YOUR</span>
              <span className="text-primary ml-1">YOJANA</span>
            </span>
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">
              Modern Indian Citizen Services & Welfare Platform. Discover the support you are entitled to.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Services</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/schemes" className="hover:text-primary transition-colors">Welfare Schemes</Link></li>
              <li><Link to="/civic" className="hover:text-primary transition-colors">Civic Support</Link></li>
              <li><Link to="/collaboration" className="hover:text-primary transition-colors">Collaboration</Link></li>
              <li><Link to="/chat" className="hover:text-primary transition-colors">Assistant</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="#" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="#" className="hover:text-primary transition-colors">Accessibility</Link></li>
              <li><Link to="#" className="hover:text-primary transition-colors">Contact</Link></li>
              <li><Link to="#" className="hover:text-primary transition-colors">Help Center</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-foreground">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="#" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="#" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} YOUR YOJANA. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Demo Application for Hackathon</p>
        </div>
      </div>
    </footer>
  )
}
