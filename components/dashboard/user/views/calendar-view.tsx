"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar as CalendarIcon,
  SlidersHorizontal,
  Plus,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Bot,
  User,
  Building2,
  CheckCircle,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"

interface CalendarViewProps {
  calendarKey?: number
  onNewEvent?: () => void
  onResolveConflict?: (prompt: string) => void
}

interface RawCalendarBooking {
  id: string
  service_name: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm" or "HH:mm:ss"
  duration_minutes: number
  price?: number
  status?: string
  location?: string | null
  provider_name?: string | null
}

interface ComputedCalendarEvent {
  id: string
  title: string
  date: string
  dayIndex: number // 0 = Mon, ..., 6 = Sun
  startMinutes: number
  endMinutes: number
  topPx: number
  heightPx: number
  type: "ai-managed" | "conflict" | "standard"
  timeLabel: string
  providerName: string
  location?: string
  price: number
  status: string
  hasConflict: boolean
}

// 13 hourly intervals from 8 AM to 8 PM (96px per hour)
const START_HOUR = 8
const END_HOUR = 20
const HOUR_HEIGHT = 96
const TIME_SLOTS = [
  "8 AM", "9 AM", "10 AM", "11 AM", "12 PM",
  "1 PM", "2 PM", "3 PM", "4 PM", "5 PM",
  "6 PM", "7 PM", "8 PM",
]

function formatWeekRange(startDate: Date, endDate: Date) {
  const startMonth = startDate.toLocaleDateString("en-US", { month: "short" })
  const endMonth = endDate.toLocaleDateString("en-US", { month: "short" })
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  if (startYear !== endYear) {
    return `${startMonth} ${startDate.getDate()}, ${startYear} – ${endMonth} ${endDate.getDate()}, ${endYear}`
  }
  if (startMonth === endMonth) {
    return `${startDate.toLocaleDateString("en-US", { month: "long" })} ${startDate.getDate()} – ${endDate.getDate()}, ${startYear}`
  }
  return `${startMonth} ${startDate.getDate()} – ${endMonth} ${endDate.getDate()}, ${startYear}`
}

function normalizeTime(timeStr: string) {
  if (!timeStr) return { hour: 10, minute: 0 }
  const clean = timeStr.trim()
  const isPM = clean.toLowerCase().includes("pm")
  const isAM = clean.toLowerCase().includes("am")
  const stripped = clean.replace(/(am|pm)/i, "").trim()
  const [hStr, mStr] = stripped.split(":")
  let hour = parseInt(hStr, 10) || 10
  const minute = parseInt(mStr, 10) || 0
  if (isPM && hour < 12) hour += 12
  if (isAM && hour === 12) hour = 0
  return { hour, minute }
}

function formatTimeDisplay(hour: number, minute: number) {
  const period = hour >= 12 ? "PM" : "AM"
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const mStr = String(minute).padStart(2, "0")
  return `${h12}:${mStr} ${period}`
}

