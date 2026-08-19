import { useRef, useEffect, useState } from "react"
import { motion, useScroll, useTransform, useSpring } from "framer-motion"
import { Link } from "react-router-dom"
import { Shield, HeartHandshake, FileText, ArrowRight, LayoutDashboard } from "lucide-react"

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
      title: "RESOLUTION CONTROL",
      desc: "MANAGE & RESOLVE.",
      icon: <Shield className="h-12 w-12" />,
      link: "/gov-dashboard",
    },
    {
      title: "SCHEME ANALYTICS",
      desc: "MONITOR ACCURACY.",
      icon: <FileText className="h-12 w-12" />,
      link: "/gov-dashboard", // In GovDashboard, it handles tab query parameters or options
    },
    {
      title: "SECTOR COLLAB",
      desc: "SYNERGY OVERVIEW.",
      icon: <HeartHandshake className="h-12 w-12" />,
      link: "/gov-dashboard",
    },
    {
      title: "CITIZEN PORTAL",
      desc: "LAUNCH USER SIDE.",
      icon: <LayoutDashboard className="h-12 w-12" />,
      link: "external",
      url: "http://localhost:5173/",
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
            ADMIN PORTAL
          </motion.p>

          {/* DEVS Style Stats Row */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 max-w-4xl w-full border-y-2 border-foreground py-8 mb-16 bg-background px-4"
          >
            <div className="text-center md:border-r-2 border-foreground/20 last:border-0">
              <h3 className="text-3xl md:text-5xl font-black font-mono tracking-tighter">142+</h3>
              <p className="text-[10px] md:text-xs font-black tracking-widest uppercase text-muted-foreground mt-2">SCHEMES TRACKED</p>
            </div>
            <div className="text-center md:border-r-2 border-foreground/20 last:border-0">
              <h3 className="text-3xl md:text-5xl font-black font-mono tracking-tighter">19+</h3>
              <p className="text-[10px] md:text-xs font-black tracking-widest uppercase text-muted-foreground mt-2">ACTIVE QUEUES</p>
            </div>
            <div className="text-center md:border-r-2 border-foreground/20 last:border-0">
              <h3 className="text-3xl md:text-5xl font-black font-mono tracking-tighter">82%</h3>
              <p className="text-[10px] md:text-xs font-black tracking-widest uppercase text-muted-foreground mt-2">SECTOR SYNERGY</p>
            </div>
            <div className="text-center last:border-0">
              <h3 className="text-3xl md:text-5xl font-black font-mono tracking-tighter">24/7</h3>
              <p className="text-[10px] md:text-xs font-black tracking-widest uppercase text-muted-foreground mt-2">SLA MONITORING</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Floating background brutalist geometry */}
        <div className="absolute top-1/4 left-10 w-24 h-24 border-2 border-foreground/10 -rotate-12 pointer-events-none" />
        <div className="absolute bottom-1/4 right-10 w-36 h-36 border-2 border-foreground/10 rotate-45 pointer-events-none" />
      </section>

      {/* Grid of Interactive Modules */}
      <section className="bg-background border-t-2 border-foreground py-20 relative z-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {modules.map((m, index) => {
              const content = (
                <div className="h-full flex flex-col justify-between p-8">
                  <div>
                    <div className="mb-8">{m.icon}</div>
                    <h3 className="font-erode text-2xl font-black tracking-tight mb-2 uppercase">{m.title}</h3>
                    <p className="text-sm font-bold tracking-wider text-muted-foreground uppercase">{m.desc}</p>
                  </div>
                  <div className="mt-8 flex items-center justify-between text-xs font-black tracking-widest uppercase">
                    <span>ENTER MODULE</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform duration-300" />
                  </div>
                </div>
              )

              if (m.link === "external") {
                return (
                  <a
                    key={index}
                    href={m.url}
                    className="border-2 border-foreground aspect-square group hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all bg-card duration-300 cursor-pointer block"
                  >
                    {content}
                  </a>
                )
              }

              return (
                <Link
                  key={index}
                  to={m.link}
                  className="border-2 border-foreground aspect-square group hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all bg-card duration-300 cursor-pointer block"
                >
                  {content}
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
export default Home
