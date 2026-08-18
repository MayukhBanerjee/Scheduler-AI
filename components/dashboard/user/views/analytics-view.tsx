"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Clock,
  CheckCircle,
  Bot,
  TrendingUp,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react"
import Link from "next/link"
import { BookingRow } from "../types"

interface AnalyticsViewProps {
  bookings: BookingRow[]
  onBookNow?: () => void
}

export function AnalyticsView({ bookings }: AnalyticsViewProps) {
  const [timeRange, setTimeRange] = useState("Last 30 Days")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; label: string } | null>(null)
  const [showAssistantTooltip, setShowAssistantTooltip] = useState(true)

  const timeRangeOptions = ["Last 7 Days", "Last 30 Days", "Last 3 Months", "This Year"]

  // Calculate dynamic metrics based on real bookings if available, else standard benchmarks
  const totalBookingsCount = Math.max(bookings.length, 14)
  const estimatedHoursSaved = (totalBookingsCount * 1.03).toFixed(1)

  // 600x180 Coordinate Grid Points
  const trendPoints = [
    { x: 0, y: 130, val: 14, label: "Day 1" },
    { x: 60, y: 110, val: 18, label: "Day 4" },
    { x: 120, y: 150, val: 10, label: "Day 7" },
    { x: 180, y: 90, val: 24, label: "Day 10" },
    { x: 240, y: 100, val: 22, label: "Day 14" },
    { x: 300, y: 45, val: 34, label: "Day 18" },
    { x: 360, y: 65, val: 29, label: "Day 21" },
    { x: 420, y: 25, val: 40, label: "Day 24" },
    { x: 480, y: 55, val: 32, label: "Day 27" },
    { x: 540, y: 15, val: 44, label: "Day 29" },
    { x: 600, y: 35, val: 38, label: "Day 30" },
  ]

  const linePathD =
    "M 0,130 L 60,110 L 120,150 L 180,90 L 240,100 L 300,45 L 360,65 L 420,25 L 480,55 L 540,15 L 600,35"
  const areaPolygonPoints =
    "0,180 0,130 60,110 120,150 180,90 240,100 300,45 360,65 420,25 480,55 540,15 600,35 600,180"

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative space-y-3.5 overflow-hidden">
      {/* ─── 1. Page Header ─────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
            Intelligence Overview
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium">
            Your automated scheduling performance for this month.
          </p>
        </div>

        {/* Time Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="glass-card px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-white/90 dark:hover:bg-stone-800 transition-colors shadow-2xs border border-orange-100/80 dark:border-stone-800 cursor-pointer"
          >
            <span>{timeRange}</span>
            <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                className="absolute right-0 mt-1 w-36 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-orange-100 dark:border-stone-800 p-1 z-50"
              >
                {timeRangeOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setTimeRange(opt)
                      setDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                      timeRange === opt
                        ? "bg-orange-100/60 text-[#b02f00] dark:bg-stone-800 dark:text-orange-400"
                        : "text-stone-700 dark:text-stone-300 hover:bg-orange-50 dark:hover:bg-stone-800/60"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ─── 2. KPI Summary Bento Grid (3 Cards) ────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5 shrink-0">
        {/* KPI 1: Time Saved */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="glass-card rounded-2xl p-4 sm:p-5 relative overflow-hidden bg-white/75 dark:bg-stone-900/75 border border-white/60 dark:border-stone-800 shadow-2xs"
        >
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-orange-500/15 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center gap-2.5 mb-2 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center text-[#b02f00] dark:text-orange-400 shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400">
              Total Time Saved
            </h3>
          </div>

          <div className="relative z-10">
            <div className="text-2xl sm:text-3xl leading-tight font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
              {estimatedHoursSaved}
              <span className="text-sm sm:text-base text-stone-500 dark:text-stone-400 font-medium ml-1">
                hrs
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] mt-1.5 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/50 w-fit px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
              <TrendingUp className="h-3 w-3" />
              <span>+2.4 hrs vs last month</span>
            </div>
          </div>
        </motion.div>

        {/* KPI 2: Completion Rate */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="glass-card rounded-2xl p-4 sm:p-5 relative overflow-hidden bg-white/75 dark:bg-stone-900/75 border border-white/60 dark:border-stone-800 shadow-2xs"
        >
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-stone-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center gap-2.5 mb-2 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-stone-200/60 dark:bg-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300 shrink-0">
              <CheckCircle className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400">
              Booking Completion
            </h3>
          </div>

          <div className="relative z-10">
            <div className="text-2xl sm:text-3xl leading-tight font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
              98
              <span className="text-sm sm:text-base text-stone-500 dark:text-stone-400 font-medium ml-1">
                %
              </span>
            </div>
            <div className="flex items-center text-[11px] mt-1.5 font-bold text-stone-700 dark:text-stone-300 bg-orange-100/50 dark:bg-stone-800 w-fit px-2.5 py-0.5 rounded-full border border-orange-200/50 dark:border-stone-700">
              <span>Optimal performance</span>
            </div>
          </div>
        </motion.div>

        {/* KPI 3: AI Reschedules */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="glass-card rounded-2xl p-4 sm:p-5 relative overflow-hidden bg-white/75 dark:bg-stone-900/75 border border-white/60 dark:border-stone-800 shadow-2xs"
        >
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-orange-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center text-[#b02f00] dark:text-orange-400 shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400">
                AI Reschedules
              </h3>
            </div>

            {/* AI Auto Chip */}
            <span className="px-2 py-0.5 bg-orange-100/70 dark:bg-orange-950/60 border border-orange-200/60 dark:border-orange-800 text-[#b02f00] dark:text-orange-400 rounded-full font-bold text-[9px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#ff5722] rounded-full animate-pulse" />
              Auto
            </span>
          </div>

          <div className="relative z-10">
            <div className="text-2xl sm:text-3xl leading-tight font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
              12
            </div>
            <div className="flex items-center text-[11px] mt-1.5 font-bold text-stone-700 dark:text-stone-300 bg-orange-100/50 dark:bg-stone-800 w-fit px-2.5 py-0.5 rounded-full border border-orange-200/50 dark:border-stone-700">
              <span>Conflicts resolved seamlessly</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── 3. Interactive Charts Grid (2 Columns: Area + Donut) ───────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 flex-1 min-h-0 overflow-hidden">
        {/* Area Chart: Booking Trends (lg:col-span-2) */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 lg:col-span-2 flex flex-col justify-between relative overflow-hidden bg-white/80 dark:bg-stone-900/80 border border-white/60 dark:border-stone-800 shadow-2xs">
          <div className="flex justify-between items-start mb-2 z-10 relative">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Booking Trends
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Volume over the last 30 days
              </p>
            </div>
            <button className="p-1 rounded-full hover:bg-orange-100/50 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* SVG Area Chart Container */}
          <div className="flex-1 w-full min-h-[140px] max-h-[190px] relative z-10 flex items-end">
            {/* Y-Axis Labels */}
            <div className="absolute left-0 top-0 bottom-5 w-6 flex flex-col justify-between text-[10px] font-semibold text-stone-400">
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>

            {/* Dashed Grid Lines */}
            <div className="absolute left-7 right-0 top-2 bottom-5 flex flex-col justify-between z-0 pointer-events-none">
              <div className="w-full border-t border-dashed border-stone-200 dark:border-stone-800" />
              <div className="w-full border-t border-dashed border-stone-200 dark:border-stone-800" />
              <div className="w-full border-t border-dashed border-stone-200 dark:border-stone-800" />
            </div>

            {/* SVG Area & Stroke Path */}
            <div className="relative w-full h-[calc(100%-1.25rem)] ml-7 z-10 flex items-end">
              <svg
                className="w-full h-full"
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff5722" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ff5722" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Fill Area */}
                <polygon
                  points={areaPolygonPoints}
                  fill="url(#trendGradient)"
                />

                {/* Line Path */}
                <path
                  d={linePathD}
                  fill="none"
                  stroke="#ff5722"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points */}
                {trendPoints.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#ffffff"
                    stroke="#ff5722"
                    strokeWidth="2.5"
                    className="cursor-pointer hover:r-5 transition-all"
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </svg>

              {/* Hover Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute bg-stone-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md pointer-events-none -translate-x-1/2 -translate-y-7"
                  style={{
                    left: `${(hoveredPoint.x / 600) * 100}%`,
                    top: `${(hoveredPoint.y / 180) * 100}%`,
                  }}
                >
                  {hoveredPoint.val} bookings
                </div>
              )}
            </div>

            {/* X-Axis Labels */}
            <div className="absolute bottom-0 left-7 right-0 flex justify-between text-[10px] font-semibold text-stone-400">
              <span>W1</span>
              <span>W2</span>
              <span>W3</span>
              <span>W4</span>
            </div>
          </div>
        </div>

        {/* Donut Chart: Services by Category (lg:col-span-1) */}
        <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden bg-white/80 dark:bg-stone-900/80 border border-white/60 dark:border-stone-800 shadow-2xs">
          <div className="z-10 relative">
            <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
              Services
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              By category
            </p>
          </div>

          {/* Donut Implementation */}
          <div className="flex items-center justify-center my-2 relative z-10">
            <div
              className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-inner"
              style={{
                background: "conic-gradient(#ff5722 0% 45%, #b02f00 45% 75%, #f7e5d7 75% 100%)",
              }}
            >
              <div className="w-18 h-18 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-full flex flex-col items-center justify-center shadow-xs">
                <span className="text-lg font-extrabold text-stone-900 dark:text-stone-100 leading-tight">
                  142
                </span>
                <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                  Total
                </span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full flex flex-col gap-1.5 pt-2 border-t border-orange-100/60 dark:border-stone-800">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ff5722]" />
                <span className="text-stone-800 dark:text-stone-200">Consultations</span>
              </div>
              <span className="text-stone-500 font-bold">45%</span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#b02f00]" />
                <span className="text-stone-800 dark:text-stone-200">Follow-ups</span>
              </div>
              <span className="text-stone-500 font-bold">30%</span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f7e5d7] border border-orange-200 dark:border-stone-700" />
                <span className="text-stone-800 dark:text-stone-200">Reviews</span>
              </div>
              <span className="text-stone-500 font-bold">25%</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. Persistent Floating AI Assistant & FAB ──────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50 flex items-end justify-end gap-2.5 pointer-events-none">
        {/* Message Tooltip */}
        <AnimatePresence>
          {showAssistantTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="glass-card rounded-2xl p-2.5 shadow-2xl bg-white/95 dark:bg-stone-900/95 border border-orange-200/70 dark:border-stone-700 max-w-[200px] pointer-events-auto backdrop-blur-md"
            >
              <p className="text-[11px] font-semibold text-stone-800 dark:text-stone-200 leading-snug">
                &ldquo;I optimized 3 meetings today, saving you 45 minutes.&rdquo;
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB Bubble */}
        <Link
          href="/dashboard/user"
          onMouseEnter={() => setShowAssistantTooltip(true)}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white flex items-center justify-center shadow-[0_8px_25px_rgba(255,87,34,0.3)] hover:shadow-[0_12px_35px_rgba(255,87,34,0.4)] pointer-events-auto hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Bot className="h-5 w-5" />
        </Link>
      </div>
    </div>
  )
}
