"use client"

import { useState, useMemo, useEffect } from "react"
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
  Cloud,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface CalendarViewProps {
  calendarKey?: number
  onNewEvent?: () => void
  onResolveConflict?: (prompt: string) => void
}

interface CalendarEventItem {
  id: string
  title: string
  dayIndex: number // 0 = Mon, 1 = Tue, 2 = Wed, 3 = Thu, 4 = Fri, 5 = Sat, 6 = Sun
  startTime: string // "09:30"
  endTime: string // "11:00"
  topPx: number // Computed vertical offset in px
  heightPx: number // Computed height in px
  type: "ai-managed" | "synced" | "conflict"
  timeLabel: string
  source?: string
  hasConflict?: boolean
  avatarUrl?: string
}

const WEEK_DAYS = [
  { name: "Mon", dateNum: 23, full: "Monday" },
  { name: "Tue", dateNum: 24, full: "Tuesday", isActive: true },
  { name: "Wed", dateNum: 25, full: "Wednesday" },
  { name: "Thu", dateNum: 26, full: "Thursday" },
  { name: "Fri", dateNum: 27, full: "Friday" },
  { name: "Sat", dateNum: 28, full: "Saturday", isWeekend: true },
  { name: "Sun", dateNum: 29, full: "Sunday", isWeekend: true },
]

const TIME_SLOTS = ["9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM"]

const INITIAL_EVENTS: CalendarEventItem[] = [
  {
    id: "evt-1",
    title: "Weekly Sync",
    dayIndex: 0, // Mon
    startTime: "10:00",
    endTime: "11:00",
    topPx: 96, // 1 hour into 9am (h-24 = 96px)
    heightPx: 88,
    type: "synced",
    timeLabel: "10:00 - 11:00 AM",
    source: "Google Calendar",
  },
  {
    id: "evt-2",
    title: "Client Onboarding",
    dayIndex: 1, // Tue
    startTime: "09:30",
    endTime: "11:00",
    topPx: 48, // 30m into 9am
    heightPx: 140,
    type: "ai-managed",
    timeLabel: "9:30 - 11:00 AM",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces",
  },
  {
    id: "evt-3",
    title: "Team Review",
    dayIndex: 1, // Tue
    startTime: "11:00",
    endTime: "12:00",
    topPx: 230,
    heightPx: 90,
    type: "conflict",
    timeLabel: "11:00 - 12:00 PM",
    hasConflict: true,
  },
  {
    id: "evt-4",
    title: "Product Strategy",
    dayIndex: 3, // Thu
    startTime: "14:00",
    endTime: "15:00",
    topPx: 480,
    heightPx: 90,
    type: "ai-managed",
    timeLabel: "2:00 - 3:00 PM",
  },
]

