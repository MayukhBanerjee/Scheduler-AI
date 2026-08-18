"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Sparkles,
  ArrowRight,
  Heart,
  MessageSquare,
  ShieldCheck,
  Zap,
  Star,
  Activity,
  HeartHandshake,
  Scissors,
  Dumbbell,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProviderItem {
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

interface DiscoverViewProps {
  category: string
  onCategoryChange: (cat: string) => void
  search: string
  onSearchChange: (val: string) => void
  providers?: ProviderItem[]
  onBookWithAI: (prompt: string) => void
}

const DISCOVERY_PROVIDERS: ProviderItem[] = [
  {
    id: "p-dentist",
    name: "Dr. Sarah Jenkins",
    category: "Healthcare",
    rating: 4.9,
    location: "Koramangala",
    subtitle: "Advanced Dentistry & Aesthetics • Koramangala",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&h=400&fit=crop",
    badgeText: "Verified Slots",
    badgeType: "verified",
  },
  {
    id: "p-wellness",
    name: "Zenith Wellness Center",
    category: "Wellness",
    rating: 4.8,
    location: "Indiranagar",
    subtitle: "Holistic Therapy & Yoga • Indiranagar",
    image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&h=400&fit=crop",
    badgeText: "Instant Book",
    badgeType: "instant",
  },
  {
    id: "p-fitness",
    name: "Core Fitness Studio",
    category: "Fitness",
    rating: 4.9,
    location: "HSR Layout",
    subtitle: "Personal Training & HIIT • HSR Layout",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop",
    badgeText: "Verified Slots",
    badgeType: "verified",
  },
]

const CATEGORY_ITEMS = [
  { label: "Healthcare", icon: Activity },
  { label: "Wellness", icon: HeartHandshake },
  { label: "Beauty", icon: Scissors },
  { label: "Fitness", icon: Dumbbell },
]

export function DiscoverView({
  category,
  onCategoryChange,
  search,
  onSearchChange,
  onBookWithAI,
}: DiscoverViewProps) {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [showTooltip, setShowTooltip] = useState(false)

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAskAI = (query?: string) => {
    const q = query || search
    if (q.trim()) {
      onBookWithAI(q)
    } else {
      onBookWithAI("Help me find top-rated services near Koramangala or Indiranagar")
    }
  }

  const filteredProviders = DISCOVERY_PROVIDERS.filter((p) => {
    const matchesCat =
      !category || category === "All" || p.category.toLowerCase() === category.toLowerCase()
    const matchesSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.subtitle.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative space-y-10 pb-24">
      {/* ─── 1. Hero Search Section ─────────────────────────────────────────── */}
      <section className="text-center max-w-3xl mx-auto w-full pt-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight mb-6 font-headline-lg">
          What do you need to do?
        </h1>

        {/* Large Pill Search Bar */}
        <div className="relative glass-card rounded-full p-2 flex items-center mb-6 shadow-[0_10px_35px_rgba(176,47,0,0.06)] border border-white/80 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl">
          <Search className="h-5 w-5 text-[#ff5722] ml-4 mr-2 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAskAI()
            }}
            placeholder="Find a dentist in Koramangala tomorrow..."
            className="flex-1 bg-transparent border-none text-sm sm:text-base font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-0 py-2.5 px-2"
          />
          <button
            onClick={() => handleAskAI()}
            className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-full flex items-center gap-2 shadow-[0_10px_25px_rgba(255,87,34,0.25)] hover:shadow-[0_12px_30px_rgba(255,87,34,0.35)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            <span>Ask AI</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3.5">
          {CATEGORY_ITEMS.map((cat) => {
            const Icon = cat.icon
            const isSelected = category.toLowerCase() === cat.label.toLowerCase()

            return (
              <button
                key={cat.label}
                onClick={() => onCategoryChange(isSelected ? "All" : cat.label)}
                className={`border text-xs sm:text-sm font-bold px-5 py-2 rounded-full transition-all flex items-center gap-2 shadow-2xs hover:shadow-sm cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white border-[#b02f00] shadow-sm scale-105"
                    : "bg-white/80 dark:bg-stone-900/80 hover:bg-orange-50/60 dark:hover:bg-stone-800 border-orange-100/80 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? "text-white" : "text-[#ff5722]"}`} />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ─── 2. Discovery Section ("Recommended for You") ──────────────────── */}
      <section className="w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
            Recommended for You
          </h2>
          <button
            onClick={() => {
              onCategoryChange("All")
              onSearchChange("")
            }}
            className="text-[#b02f00] dark:text-orange-400 font-bold text-xs sm:text-sm flex items-center gap-1 hover:underline underline-offset-4 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* 3-Column Provider Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => {
            const isFav = Boolean(favorites[provider.id])

            return (
              <motion.article
                key={provider.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25 }}
                className="glass-card rounded-2xl overflow-hidden flex flex-col bg-white/80 dark:bg-stone-900/80 border border-white/60 dark:border-stone-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgba(176,47,0,0.1)] transition-all"
              >
                {/* Card Image Banner */}
                <div className="relative h-48 w-full bg-orange-100/50 dark:bg-stone-800 overflow-hidden">
                  <img
                    src={provider.image}
                    alt={provider.name}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  {/* Top-Right Verified / Instant Badge */}
                  <div className="absolute top-3 right-3 bg-white/85 dark:bg-stone-900/85 backdrop-blur-md border border-orange-200/50 dark:border-stone-700 text-[#b02f00] dark:text-orange-400 font-bold text-[11px] px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    {provider.badgeType === "verified" ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-[#ff5722]" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 text-[#ff5722]" />
                    )}
                    <span>{provider.badgeText}</span>
                  </div>
                </div>

                {/* Card Content Area */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
                      {provider.name}
                    </h3>
                    <div className="flex items-center gap-1 text-stone-700 dark:text-stone-300 font-bold text-xs bg-orange-50 dark:bg-stone-800 border border-orange-100 dark:border-stone-700 px-2 py-0.5 rounded-md shrink-0">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>{provider.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm font-medium mb-5">
                    {provider.subtitle}
                  </p>

                  {/* Actions */}
                  <div className="mt-auto pt-2 flex gap-3 items-center">
                    <button
                      onClick={() => onBookWithAI(`I'd like to book an appointment with ${provider.name} at ${provider.location}`)}
                      className="flex-1 bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white font-bold text-xs sm:text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(255,87,34,0.2)] hover:shadow-[0_12px_30px_rgba(255,87,34,0.3)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Chat to Book</span>
                    </button>

                    <button
                      onClick={() => toggleFavorite(provider.id)}
                      title={isFav ? "Remove from favorites" : "Save to favorites"}
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                        isFav
                          ? "border-red-300 bg-red-50 text-red-500 shadow-xs"
                          : "border-orange-200/80 dark:border-stone-700 hover:bg-orange-50 dark:hover:bg-stone-800 text-[#b02f00] dark:text-orange-400"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
                    </button>
                  </div>
                </div>
              </motion.article>
            )
          })}
        </div>
      </section>

      {/* ─── 3. Floating Persistent AI Assistant & FAB ──────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Floating Tooltip Bubble on Hover / Click */}
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="glass-card p-4 rounded-2xl shadow-2xl w-64 bg-white/95 dark:bg-stone-900/95 border border-orange-200/70 dark:border-stone-700 backdrop-blur-md"
            >
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 leading-relaxed">
                Hi! I can help you find and book appointments instantly. What are you looking for?
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => handleAskAI()}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white shadow-[0_10px_30px_rgba(255,87,34,0.35)] hover:shadow-[0_15px_40px_rgba(255,87,34,0.45)] flex items-center justify-center hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer relative"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-white rounded-full border-2 border-[#ff5722] animate-pulse" />
        </button>
      </div>
    </div>
  )
}
