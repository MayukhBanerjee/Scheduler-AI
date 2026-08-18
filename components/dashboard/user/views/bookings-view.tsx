"use client"

import { useState } from "react"
import { CalendarCheck, Calendar as CalendarIcon, Clock, XCircle, Loader2, Sparkles, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookingRow } from "../types"

interface BookingsViewProps {
  bookings: BookingRow[]
  onNewBooking: () => void
  onCancelBooking: (id: string) => void
  cancellingId: string | null
}

export function BookingsView({
  bookings,
  onNewBooking,
  onCancelBooking,
  cancellingId,
}: BookingsViewProps) {
  const [filter, setFilter] = useState<"all" | "confirmed" | "completed">("all")

  const filteredBookings = bookings.filter((b) => {
    if (filter === "all") return true
    return b.status.toLowerCase() === filter
  })

  return (
    <div className="glass-card rounded-[2rem] p-6 sm:p-8 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-sm space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-orange-100 dark:border-stone-800 pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 dark:text-stone-100">My Appointments</h2>
          <p className="text-xs text-stone-500">Manage and track your active reservations</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-orange-50 dark:bg-stone-800 p-1 rounded-full border border-orange-200/50 dark:border-stone-700">
            {(["all", "confirmed", "completed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all cursor-pointer ${
                  filter === tab
                    ? "bg-white dark:bg-stone-900 text-[#b02f00] dark:text-orange-400 shadow-xs"
                    : "text-stone-600 dark:text-stone-300 hover:text-[#b02f00]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={onNewBooking}
            className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white rounded-full text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" /> New Booking
          </Button>
        </div>
      </div>

      {/* Bookings List / Empty State */}
      {filteredBookings.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <CalendarCheck className="h-12 w-12 text-orange-300 mx-auto" />
          <h3 className="font-bold text-lg text-stone-800 dark:text-stone-200">
            {filter === "all" ? "No active bookings found" : `No ${filter} bookings`}
          </h3>
          <p className="text-sm text-stone-500 max-w-sm mx-auto">
            Use our AI scheduler to find top-rated providers and book appointments in seconds.
          </p>
          <Button
            onClick={onNewBooking}
            className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white rounded-full text-sm font-semibold mt-2 cursor-pointer"
          >
            Start AI Booking
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((b) => (
            <div
              key={b._id}
              className="p-4 sm:p-5 rounded-2xl bg-orange-50/40 dark:bg-stone-800/40 border border-orange-100 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-stone-900 dark:text-stone-100">{b.service_name}</h4>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                    {b.status}
                  </Badge>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium">
                    <CalendarIcon className="h-3.5 w-3.5 text-[#ff5722]" /> {b.date}
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="h-3.5 w-3.5 text-[#ff5722]" /> {b.time}
                  </span>
                  {b.provider_name && (
                    <span>
                      • Provider: <strong>{b.provider_name}</strong>
                    </span>
                  )}
                </p>
              </div>

              {b.status === "confirmed" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancellingId === b._id}
                  onClick={() => onCancelBooking(b._id)}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full text-xs font-semibold cursor-pointer"
                >
                  {cancellingId === b._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                  )}
                  Cancel Booking
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
