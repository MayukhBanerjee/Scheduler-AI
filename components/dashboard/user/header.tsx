"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut, ChevronDown } from "lucide-react"
import { UserProfile } from "./types"

interface CustomerHeaderProps {
  activeTabLabel: string
  user: UserProfile | null
  onLogout: () => void
}

export function CustomerHeader({ activeTabLabel, user, onLogout }: CustomerHeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const getInitials = (name?: string) => {
    if (!name) return "U"
    const parts = name.trim().split(" ")
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-30 h-18 bg-white/70 dark:bg-stone-950/70 backdrop-blur-xl border-b border-orange-200/50 dark:border-stone-800 flex items-center justify-between px-6 sm:px-10">
      {/* Active Tab Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
          {activeTabLabel}
        </h1>
        <Badge
          variant="outline"
          className="bg-orange-50 dark:bg-stone-900 text-[#b02f00] dark:text-orange-400 border-orange-200/70 text-xs hidden sm:inline-flex"
        >
          Customer Portal
        </Badge>
      </div>

      {/* Right Header Actions */}
      <div className="flex items-center gap-3.5">
        <Link href="/login?type=provider">
          <Button
            size="sm"
            className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white rounded-full font-semibold text-xs px-4 py-1.5 shadow-[0_4px_14px_rgba(255,87,34,0.25)] transition-all hover:scale-[1.02]"
          >
            Switch to Business
          </Button>
        </Link>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 bg-orange-100/60 dark:bg-stone-800/80 hover:bg-orange-200/60 px-3 py-1.5 rounded-full border border-orange-200/60 dark:border-stone-700 transition-colors shadow-2xs cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white font-bold text-xs shadow-xs">
              {getInitials(user?.name)}
            </div>
            <span className="font-bold text-xs text-stone-800 dark:text-stone-200 hidden sm:block">
              {user?.name || "Customer"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-stone-500" />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-orange-100 dark:border-stone-800 p-1.5 z-50"
              >
                <div className="px-3 py-2 border-b border-orange-100 dark:border-stone-800">
                  <p className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] text-stone-500 truncate">{user?.email || "customer@scheduleai.com"}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors mt-1 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
