"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar } from "@/components/ui/calendar"
import {
  Calendar as CalendarIcon,
  RefreshCw,
  CheckCircle,
  Clock,
  MapPin,
  CalendarX,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface InternalCalendarEvent {
  id: string
  service_name: string
  date: string       // "YYYY-MM-DD"
  time: string       // "HH:MM"
  location?: string
  provider_name?: string
  user_name?: string
}

interface BookingCalendarProps {
  userType: "user" | "client"
  onEventSync?: (events: InternalCalendarEvent[]) => void
}

type SyncStatus = "idle" | "syncing" | "success" | "error" | "unconfigured"

// Formats date/time — always en-US to prevent SSR/client hydration mismatch
function formatEventTime(dateStr: string, timeStr: string) {
  try {
    const [year, month, day] = dateStr.split("-").map(Number)
    const [hours, minutes] = timeStr.split(":").map(Number)

    const eventDate = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const isToday = eventDate.getTime() === today.getTime()

    const timeDate = new Date(year, month - 1, day, hours, minutes)
    const formattedTime = timeDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    if (isToday) {
      return `Today, ${formattedTime}`
    }

    const formattedDate = timeDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    return `${formattedDate}, ${formattedTime}`
  } catch {
    return `${dateStr} ${timeStr}`
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingCalendar({
  userType,
  onEventSync,
}: BookingCalendarProps) {
  // Always treating internally as "connected" since it's native DB
  const [isConnected, setIsConnected] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [events, setEvents] = useState<InternalCalendarEvent[]>([])
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Initialize as undefined to avoid SSR/client hydration mismatch — set to today in useEffect
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [mounted, setMounted] = useState(false)

  // ─── Fetch real events from internal API ──────────────────────────────────────

  const fetchEvents = useCallback(
    async () => {
      setIsLoading(true)
      setSyncStatus("syncing")
      setErrorMessage(null)

      try {
        const endpoint = userType === "client" ? "/api/calendar/provider" : "/api/calendar/user"
        const res = await fetch(endpoint)
        const data = await res.json()

        if (data.error) {
          setSyncStatus("error")
          setErrorMessage(data.error)
          setEvents([])
        } else {
          const fetchedEvents: InternalCalendarEvent[] = data.events || []
          setEvents(fetchedEvents)
          
          if (fetchedEvents.length === 0) {
            setSyncStatus("unconfigured") // No bookings
          } else {
            setSyncStatus("success")
          }
          
          setLastSync(new Date())
          onEventSync?.(fetchedEvents)
        }
      } catch {
        setSyncStatus("error")
        setErrorMessage("Could not reach internal calendar.")
        setEvents([])
      } finally {
        setIsLoading(false)
        // Auto-reset status badge after 3s
        setTimeout(() => setSyncStatus((prev) => (prev === "success" || prev === "error" ? "idle" : prev)), 3000)
      }
    },
    [onEventSync, userType]
  )

  // Mark mounted and set today as default selected date (client-only to avoid hydration mismatch)
  useEffect(() => {
    setMounted(true)
    setSelectedDate(new Date())
  }, [])

  // Initial load
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // ─── Handlers & Data Processing ───────────────────────────────────────────

  const handleSync = () => {
    if (isLoading) return
    fetchEvents()
  }
  
  // Calculate specific dates that have bookings for the Calendar visuals
  const datesWithEvents = useMemo(() => {
    const dates: Date[] = []
    events.forEach(e => {
        try {
            const [year, month, day] = e.date.split("-").map(Number)
            dates.push(new Date(year, month - 1, day))
        } catch {}
    })
    return dates
  }, [events])

  // Filter events to only show those on the currently clicked calendar day
  const displayedEvents = useMemo(() => {
      if (!selectedDate) return events
      return events.filter(e => {
          const [year, month, day] = e.date.split("-").map(Number)
          const eDate = new Date(year, month - 1, day)
          return eDate.getTime() === selectedDate.getTime()
      })
  }, [events, selectedDate])

  // ─── Render ───────────────────────────────────────────────────────────────

  const statusBadgeVariant =
    syncStatus === "success" || syncStatus === "idle"
      ? "default"
      : syncStatus === "error"
      ? "destructive"
      : "secondary"

  const statusLabel =
    syncStatus === "syncing"
      ? "Syncing..."
      : syncStatus === "success"
      ? "Synced"
      : syncStatus === "error"
      ? "Error"
      : syncStatus === "unconfigured"
      ? "No Bookings"
      : null

  return (
    <div className="glass-card rounded-[1.75rem] p-3.5 flex flex-col h-full min-h-0 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-[0_4px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Calendar Header */}
      <div className="pb-2.5 border-b border-orange-100/60 dark:border-stone-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-[#b02f00] dark:text-orange-400 flex items-center justify-center shadow-xs shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 leading-tight">
              ScheduleAI Calendar
            </h3>
            {mounted && lastSync && (
              <p className="text-[10px] font-medium text-stone-400">
                Synced:{" "}
                {lastSync.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isConnected && (
            <Button
              id="calendar-sync-btn"
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isLoading}
              className="rounded-full px-2.5 h-7 text-[11px] font-bold border-orange-200/70 dark:border-stone-700 bg-white/60 dark:bg-stone-800 hover:bg-orange-50 text-stone-700 dark:text-stone-300"
            >
              <RefreshCw className={`h-3 w-3 mr-1 text-[#b02f00] ${isLoading ? "animate-spin" : ""}`} />
              Sync
            </Button>
          )}

          <AnimatePresence>
            {syncStatus !== "idle" && statusLabel && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500 }}
              >
                <Badge
                  variant={statusBadgeVariant}
                  className={`text-[9px] px-1.5 py-0 ${syncStatus === "syncing" ? "animate-pulse" : ""}`}
                >
                  {statusLabel}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-0 pt-2 overflow-hidden gap-2">
        {/* Full Interactive Calendar UI */}
        <div className="flex justify-center border border-orange-100/60 dark:border-stone-800 rounded-xl overflow-hidden bg-white/50 dark:bg-stone-950/50 py-0.5 shrink-0 scale-95 origin-top">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={{ booked: datesWithEvents }}
            modifiersStyles={{
              booked: { fontWeight: "bold", textDecoration: "underline", color: "var(--primary)" }
            }}
            className="rounded-md"
          />
        </div>

        {/* Schedule List Area below Calendar */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-1 pb-1 border-b border-orange-100/60 dark:border-stone-800 pointer-events-none shrink-0">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-semibold">
                {mounted && selectedDate
                  ? `Events on ${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "Upcoming Schedule"}
              </span>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <AnimatePresence>
              {displayedEvents.length > 0 ? (
                <div className="space-y-2 pr-4 pb-2">
                  {displayedEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{
                        delay: index * 0.04,
                        type: "spring",
                        stiffness: 300,
                      }}
                      whileHover={{ scale: 1.015, boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}
                      className="p-3 border rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                            <h4 className="font-medium text-sm truncate">{event.service_name}</h4>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span>{formatEventTime(event.date, event.time)}</span>
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                            {(event.provider_name || event.user_name) && (
                              <div className="flex items-center gap-1 opacity-75 mt-1 pt-1 border-t">
                                <span className="truncate">
                                    {userType === "user" ? `Provider: ${event.provider_name}` : `Client: ${event.user_name}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  className="text-center py-6 text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <CalendarX className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No appointments on this date</p>
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