export function CalendarView({
  calendarKey = 0,
  onNewEvent,
  onResolveConflict,
}: CalendarViewProps) {
  const [filterType, setFilterType] = useState<"all" | "ai" | "conflicts">("all")
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null)
  const [aiBubbleVisible, setAiBubbleVisible] = useState(true)
  const [events, setEvents] = useState<CalendarEventItem[]>(INITIAL_EVENTS)

  // Fetch real user bookings from database to supplement calendar events
  useEffect(() => {
    fetch("/api/calendar/user")
      .then((res) => res.json())
      .then((data) => {
        if (data.events && Array.isArray(data.events) && data.events.length > 0) {
          const mapped: CalendarEventItem[] = data.events.slice(0, 4).map((e: { id: string; service_name: string; date: string; time: string; location?: string; provider_name?: string }, idx: number) => {
            const timeParts = (e.time || "10:00 AM").split(" ")
            const hourMinute = timeParts[0].split(":")
            let hour = parseInt(hourMinute[0], 10) || 10
            const isPM = timeParts[1]?.toUpperCase() === "PM"
            if (isPM && hour < 12) hour += 12
            if (!isPM && hour === 12) hour = 0

            // map to day 0-6
            const dayIdx = (idx + 2) % 7
            const topOffset = Math.max(0, (hour - 9) * 96) + 20

            return {
              id: e.id || `dyn-${idx}`,
              title: e.service_name || "Appointment",
              dayIndex: dayIdx,
              startTime: e.time,
              endTime: "1 hour",
              topPx: topOffset,
              heightPx: 90,
              type: "ai-managed",
              timeLabel: `${e.time} (${e.date})`,
              source: e.provider_name || "ScheduleAI",
            }
          })

          setEvents((prev) => {
            const combined = [...INITIAL_EVENTS]
            mapped.forEach((m) => {
              if (!combined.some((c) => c.id === m.id)) combined.push(m)
            })
            return combined
          })
        }
      })
      .catch(() => {})
  }, [calendarKey])

  const filteredEvents = useMemo(() => {
    if (filterType === "ai") return events.filter((e) => e.type === "ai-managed")
    if (filterType === "conflicts") return events.filter((e) => e.type === "conflict" || e.hasConflict)
    return events
  }, [events, filterType])

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative space-y-4 pb-20">
      {/* ─── Top Header Section ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2">
            Weekly View
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
            <CalendarIcon className="h-4 w-4 text-[#ff5722]" />
            October 23 - 29, 2024
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Filters Button */}
          <div className="flex items-center bg-white/70 dark:bg-stone-900/70 backdrop-blur-md rounded-full p-1 border border-orange-200/60 dark:border-stone-800 shadow-2xs">
            <button
              onClick={() => setFilterType(filterType === "all" ? "ai" : filterType === "ai" ? "conflicts" : "all")}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-stone-700 dark:text-stone-300 hover:text-[#b02f00] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-stone-500" />
              <span>Filters: <strong className="capitalize text-[#b02f00] dark:text-orange-400">{filterType}</strong></span>
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
              GMT-4
            </span>
          </div>

          {/* 7 Days Columns */}
          {WEEK_DAYS.map((day, idx) => (
            <div
              key={day.name}
              className={`p-3 sm:p-4 text-center flex flex-col items-center justify-center transition-colors cursor-pointer ${
                idx < 6 ? "border-r border-orange-100 dark:border-stone-800" : ""
              } ${
                day.isActive
                  ? "bg-orange-500/10 dark:bg-orange-500/15"
                  : "hover:bg-orange-50/50 dark:hover:bg-stone-800/40"
              } ${day.isWeekend ? "opacity-75" : ""}`}
            >
              <span
                className={`text-[11px] uppercase font-bold mb-1 ${
                  day.isActive ? "text-[#b02f00] dark:text-orange-400 font-extrabold" : "text-stone-500"
                }`}
              >
                {day.name}
              </span>
              <span
                className={`text-sm sm:text-base font-extrabold flex items-center justify-center transition-all ${
                  day.isActive
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
          <div className="grid grid-cols-8 relative min-h-[864px]">
            {/* Time Slots Labels (Column 1) */}
            <div className="border-r border-orange-100 dark:border-stone-800 relative z-10 bg-white/30 dark:bg-stone-900/30 backdrop-blur-xs">
              {TIME_SLOTS.map((time) => (
                <div key={time} className="h-24 border-b border-orange-100/50 dark:border-stone-800/50 relative">
                  <span className="absolute top-2 right-2 text-[11px] font-bold text-stone-400 dark:text-stone-500">
                    {time}
                  </span>
                </div>
              ))}
            </div>

            {/* 7 Days Columns Content (Columns 2-8) */}
            {WEEK_DAYS.map((day, dIdx) => (
              <div
                key={day.name}
                className={`relative ${
                  dIdx < 6 ? "border-r border-orange-100/40 dark:border-stone-800/40" : ""
                } ${day.isActive ? "bg-orange-500/5 dark:bg-orange-500/5" : ""} ${
                  day.isWeekend ? "bg-stone-50/30 dark:bg-stone-900/20" : ""
                }`}
              >
                {/* Time slot grid guidelines */}
                {TIME_SLOTS.map((time) => (
                  <div key={time} className="h-24 border-b border-orange-100/30 dark:border-stone-800/30" />
                ))}

                {/* Current Time Indicator Line for Active Day */}
                {day.isActive && (
                  <div className="absolute top-[280px] left-0 w-full z-20 flex items-center pointer-events-none">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5722] -ml-1.5 shadow-[0_0_8px_rgba(255,87,34,0.8)]" />
                    <div className="h-[2px] bg-gradient-to-r from-[#ff5722] to-transparent w-full shadow-[0_0_8px_rgba(255,87,34,0.6)]" />
                  </div>
                )}

                {/* Events for this specific Day */}
                {filteredEvents
                  .filter((e) => e.dayIndex === dIdx)
                  .map((evt) => {
                    if (evt.type === "ai-managed") {
                      return (
                        <motion.div
                          key={evt.id}
                          style={{ top: `${evt.topPx}px`, height: `${evt.heightPx}px` }}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedEvent(evt)}
                          className="absolute left-1 right-1 bg-orange-500/10 dark:bg-orange-500/15 border border-orange-300/40 dark:border-orange-500/30 rounded-xl p-2.5 shadow-sm backdrop-blur-md hover:shadow-md transition-all cursor-pointer overflow-hidden z-10 group"
                        >
                          <div className="w-1.5 h-full bg-gradient-to-b from-[#b02f00] to-[#ff5722] absolute left-0 top-0 rounded-l-md" />
                          <div className="pl-2 h-full flex flex-col justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                                {evt.title}
                              </h4>
                              <p className="text-[10px] font-semibold text-[#b02f00] dark:text-orange-400 truncate mt-0.5">
                                {evt.timeLabel}
                              </p>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-1">
                              <span className="text-[9px] font-bold bg-orange-500/20 text-[#b02f00] dark:text-orange-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <Bot className="h-3 w-3" />
                                AI Managed
                              </span>
                              {evt.avatarUrl ? (
                                <img
                                  src={evt.avatarUrl}
                                  alt="Avatar"
                                  className="w-4 h-4 rounded-full object-cover border border-white dark:border-stone-800"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-orange-200 text-[#b02f00] flex items-center justify-center text-[8px] font-bold">
                                  MB
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    }

                    if (evt.type === "synced") {
                      return (
                        <motion.div
                          key={evt.id}
                          style={{ top: `${evt.topPx}px`, height: `${evt.heightPx}px` }}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedEvent(evt)}
                          className="absolute left-1 right-1 bg-stone-100/80 dark:bg-stone-800/80 border border-stone-300/40 dark:border-stone-700/60 rounded-xl p-2.5 shadow-sm backdrop-blur-md hover:shadow-md transition-all cursor-pointer overflow-hidden z-10 group"
                        >
                          <div className="w-1.5 h-full bg-stone-500 absolute left-0 top-0 rounded-l-md" />
                          <div className="pl-2 h-full flex flex-col justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                                {evt.title}
                              </h4>
                              <p className="text-[10px] font-medium text-stone-500 truncate mt-0.5">
                                {evt.timeLabel}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-[9px] font-bold text-stone-500 mt-auto pt-1">
                              <Cloud className="h-3 w-3 text-stone-400" />
                              <span>{evt.source || "Google Sync"}</span>
                            </div>
                          </div>
                        </motion.div>
                      )
                    }

                    if (evt.type === "conflict") {
                      return (
                        <motion.div
                          key={evt.id}
                          style={{ top: `${evt.topPx}px`, height: `${evt.heightPx}px` }}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedEvent(evt)}
                          className="absolute left-1 right-1 w-[90%] bg-red-50/90 dark:bg-red-950/50 border border-red-300/60 dark:border-red-800/60 rounded-xl p-2.5 shadow-sm backdrop-blur-md hover:shadow-md transition-all cursor-pointer overflow-hidden z-15 group"
                        >
                          <div className="w-1.5 h-full bg-red-500 absolute left-0 top-0 rounded-l-md" />
                          <div className="pl-2 h-full flex flex-col justify-between">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-xs font-bold text-red-950 dark:text-red-200 truncate">
                                {evt.title}
                              </h4>
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 animate-pulse" />
                            </div>
                            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 truncate mt-0.5">
                              {evt.timeLabel}
                            </p>
                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">
                              Conflict Detected
                            </span>
                          </div>
                        </motion.div>
                      )
                    }

                    return null
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Floating Action Assistant & Quick Add FAB ─────────────────────── */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50">
        {/* AI Assistant Conflict Resolution Bubble */}
        <AnimatePresence>
          {aiBubbleVisible && (
            <motion.button
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onResolveConflict && onResolveConflict("Resolve calendar conflict on Tuesday at 11 AM")}
              className="bg-white/95 dark:bg-stone-900/95 border border-orange-200/70 dark:border-stone-700 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3 w-72 hover:scale-[1.03] transition-all origin-bottom-right group cursor-pointer relative overflow-hidden backdrop-blur-md"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center shrink-0 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[11px] font-extrabold text-[#b02f00] dark:text-orange-400 mb-0.5">
                  ScheduleAI Assistant
                </p>
                <p className="text-xs text-stone-700 dark:text-stone-300 font-medium leading-tight line-clamp-2">
                  I noticed a conflict on Tuesday at 11 AM. Resolve?
                </p>
              </div>
            </motion.button>
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

      {/* ─── Event Details Modal ───────────────────────────────────────────── */}
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
                  <h3 className="font-extrabold text-lg text-stone-900 dark:text-stone-100">{selectedEvent.title}</h3>
                  <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-[#ff5722]" /> {selectedEvent.timeLabel}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    selectedEvent.type === "ai-managed"
                      ? "bg-orange-50 text-[#b02f00] border-orange-200"
                      : selectedEvent.type === "conflict"
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-stone-50 text-stone-700 border-stone-200"
                  }
                >
                  {selectedEvent.type === "ai-managed" ? "AI Managed" : selectedEvent.type === "conflict" ? "Conflict" : "Synced"}
                </Badge>
              </div>

              {selectedEvent.hasConflict && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-700 dark:text-red-300">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-500" /> Overlap Detected
                  </p>
                  <p className="mt-1">This appointment clashes with another scheduled meeting.</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {selectedEvent.hasConflict ? (
                  <Button
                    onClick={() => {
                      const title = selectedEvent.title
                      setSelectedEvent(null)
                      if (onResolveConflict) {
                        onResolveConflict(`Reschedule ${title} to avoid conflict on Tuesday`)
                      }
                    }}
                    className="flex-1 bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Reschedule with AI
                  </Button>
                ) : (
                  <Button
                    onClick={() => setSelectedEvent(null)}
                    className="flex-1 bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Done
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
