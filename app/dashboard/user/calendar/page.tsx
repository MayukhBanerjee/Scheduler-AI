"use client"

import { useRouter } from "next/navigation"
import { CalendarView } from "@/components/dashboard/user/views/calendar-view"

export default function CalendarPage() {
  const router = useRouter()

  const handleNewEvent = () => {
    router.push("/dashboard/user")
  }

  const handleResolveConflict = (prompt: string) => {
    try {
      sessionStorage.setItem("scheduleai_quick_prompt", prompt)
    } catch {}
    router.push("/dashboard/user")
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      <CalendarView
        onNewEvent={handleNewEvent}
        onResolveConflict={handleResolveConflict}
      />
    </div>
  )
}
