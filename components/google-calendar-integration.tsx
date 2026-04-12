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

interface GoogleCalendarIntegrationProps {
  userType: "user" | "client"
  onEventSync?: (events: InternalCalendarEvent[]) => void
}

type SyncStatus = "idle" | "syncing" | "success" | "error" | "unconfigured"

// Formats date/time natively
function formatEventTime(dateStr: string, timeStr: string) {
  try {
    const [year, month, day] = dateStr.split("-").map(Number)
    const [hours, minutes] = timeStr.split(":").map(Number)
    
    const eventDate = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const isToday = eventDate.getTime() === today.getTime()
    
    const timeDate = new Date(year, month - 1, day, hours, minutes)
    const formattedTime = timeDate.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    })
    
    if (isToday) {
      return `Today, ${formattedTime}`
    }
    
    const formattedDate = timeDate.toLocaleDateString([], { 
        day: 'numeric', 
        month: 'short' 
    })
    return `${formattedDate}, ${formattedTime}`
  } catch {
    return `${dateStr} ${timeStr}`
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoogleCalendarIntegration({
  userType,
  onEventSync,
}: GoogleCalendarIntegrationProps) {
  // Always treating internally as "connected" since it's native DB
  const [isConnected, setIsConnected] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [events, setEvents] = useState<InternalCalendarEvent[]>([])
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())

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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isLoading ? 360 : 0 }}
              transition={{
                duration: 1,
                repeat: isLoading ? Infinity : 0,
                ease: "linear",
              }}
            >
              <CalendarIcon className="h-5 w-5 text-primary" />
            </motion.div>
            My Calendar
            {isConnected && events.length > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500 }}
              >
                <Badge variant="secondary" className="ml-1 text-xs">
                  {events.length} upcoming
                </Badge>
              </motion.div>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            {isConnected && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  id="calendar-sync-btn"
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isLoading}
                >
                  <motion.div
                    animate={{ rotate: isLoading ? 360 : 0 }}
                    transition={{
                      duration: 1,
                      repeat: isLoading ? Infinity : 0,
                      ease: "linear",
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                  </motion.div>
                  Sync
                </Button>
              </motion.div>
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
                    className={syncStatus === "syncing" ? "animate-pulse" : ""}
                  >
                    {statusLabel}
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {lastSync && (
          <motion.p
            className="text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Last synced:{" "}
            {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </motion.p>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 overflow-hidden gap-4">
        {/* Full Interactive Calendar UI */}
        <div className="flex justify-center border rounded-xl overflow-hidden bg-muted/10 pb-2">
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
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 pb-1 border-b pointer-events-none">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">
                {selectedDate 
                    ? `Events on ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric'})}` 
                    : "Upcoming Schedule"}
              </span>
            </div>
          </div>

          <ScrollArea className="flex-1">
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
      </CardContent>
    </Card>
  )
}
