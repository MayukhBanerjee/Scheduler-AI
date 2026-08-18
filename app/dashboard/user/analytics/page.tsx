"use client"

import { useState, useEffect } from "react"
import { BookingRow } from "@/components/dashboard/user/types"
import { AnalyticsView } from "@/components/dashboard/user/views/analytics-view"

export default function AnalyticsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([])

  useEffect(() => {
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data) => {
        if (data.bookings && Array.isArray(data.bookings)) {
          setBookings(
            data.bookings.filter((b: BookingRow) => b.status !== "cancelled")
          )
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      <AnalyticsView bookings={bookings} />
    </div>
  )
}
