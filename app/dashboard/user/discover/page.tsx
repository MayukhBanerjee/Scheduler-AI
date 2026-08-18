"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DiscoverView } from "@/components/dashboard/user/views/discover-view"

export default function DiscoverPage() {
  const router = useRouter()
  const [category, setCategory] = useState("All")
  const [search, setSearch] = useState("")

  const handleBookWithAI = (prompt: string) => {
    // Navigate to AI Scheduler and pass query or store in sessionStorage
    try {
      sessionStorage.setItem("scheduleai_quick_prompt", prompt)
    } catch {}
    router.push("/dashboard/user")
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      <DiscoverView
        category={category}
        onCategoryChange={setCategory}
        search={search}
        onSearchChange={setSearch}
        onBookWithAI={handleBookWithAI}
      />
    </div>
  )
}
