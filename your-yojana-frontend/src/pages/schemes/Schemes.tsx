import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "../../components/ui/Button"

export function Schemes() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-background dot-grid relative overflow-hidden">
      
      {/* Brutalist Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto px-4 z-10 flex flex-col items-center text-center w-full max-w-5xl pt-12 pb-24 bg-background border-2 border-foreground shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] dark:shadow-[16px_16px_0px_0px_rgba(255,255,255,1)]"
      >
        <div className="space-y-6 mb-16 mt-16 px-4">
          <h1 className="font-erode text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter uppercase leading-none">
            CLAIM YOUR <br/> <span className="text-newspaper" style={{ WebkitTextStroke: "2px var(--foreground)" }}>RIGHTS.</span>
          </h1>
          <p className="text-xl md:text-2xl font-bold tracking-widest uppercase max-w-2xl mx-auto">
            ANSWER A FEW QUESTIONS. DISCOVER GOVERNMENT SUPPORT YOU DESERVE.
          </p>
        </div>

        <Button 
          size="lg" 
          className="rounded-none text-2xl md:text-4xl px-12 py-10 h-auto font-black tracking-widest uppercase border-4 border-foreground hover:bg-transparent hover:text-foreground hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] transition-all asChild"
        >
          <Link to="/schemes/questionnaire">
            START SEARCH <ArrowRight className="ml-4 h-8 w-8" />
          </Link>
        </Button>
      </motion.div>

      {/* Marquee Banner */}
      <div className="absolute bottom-0 w-full border-t-2 border-foreground py-6 overflow-hidden bg-foreground text-background whitespace-nowrap flex items-center z-0">
        <motion.div 
          animate={{ x: [0, -2000] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          className="flex font-erode text-4xl font-black uppercase tracking-tighter items-center"
        >
          <span className="mx-8">NO HIDDEN CRITERIA</span>
          <span className="mx-8 font-sans text-2xl">*</span>
          <span className="mx-8 hollow-text" style={{ WebkitTextStroke: "1px var(--background)", color: "transparent" }}>100% TRANSPARENT</span>
          <span className="mx-8 font-sans text-2xl">*</span>
          <span className="mx-8">NO HIDDEN CRITERIA</span>
          <span className="mx-8 font-sans text-2xl">*</span>
          <span className="mx-8 hollow-text" style={{ WebkitTextStroke: "1px var(--background)", color: "transparent" }}>100% TRANSPARENT</span>
          <span className="mx-8 font-sans text-2xl">*</span>
          <span className="mx-8">NO HIDDEN CRITERIA</span>
          <span className="mx-8 font-sans text-2xl">*</span>
          <span className="mx-8 hollow-text" style={{ WebkitTextStroke: "1px var(--background)", color: "transparent" }}>100% TRANSPARENT</span>
          <span className="mx-8 font-sans text-2xl">*</span>
          <span className="mx-8">NO HIDDEN CRITERIA</span>
          <span className="mx-8 font-sans text-2xl">*</span>
          <span className="mx-8 hollow-text" style={{ WebkitTextStroke: "1px var(--background)", color: "transparent" }}>100% TRANSPARENT</span>
          <span className="mx-8 font-sans text-2xl">*</span>
        </motion.div>
      </div>
    </div>
  )
}
