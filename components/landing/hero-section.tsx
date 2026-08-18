"use client"

import { motion } from "framer-motion"
import { Sparkles, ArrowRight, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedCounter } from "@/components/animated-counter"
import { HeroDashboardPreview } from "./hero-dashboard-preview"

interface HeroSectionProps {
  onOpenAuth: (action: "login" | "register") => void
}

export function HeroSection({ onOpenAuth }: HeroSectionProps) {
  const scrollToFeatures = () => {
    const el = document.getElementById("features")
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <section className="wavy-bg pt-28 pb-32 md:pb-44 px-4 sm:px-8 md:px-12 relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative z-10">
        {/* Left Column: Copy & CTAs */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="space-y-7 text-left"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/85 dark:bg-stone-900/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-orange-200/60 dark:border-stone-700 text-[#b02f00] dark:text-orange-400 font-bold text-xs shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#ff5722]" />
            AI-Powered Scheduling
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-stone-900 dark:text-stone-50 leading-[1.15] tracking-tight">
            Schedule Smarter with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b02f00] via-[#ff5722] to-[#e64a19]">
              AI-Powered
            </span>{" "}
            Conversations
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed">
            Transform booking with conversational AI and optional voice input. Verified availability and real-time sync—no more physical verification waste.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Button
              size="lg"
              onClick={() => onOpenAuth("register")}
              className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white px-8 py-6 rounded-full font-bold text-base shadow-[0_10px_25px_rgba(255,87,34,0.35)] hover:shadow-[0_12px_30px_rgba(255,87,34,0.45)] transition-all flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={scrollToFeatures}
              className="glass-panel bg-white/70 dark:bg-stone-900/70 hover:bg-white/90 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-100 border-orange-200/60 dark:border-stone-700 px-8 py-6 rounded-full font-semibold text-base transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              <PlayCircle className="h-4 w-4 text-[#b02f00]" />
              Watch Demo
            </Button>
          </div>

          {/* Metrics Stats Row */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-orange-200/50 dark:border-stone-800 mt-6">
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#b02f00] dark:text-orange-400 tracking-tight">
                <AnimatedCounter value={10000} suffix="+" />
              </p>
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">Happy Users</p>
            </div>

            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#b02f00] dark:text-orange-400 tracking-tight">
                <AnimatedCounter value={50000} suffix="+" />
              </p>
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">Appointments Booked</p>
            </div>

            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#b02f00] dark:text-orange-400 tracking-tight">
                <AnimatedCounter value={99} suffix="%" />
              </p>
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">Uptime</p>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Interactive Frosted Glass Graphic */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="hidden md:block w-full"
        >
          <HeroDashboardPreview />
        </motion.div>
      </div>

      {/* Organic Bottom Wave Transition SVG */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 pointer-events-none">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="relative block w-full h-16 sm:h-24 md:h-28 text-[#fff8f4] dark:text-stone-950 fill-current"
        >
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C73.23,34.7,147.2,64.21,224.23,65.87,256.76,66.58,289.44,62.33,321.39,56.44Z" />
        </svg>
      </div>
    </section>
  )
}
