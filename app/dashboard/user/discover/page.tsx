"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DiscoverView } from "@/components/dashboard/user/views/discover-view"

export interface ProviderItem {
  id: string
  name: string
  category: string
  rating: number
  location: string
  subtitle: string
  image: string
  badgeText: string
  badgeType: "verified" | "instant"
}

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  "Beauty & Hair": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=400&fit=crop",
  "Beauty": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=400&fit=crop",
  "Healthcare": "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&h=400&fit=crop",
  "Dental": "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&h=400&fit=crop",
  "Wellness & Spa": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&h=400&fit=crop",
  "Wellness": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&h=400&fit=crop",
  "Fitness": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop",
  "Legal": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop",
  "Consulting": "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=400&fit=crop",
  "Education": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop",
  "Home Services": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=400&fit=crop",
}

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1556740758-90de374c12ad?w=600&h=400&fit=crop"

export default function DiscoverPage() {
  const router = useRouter()
  const [category, setCategory] = useState("All")
  const [search, setSearch] = useState("")
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchProviders = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (category && category !== "All") params.set("category", category)
      if (search.trim()) params.set("search", search.trim())

      const res = await fetch(`/api/providers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const rawProviders = data.providers || []
        setProviders(
          rawProviders.map((p: {
            id: string
            name: string
            category: string
            rating: number
            location: string
            subtitle?: string
            badgeText?: string
            badgeType?: "verified" | "instant"
          }) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            rating: p.rating || 5.0,
            location: p.location || "Bangalore",
            subtitle: p.subtitle || `${p.category} • ${p.location}`,
            image: CATEGORY_IMAGE_MAP[p.category] || DEFAULT_IMAGE,
            badgeText: p.badgeText || "Verified Slots",
            badgeType: p.badgeType || "verified",
          }))
        )
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }, [category, search])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleBookWithAI = (prompt: string) => {
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
        providers={providers}
        isLoading={isLoading}
        onBookWithAI={handleBookWithAI}
      />
    </div>
  )
}