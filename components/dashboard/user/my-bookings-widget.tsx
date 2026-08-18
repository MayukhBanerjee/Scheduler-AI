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
    <div className="glass-card rounded-[1.75rem] p-3.5 sm:p-4 flex flex-col gap-2 shrink-0 max-h-[145px] bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-[0_4px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-[#b02f00] dark:text-orange-400" />
          <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
            My bookings
          </h3>
        </div>
        {bookings.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-[11px] font-bold text-[#b02f00] hover:underline cursor-pointer"
          >
            View All
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {bookings.length === 0 ? (
          <div className="bg-white/50 dark:bg-stone-950/50 rounded-xl p-3 flex flex-col items-center justify-center text-center border border-white/60 dark:border-stone-800 h-full">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">No active bookings yet.</p>
          </div>
        ) : (
          bookings.slice(0, 3).map((b) => (
            <div
              key={b._id}
              className="flex items-center justify-between gap-2 border border-orange-100/80 dark:border-stone-800 rounded-xl p-2 bg-white/80 dark:bg-stone-950/80 text-xs shadow-2xs"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-stone-900 dark:text-stone-100 truncate">{b.service_name}</p>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                  {b.date} · {b.time} {b.provider_name ? `· ${b.provider_name}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-orange-50 text-[#b02f00] border-orange-200">
                  {b.status}
                </Badge>
                {b.status === "confirmed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0 cursor-pointer"
                    disabled={cancellingId === b._id}
                    onClick={() => onCancelBooking(b._id)}
                  >
                    {cancellingId === b._id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
