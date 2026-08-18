"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { BookingRow } from "@/components/dashboard/user/types"
import { BookingsView } from "@/components/dashboard/user/views/bookings-view"

export default function BookingsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchMyBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings")
      if (!res.ok) return
      const data = await res.json()
      setBookings(
        (data.bookings || []).filter((b: BookingRow) => b.status !== "cancelled")
      )
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchMyBookings()
  }, [fetchMyBookings])

  const handleCancelBooking = async (id: string) => {
    setCancellingId(id)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Cancel failed", description: data.error, variant: "destructive" })
      } else {
        toast({ title: "Cancelled", description: "Slot freed for others." })
        fetchMyBookings()
      }
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      <BookingsView
        bookings={bookings}
        onNewBooking={() => router.push("/dashboard/user")}
        onCancelBooking={handleCancelBooking}
        cancellingId={cancellingId}
      />
    </div>
  )
}