export function CalendarView({
  calendarKey = 0,
  onNewEvent,
  onResolveConflict,
}: CalendarViewProps) {
  const router = useRouter()
  const [weekOffsetDate, setWeekOffsetDate] = useState<Date>(new Date())
  const [filterType, setFilterType] = useState<"all" | "ai" | "conflicts">("all")
  const [selectedEvent, setSelectedEvent] = useState<ComputedCalendarEvent | null>(null)
  const [aiBubbleVisible, setAiBubbleVisible] = useState(true)
  const [rawBookings, setRawBookings] = useState<RawCalendarBooking[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // ─── 1. Calculate the 7 Days of the Displayed Week ─────────────────────────
  const weekDays = useMemo(() => {
    const monday = new Date(weekOffsetDate)
    const dayOfWeek = (monday.getDay() + 6) % 7 // Monday = 0, Sunday = 6
    monday.setDate(monday.getDate() - dayOfWeek)
    monday.setHours(0, 0, 0, 0)

    const todayStr = new Date().toISOString().split("T")[0]

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = d.toISOString().split("T")[0]
      return {
        date: d,
        dateStr,
        name: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
        full: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i],
        dateNum: d.getDate(),
        isToday: dateStr === todayStr,
        isWeekend: i >= 5,
      }
    })
  }, [weekOffsetDate])

  const weekStartDate = weekDays[0].date
  const weekEndDate = weekDays[6].date

  // ─── 2. Fetch Real Bookings from API ───────────────────────────────────────
  const fetchWeekEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const startStr = weekDays[0].dateStr
      const endStr = weekDays[6].dateStr
      const res = await fetch(`/api/calendar/user?startDate=${startStr}&endDate=${endStr}`)
      if (res.ok) {
        const data = await res.json()
        setRawBookings(data.events || [])
      } else {
        // Fallback to /api/bookings
        const bRes = await fetch("/api/bookings")
        if (bRes.ok) {
          const bData = await bRes.json()
          setRawBookings(bData.bookings || [])
        }
      }
    } catch (err) {
      console.error("Failed to fetch user calendar events:", err)
    } finally {
      setIsLoading(false)
    }
  }, [weekDays])

  useEffect(() => {
    fetchWeekEvents()
  }, [fetchWeekEvents, calendarKey])

  // ─── 3. Process & Map Real Bookings to Weekly Grid Coordinates ─────────────
  const computedEvents = useMemo(() => {
    const eventsThisWeek: ComputedCalendarEvent[] = []
    const weekDateMap = new Map<string, number>()
    weekDays.forEach((d, idx) => weekDateMap.set(d.dateStr, idx))

    // Step A: Parse and map bookings belonging to this week
    for (const b of rawBookings) {
      if (!b.date || !weekDateMap.has(b.date)) continue
      const dayIndex = weekDateMap.get(b.date)!

      const { hour, minute } = normalizeTime(b.time)
      const durationMin = b.duration_minutes || 60
      const startMinutes = hour * 60 + minute
      const endMinutes = startMinutes + durationMin

      // Clamp between grid start (8 AM) and end (8 PM)
      const clampedStartMinutes = Math.max(START_HOUR * 60, startMinutes)
      const topMinutesFromBase = Math.max(0, clampedStartMinutes - START_HOUR * 60)
      const topPx = (topMinutesFromBase / 60) * HOUR_HEIGHT
      const heightPx = Math.max(52, (durationMin / 60) * HOUR_HEIGHT)

      const endH = Math.floor(endMinutes / 60)
      const endM = endMinutes % 60

      eventsThisWeek.push({
        id: b.id,
        title: b.service_name || "Appointment",
        date: b.date,
        dayIndex,
        startMinutes,
        endMinutes,
        topPx,
        heightPx,
        type: "ai-managed",
        timeLabel: `${formatTimeDisplay(hour, minute)} – ${formatTimeDisplay(endH, endM)}`,
        providerName: b.provider_name || "ScheduleAI Provider",
        location: b.location || undefined,
        price: b.price || 0,
        status: b.status || "confirmed",
        hasConflict: false,
      })
    }

    // Step B: Real Conflict Overlap Detection
    for (let i = 0; i < eventsThisWeek.length; i++) {
      for (let j = i + 1; j < eventsThisWeek.length; j++) {
        const e1 = eventsThisWeek[i]
        const e2 = eventsThisWeek[j]
        if (e1.dayIndex === e2.dayIndex) {
          // Check overlap condition: start1 < end2 && start2 < end1
          if (e1.startMinutes < e2.endMinutes && e2.startMinutes < e1.endMinutes) {
            e1.hasConflict = true
            e2.hasConflict = true
            e1.type = "conflict"
            e2.type = "conflict"
          }
        }
      }
    }

    return eventsThisWeek
  }, [rawBookings, weekDays])

  // Filter events by selected category
  const filteredEvents = useMemo(() => {
    if (filterType === "ai") return computedEvents.filter((e) => e.type === "ai-managed")
    if (filterType === "conflicts") return computedEvents.filter((e) => e.hasConflict)
    return computedEvents
  }, [computedEvents, filterType])

  // Detect first conflict for the floating assistant
  const detectedConflict = useMemo(() => {
    const conflictEvent = computedEvents.find((e) => e.hasConflict)
    if (!conflictEvent) return null
    const dayName = weekDays[conflictEvent.dayIndex]?.full || "the week"
    return {
      event: conflictEvent,
      message: `I noticed an overlapping booking on ${dayName} at ${conflictEvent.timeLabel.split("–")[0].trim()}. Resolve?`,
    }
  }, [computedEvents, weekDays])

  // Dynamic timezone label
  const timeZoneLabel = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const offsetMin = -new Date().getTimezoneOffset()
      const sign = offsetMin >= 0 ? "+" : "-"
      const hours = Math.floor(Math.abs(offsetMin) / 60)
      const mins = Math.abs(offsetMin) % 60
      const offsetStr = `GMT${sign}${hours}${mins ? `:${mins}` : ""}`
      return `${offsetStr}`
    } catch {
      return "GMT"
    }
  }, [])

  // Real-time current time indicator
  const currentTimeIndicator = useMemo(() => {
    const now = new Date()
    const nowHour = now.getHours()
    const nowMin = now.getMinutes()
    if (nowHour < START_HOUR || nowHour > END_HOUR) return null
    const minutesFromBase = (nowHour - START_HOUR) * 60 + nowMin
    const topPx = (minutesFromBase / 60) * HOUR_HEIGHT
    return topPx
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative space-y-4 pb-20">
      {/* ─── Top Header Section ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2">
            Weekly View
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-[#ff5722]" />
              {formatWeekRange(weekStartDate, weekEndDate)}
            </p>

            {/* Week navigation buttons */}
            <div className="flex items-center gap-1 bg-white/70 dark:bg-stone-900/70 border border-orange-200/60 dark:border-stone-800 rounded-lg p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded-md"
                onClick={() => {
                  const prev = new Date(weekOffsetDate)
                  prev.setDate(prev.getDate() - 7)
                  setWeekOffsetDate(prev)
                }}
                title="Previous Week"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                onClick={() => setWeekOffsetDate(new Date())}
              >
                Today
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded-md"
                onClick={() => {
                  const next = new Date(weekOffsetDate)
                  next.setDate(next.getDate() + 7)
                  setWeekOffsetDate(next)
                }}
                title="Next Week"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {isLoading && (
              <RefreshCw className="h-3.5 w-3.5 text-orange-500 animate-spin ml-1" />
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Filters Toggle Button */}
          <div className="flex items-center bg-white/70 dark:bg-stone-900/70 backdrop-blur-md rounded-full p-1 border border-orange-200/60 dark:border-stone-800 shadow-2xs">
            <button
              onClick={() =>
                setFilterType(
                  filterType === "all"
                    ? "ai"
                    : filterType === "ai"
                    ? "conflicts"
                    : "all"
                )
              }
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-stone-700 dark:text-stone-300 hover:text-[#b02f00] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-stone-500" />
              <span>
                Filters:{" "}
                <strong className="capitalize text-[#b02f00] dark:text-orange-400">
                  {filterType}
                </strong>
              </span>
            </button>
          </div>

          {/* New Event Button */}
          <Button
            onClick={onNewEvent}
            className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white rounded-full font-bold text-xs px-5 py-2 shadow-[0_8px_24px_rgba(255,87,34,0.25)] flex items-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>

      {/* ─── Main Weekly Grid Container ────────────────────────────────────── */}
      <div className="glass-card rounded-2xl flex-1 flex flex-col overflow-hidden shadow-lg border border-white/60 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl relative min-h-[560px]">
        {/* Days Header Bar (8 Columns) */}
        <div className="grid grid-cols-8 border-b border-orange-100 dark:border-stone-800 bg-white/50 dark:bg-stone-950/50 backdrop-blur-md shrink-0 sticky top-0 z-20">
          {/* Timezone Indicator */}
          <div className="p-3 sm:p-4 border-r border-orange-100 dark:border-stone-800 flex items-center justify-center">
            <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider">
              {timeZoneLabel}
            </span>
          </div>

          {/* 7 Days Columns */}
          {weekDays.map((day, idx) => (
            <div
              key={day.dateStr}
              className={`p-3 sm:p-4 text-center flex flex-col items-center justify-center transition-colors cursor-pointer ${
                idx < 6 ? "border-r border-orange-100 dark:border-stone-800" : ""
              } ${
                day.isToday
                  ? "bg-orange-500/10 dark:bg-orange-500/15"
                  : "hover:bg-orange-50/50 dark:hover:bg-stone-800/40"
              } ${day.isWeekend ? "opacity-75" : ""}`}
            >
              <span
                className={`text-[11px] uppercase font-bold mb-1 ${
                  day.isToday
                    ? "text-[#b02f00] dark:text-orange-400 font-extrabold"
                    : "text-stone-500"
                }`}
              >
                {day.name}
              </span>
              <span
                className={`text-sm sm:text-base font-extrabold flex items-center justify-center transition-all ${
                  day.isToday
                    ? "bg-gradient-to-tr from-[#b02f00] to-[#ff5722] text-white rounded-full w-8 h-8 sm:w-9 sm:h-9 shadow-sm"
                    : "text-stone-900 dark:text-stone-100"
                }`}
              >
                {day.dateNum}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable Calendar Grid (8 Columns) */}
        <div className="flex-1 overflow-y-auto bg-orange-50/20 dark:bg-stone-950/20 min-h-0 relative">
          <div className="grid grid-cols-8 relative min-h-[1248px]">
            {/* Time Slots Labels (Column 1) */}
            <div className="border-r border-orange-100 dark:border-stone-800 relative z-10 bg-white/30 dark:bg-stone-900/30 backdrop-blur-xs">
              {TIME_SLOTS.map((time) => (
                <div
                  key={time}
                  className="h-24 border-b border-orange-100/50 dark:border-stone-800/50 relative"
                >
                  <span className="absolute top-2 right-2 text-[11px] font-bold text-stone-400 dark:text-stone-500">
                    {time}
                  </span>
                </div>
              ))}
            </div>

            {/* 7 Days Columns Content (Columns 2-8) */}
            {weekDays.map((day, dIdx) => (
              <div
                key={day.dateStr}
                className={`relative ${
                  dIdx < 6 ? "border-r border-orange-100/40 dark:border-stone-800/40" : ""
                } ${day.isToday ? "bg-orange-500/5 dark:bg-orange-500/5" : ""} ${
                  day.isWeekend ? "bg-stone-50/30 dark:bg-stone-900/20" : ""
                }`}
              >
                {/* Time slot grid guidelines */}
                {TIME_SLOTS.map((time) => (
                  <div
                    key={time}
                    className="h-24 border-b border-orange-100/30 dark:border-stone-800/30"
                  />
                ))}

                {/* Current Time Indicator Line for Today */}
                {day.isToday && currentTimeIndicator !== null && (
                  <div
                    style={{ top: `${currentTimeIndicator}px` }}
                    className="absolute left-0 w-full z-20 flex items-center pointer-events-none"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5722] -ml-1.5 shadow-[0_0_8px_rgba(255,87,34,0.8)]" />
                    <div className="h-[2px] bg-gradient-to-r from-[#ff5722] to-transparent w-full shadow-[0_0_8px_rgba(255,87,34,0.6)]" />
                  </div>
                )}

                {/* Real Events for this specific Day */}
                {filteredEvents
                  .filter((e) => e.dayIndex === dIdx)
                  .map((evt) => {
                    const isConflict = evt.hasConflict

                    return (
                      <motion.div
                        key={evt.id}
                        style={{ top: `${evt.topPx}px`, height: `${evt.heightPx}px` }}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setSelectedEvent(evt)}
                        className={`absolute left-1 right-1 rounded-xl p-2.5 shadow-sm backdrop-blur-md hover:shadow-md transition-all cursor-pointer overflow-hidden z-10 group border ${
                          isConflict
                            ? "bg-red-50/90 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-900"
                            : "bg-orange-500/10 dark:bg-orange-500/15 border-orange-300/40 dark:border-orange-500/30 text-stone-900 dark:text-stone-100"
                        }`}
                      >
                        <div
                          className={`w-1.5 h-full absolute left-0 top-0 rounded-l-md ${
                            isConflict
                              ? "bg-red-500"
                              : "bg-gradient-to-b from-[#b02f00] to-[#ff5722]"
                          }`}
                        />
                        <div className="pl-2 h-full flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-xs font-bold truncate">
                                {evt.title}
                              </h4>
                              {isConflict && (
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 animate-pulse" />
                              )}
                            </div>
                            <p
                              className={`text-[10px] font-semibold truncate mt-0.5 ${
                                isConflict
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-[#b02f00] dark:text-orange-400"
                              }`}
                            >
                              {evt.timeLabel}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-1">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                                isConflict
                                  ? "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-100"
                                  : "bg-orange-500/20 text-[#b02f00] dark:text-orange-300"
                              }`}
                            >
                              <Bot className="h-3 w-3" />
                              {isConflict ? "Conflict" : "AI Managed"}
                            </span>

                            <span className="text-[9px] font-medium text-stone-500 truncate max-w-[70px]">
                              {evt.providerName}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Floating Action Assistant & Quick Add FAB ─────────────────────── */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50">
        {/* Dynamic AI Assistant Conflict Resolution Bubble */}
        <AnimatePresence>
          {aiBubbleVisible && detectedConflict && (
            <motion.button
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() =>
                onResolveConflict &&
                onResolveConflict(
                  `Reschedule ${detectedConflict.event.title} to resolve the scheduling conflict on ${detectedConflict.event.date}`
                )
              }
              className="bg-white/95 dark:bg-stone-900/95 border border-red-200/80 dark:border-red-800/80 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3 w-80 hover:scale-[1.03] transition-all origin-bottom-right group cursor-pointer relative overflow-hidden backdrop-blur-md"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center shrink-0 text-white shadow-sm">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[11px] font-extrabold text-red-600 dark:text-red-400 mb-0.5">
                  ScheduleAI Assistant
                </p>
                <p className="text-xs text-stone-700 dark:text-stone-300 font-medium leading-tight line-clamp-2">
                  {detectedConflict.message}
                </p>
              </div>
            </motion.button>
          )}

          {/* All clear assistant bubble if no conflict */}
          {aiBubbleVisible && !detectedConflict && computedEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-white/95 dark:bg-stone-900/95 border border-emerald-200/80 dark:border-stone-800 shadow-xl rounded-2xl p-3 flex items-center gap-3 max-w-xs backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                  ScheduleAI Assistant
                </p>
                <p className="text-[11px] text-stone-600 dark:text-stone-300">
                  {computedEvents.length} appointment{computedEvents.length !== 1 ? "s" : ""} active this week. All conflict-free!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Add FAB */}
        <button
          onClick={onNewEvent}
          title="Quick Book New Appointment"
          className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white shadow-[0_10px_30px_rgba(255,87,34,0.35)] hover:shadow-[0_15px_40px_rgba(255,87,34,0.45)] flex items-center justify-center hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* ─── Real Event Details Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-stone-900 border border-orange-100 dark:border-stone-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-lg text-stone-900 dark:text-stone-100">
                    {selectedEvent.title}
                  </h3>
                  <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-[#ff5722]" />{" "}
                    {selectedEvent.timeLabel}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    selectedEvent.hasConflict
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-orange-50 text-[#b02f00] border-orange-200"
                  }
                >
                  {selectedEvent.hasConflict ? "Conflict" : "Confirmed"}
                </Badge>
              </div>

              <div className="space-y-2 text-xs border-y border-amber-100 dark:border-stone-800 py-3">
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                  <Building2 className="h-3.5 w-3.5 text-orange-600" />
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {selectedEvent.providerName}
                  </span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-stone-500">
                    <MapPin className="h-3.5 w-3.5 text-stone-400" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-stone-500">Fee:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    ₹{selectedEvent.price}
                  </span>
                </div>
              </div>

              {selectedEvent.hasConflict && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-700 dark:text-red-300">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-500" /> Overlap Detected
                  </p>
                  <p className="mt-1">
                    This booking conflicts with another scheduled meeting on this day.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {selectedEvent.hasConflict ? (
                  <Button
                    onClick={() => {
                      const title = selectedEvent.title
                      const date = selectedEvent.date
                      setSelectedEvent(null)
                      if (onResolveConflict) {
                        onResolveConflict(`Reschedule ${title} on ${date} to avoid conflict`)
                      }
                    }}
                    className="flex-1 bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Reschedule with AI
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setSelectedEvent(null)
                      router.push("/dashboard/user/bookings")
                    }}
                    className="flex-1 bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    View in Bookings
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
