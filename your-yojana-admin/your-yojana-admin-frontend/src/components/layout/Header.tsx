import { useState } from "react"
import { Link } from "react-router-dom"
import { Search, Menu, Globe, Accessibility, User as UserIcon } from "lucide-react"
import { Button } from "../ui/Button"
import { ThemeToggle } from "../ui/ThemeToggle"
import { LoginModal } from "../LoginModal"
import { useUser } from "../../hooks/useUser"

export function Header() {
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const { user, logout } = useUser()

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center space-x-2">
              <span className="font-erode text-2xl font-black tracking-tighter uppercase flex items-center gap-2">
                YOUR YOJANA. <span className="text-[10px] bg-foreground text-background px-1.5 py-0.5 rounded font-mono font-bold tracking-widest">ADMIN</span>
              </span>
            </Link>
          </div>

          {/* Center: Search (Hidden on Mobile) */}
          <div className="hidden md:flex flex-1 max-w-md mx-6 relative">
            <div className="relative w-full group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full h-10 pl-10 pr-4 border border-border bg-card text-sm focus:outline-none focus:ring-0 focus:border-foreground transition-all uppercase tracking-widest placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            
            <Button variant="ghost" size="icon" className="hidden md:flex rounded-none" aria-label="Language">
              <Globe className="h-5 w-5" />
            </Button>
            
            <Button variant="ghost" size="icon" className="hidden md:flex rounded-none" aria-label="Accessibility">
              <Accessibility className="h-5 w-5" />
            </Button>

            <Link to="/gov-dashboard" className="hidden md:block">
              <Button variant="outline" className="font-bold tracking-widest uppercase rounded-none text-xs h-9 px-3 mr-2">
                CONTROL CENTER
              </Button>
            </Link>

            <ThemeToggle />

            {user ? (
              <div className="hidden md:flex items-center gap-2 ml-2">
                <Link to="/dashboard">
                  <Button variant="ghost" className="font-bold tracking-widest uppercase rounded-none">
                    <UserIcon className="h-4 w-4 mr-2" />
                    {user.name}
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={logout} className="rounded-none font-bold tracking-widest uppercase">
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button 
                variant="default" 
                className="hidden md:flex px-6 rounded-none font-bold tracking-widest uppercase"
                onClick={() => setIsLoginOpen(true)}
              >
                Sign In
              </Button>
            )}

            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
            </Button>

          </div>
        </div>
      </header>
      
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  )
}
