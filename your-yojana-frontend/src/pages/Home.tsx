import { useRef, useEffect, useState } from "react"
import { motion, useScroll, useTransform, useSpring } from "framer-motion"
import { Link } from "react-router-dom"
import { Shield, HeartHandshake, Bot, FileText, ArrowRight } from "lucide-react"

export function Home() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  // Custom cursor follower
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  // Smooth out cursor movement
  const cursorX = useSpring(mousePosition.x, { stiffness: 300, damping: 30 })
  const cursorY = useSpring(mousePosition.y, { stiffness: 300, damping: 30 })

  const modules = [
    {
      title: "WELFARE SCHEMES",
      desc: "DISCOVER & APPLY.",
      icon: <FileText className="h-12 w-12" />,
      link: "/schemes",
    },
    {
      title: "CIVIC ISSUES",
      desc: "REPORT & TRACK.",
      icon: <Shield className="h-12 w-12" />,
      link: "/civic",
    },
    {
      title: "COLLABORATION",
      desc: "CONNECT & SUPPORT.",
      icon: <HeartHandshake className="h-12 w-12" />,
      link: "/collaboration",
    },
    {
      title: "ASSISTANT",
      desc: "ASK & RESOLVE.",
      icon: <Bot className="h-12 w-12" />,
      link: "/chat",
    }
  ]

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans selection:bg-foreground selection:text-background relative">
      
      {/* Custom Brutalist Cursor */}
      <motion.div
        className="fixed top-0 left-0 w-8 h-8 rounded-full border-2 border-foreground mix-blend-difference pointer-events-none z-50 flex items-center justify-center"
        style={{ x: cursorX, y: cursorY, translateX: "-50%", translateY: "-50%" }}
      >
        <div className="w-1 h-1 bg-foreground rounded-full"></div>
      </motion.div>

      {/* Centralized Portal Hub with Dot Grid Background */}
      <section 
        ref={containerRef}
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden dot-grid pt-20 pb-10"
      >
        <motion.div 
          style={{ y, opacity }}
          className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center w-full"
        >
          {/* Newspaper Masked Header */}
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="font-erode text-[5rem] md:text-[8rem] lg:text-[12rem] font-black tracking-tighter text-newspaper leading-none uppercase mb-2"
          >
            YOUR YOJANA.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-3xl font-bold tracking-widest uppercase mb-16 bg-background px-4"
          >
            CITIZEN PORTAL
          </motion.p>

          {/* DEVS Style Stats Row */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12 w-full max-w-6xl mx-auto mb-20 px-8 py-10 bg-background border-y-2 border-foreground"
          >
            <div className="flex flex-col items-center justify-center">
              <span className="font-erode text-4xl md:text-6xl font-black uppercase">4,700+</span>
              <span className="text-xs md:text-sm font-bold tracking-widest uppercase mt-2">SCHEMES</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="font-erode text-4xl md:text-6xl font-black uppercase">28+</span>
              <span className="text-xs md:text-sm font-bold tracking-widest uppercase mt-2">STATES</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="font-erode text-4xl md:text-6xl font-black uppercase">100M+</span>
              <span className="text-xs md:text-sm font-bold tracking-widest uppercase mt-2">CITIZENS</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="font-erode text-4xl md:text-6xl font-black uppercase">24/7</span>
              <span className="text-xs md:text-sm font-bold tracking-widest uppercase mt-2">SUPPORT</span>
            </div>
          </motion.div>

          {/* Minimal Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 w-full max-w-5xl mx-auto border-2 border-foreground relative bg-background">
            {modules.map((mod, index) => (
              <motion.div
                key={mod.title}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 + (index * 0.1) }}
                className="bg-background group relative overflow-hidden border border-foreground/20"
              >
                <Link to={mod.link} className="block h-full p-10 md:p-16 hover:bg-foreground hover:text-background transition-all duration-300">
                  <div className="flex flex-col h-full items-start text-left">
                    <div className="mb-8 transform group-hover:-translate-y-2 group-hover:scale-110 transition-transform duration-300">
                      {mod.icon}
                    </div>
                    
                    <h3 className="font-erode text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
                      {mod.title}
                    </h3>
                    <p className="font-bold tracking-widest uppercase text-sm opacity-80 mb-12">
                      {mod.desc}
                    </p>
                    
                    <div className="mt-auto flex items-center font-black tracking-widest uppercase text-sm">
                      ENTER <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-3 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

        </motion.div>
      </section>

      {/* Marquee Banner (DEVS Style: Solid and Hollow) */}
      <div className="border-t-2 border-foreground py-8 overflow-hidden bg-background text-foreground whitespace-nowrap flex items-center">
        <motion.div 
          animate={{ x: [0, -2000] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          className="flex font-erode text-5xl md:text-7xl font-black uppercase tracking-tighter items-center"
        >
          <span className="mx-8 hollow-text" style={{ WebkitTextStroke: "2px var(--foreground)", color: "transparent" }}>NO HIERARCHY</span>
          <span className="mx-8 font-sans text-4xl">*</span>
          <span className="mx-8">JUST CITIZENS</span>
          <span className="mx-8 font-sans text-4xl">*</span>
          <span className="mx-8 hollow-text" style={{ WebkitTextStroke: "2px var(--foreground)", color: "transparent" }}>CLAIM YOUR RIGHTS</span>
          <span className="mx-8 font-sans text-4xl">*</span>
          <span className="mx-8">REPORT ISSUES</span>
          <span className="mx-8 font-sans text-4xl">*</span>
          <span className="mx-8 hollow-text" style={{ WebkitTextStroke: "2px var(--foreground)", color: "transparent" }}>NO HIERARCHY</span>
          <span className="mx-8 font-sans text-4xl">*</span>
          <span className="mx-8">JUST CITIZENS</span>
          <span className="mx-8 font-sans text-4xl">*</span>
          <span className="mx-8 hollow-text" style={{ WebkitTextStroke: "2px var(--foreground)", color: "transparent" }}>CLAIM YOUR RIGHTS</span>
          <span className="mx-8 font-sans text-4xl">*</span>
          <span className="mx-8">REPORT ISSUES</span>
          <span className="mx-8 font-sans text-4xl">*</span>
        </motion.div>
      </div>

    </div>
  )
}
