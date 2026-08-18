"use client"

import { BookingCalendar } from "@/components/booking-calendar"

interface CalendarViewProps {
  calendarKey: number
}

export function CalendarView({ calendarKey }: CalendarViewProps) {
  return (
    <div className="glass-card rounded-[2rem] p-6 sm:p-8 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-sm min-h-[600px] space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-stone-900 dark:text-stone-100">ScheduleAI Calendar</h2>
        <p className="text-xs text-stone-500">Live synchronized timeline of all your scheduled appointments</p>
      </div>

      <div className="max-w-4xl mx-auto">
        <BookingCalendar key={calendarKey} userType="user" />
      </div>
    </div>
  )
}
