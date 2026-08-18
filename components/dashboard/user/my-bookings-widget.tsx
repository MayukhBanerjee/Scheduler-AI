"use client"

import { ListChecks, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookingRow } from "./types"

interface MyBookingsWidgetProps {
  bookings: BookingRow[]
  onViewAll: () => void
  onCancelBooking: (id: string) => void
  cancellingId: string | null
}

export function MyBookingsWidget({
  bookings,
  onViewAll,
  onCancelBooking,
  cancellingId,
}: MyBookingsWidgetProps) {
  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 flex flex-col gap-3.5 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-[0_4px_30px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[#b02f00] dark:text-orange-400" />
          <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
            My bookings
          </h3>
        </div>
        {bookings.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-xs font-bold text-[#b02f00] hover:underline cursor-pointer"
          >
            View All
          </button>
        )}
      </div>

      <div className="space-y-2">
        {bookings.length === 0 ? (
          <div className="bg-white/50 dark:bg-stone-950/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center border border-white/60 dark:border-stone-800 min-h-[100px]">
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">No active bookings yet.</p>
          </div>
        ) : (
          bookings.slice(0, 3).map((b) => (
            <div
              key={b._id}
              className="flex items-start justify-between gap-2 border border-orange-100/80 dark:border-stone-800 rounded-xl p-3 bg-white/80 dark:bg-stone-950/80 text-sm shadow-2xs"
            >
              <div className="min-w-0">
                <p className="font-bold text-stone-900 dark:text-stone-100 truncate">{b.service_name}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {b.date} · {b.time}
                  {b.provider_name ? ` · ${b.provider_name}` : ""}
                </p>
                <Badge variant="outline" className="mt-1 text-[10px] bg-orange-50 text-[#b02f00] border-orange-200">
                  {b.status}
                </Badge>
              </div>

              {b.status === "confirmed" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2 cursor-pointer"
                  disabled={cancellingId === b._id}
                  onClick={() => onCancelBooking(b._id)}
                >
                  {cancellingId === b._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
