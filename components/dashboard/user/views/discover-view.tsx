"use client"

import { motion } from "framer-motion"
import { Search, MapPin, Star, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DISCOVERY_CATEGORIES } from "../types"

interface ProviderItem {
  id: string
  name: string
  category: string
  rating: number
  location: string
  services: Array<{
    name: string
    price: number
    duration: number
  }>
}

interface DiscoverViewProps {
  category: string
  onCategoryChange: (cat: string) => void
  search: string
  onSearchChange: (val: string) => void
  providers: ProviderItem[]
  onBookWithAI: (prompt: string) => void
}

export function DiscoverView({
  category,
  onCategoryChange,
  search,
  onSearchChange,
  providers,
  onBookWithAI,
}: DiscoverViewProps) {
  return (
    <div className="space-y-6">
      {/* Search & Category Filter Bar */}
      <div className="glass-card rounded-[2rem] p-6 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search dental, haircut, deep tissue massage, yoga..."
            className="w-full bg-white dark:bg-stone-950 border border-orange-200/60 dark:border-stone-700 rounded-full py-3.5 pl-12 pr-6 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#b02f00] shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {DISCOVERY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                category === cat
                  ? "bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white shadow-xs"
                  : "bg-orange-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-orange-100 border border-orange-200/50 dark:border-stone-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {providers.map((provider) => (
          <motion.div
            key={provider.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-[2rem] p-6 bg-white/80 dark:bg-stone-900/80 border border-white/60 dark:border-stone-800 shadow-sm hover:shadow-md transition-all space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-stone-900 dark:text-stone-100">{provider.name}</h3>
                <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-[#ff5722]" /> {provider.location}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200/60 text-amber-700 dark:text-amber-300 font-bold text-xs">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {provider.rating}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Available Services</p>
              {provider.services.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-orange-50/50 dark:bg-stone-800/50 border border-orange-100/60 dark:border-stone-700 text-sm"
                >
                  <div>
                    <p className="font-semibold text-stone-800 dark:text-stone-200">{s.name}</p>
                    <p className="text-xs text-stone-500">{s.duration} mins</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#b02f00] dark:text-orange-400">₹{s.price}</span>
                    <Button
                      size="sm"
                      onClick={() => onBookWithAI(`Book ${s.name} at ${provider.name}`)}
                      className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white rounded-full text-xs font-semibold px-3 h-7 shadow-xs cursor-pointer"
                    >
                      Book with AI <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
