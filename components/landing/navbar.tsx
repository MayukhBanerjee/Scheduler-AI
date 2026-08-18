"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Sparkles, Menu, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TopNavBarProps {
  onOpenAuth: (action: "login" | "register") => void
}

export function TopNavBar({ onOpenAuth }: TopNavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="bg-white/75 dark:bg-stone-950/75 backdrop-blur-xl border-b border-orange-200/50 dark:border-stone-800 shadow-[0_10px_30px_rgba(255,87,34,0.08)] fixed top-0 w-full z-50 transition-all duration-300">
      <div className="flex justify-between items-center px-4 sm:px-8 md:px-12 py-3.5 max-w-7xl mx-auto">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-xl md:text-2xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2.5 group"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="bg-gradient-to-r from-stone-900 via-stone-800 to-[#b02f00] dark:from-white dark:to-orange-400 bg-clip-text text-transparent">
              ScheduleAI
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-7">
            <Link
              href="#features"
              className="text-stone-600 hover:text-[#b02f00] dark:text-stone-300 dark:hover:text-orange-400 font-semibold text-sm transition-colors"
            >
              Discover
            </Link>
            <Link
              href="/dashboard/user"
              className="text-stone-600 hover:text-[#b02f00] dark:text-stone-300 dark:hover:text-orange-400 font-semibold text-sm transition-colors"
            >
              Bookings
            </Link>
            <Link
              href="/dashboard/user"
              className="text-[#b02f00] dark:text-orange-400 font-bold text-sm flex items-center gap-1.5 border-b-2 border-[#b02f00] dark:border-orange-400 pb-0.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#ff5722]" />
              AI Schedule
            </Link>
            <Link
              href="/signup?role=provider"
              className="text-stone-600 hover:text-[#b02f00] dark:text-stone-300 dark:hover:text-orange-400 font-semibold text-sm transition-colors"
            >
              For Businesses
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenAuth("login")}
            className="text-stone-700 dark:text-stone-200 hover:text-[#b02f00] hover:bg-orange-500/10 rounded-full font-semibold px-4"
          >
            Login
          </Button>

          <Button
            size="sm"
            onClick={() => onOpenAuth("register")}
            className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white px-5 py-2 rounded-full font-semibold text-sm shadow-[0_4px_14px_rgba(255,87,34,0.35)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Get Started Free
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenAuth("login")}
            className="text-xs px-3 rounded-full border-orange-200 text-[#b02f00]"
          >
            Login
          </Button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-stone-700 hover:bg-orange-100/50 dark:text-stone-200 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-orange-100 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 backdrop-blur-2xl px-6 py-5 space-y-4"
          >
            <div className="flex flex-col space-y-3">
              <Link
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="text-stone-700 dark:text-stone-200 font-semibold text-base py-1"
              >
                Discover Features
              </Link>
              <Link
                href="/dashboard/user"
                onClick={() => setMobileMenuOpen(false)}
                className="text-stone-700 dark:text-stone-200 font-semibold text-base py-1"
              >
                Customer Dashboard
              </Link>
              <Link
                href="/signup?role=provider"
                onClick={() => setMobileMenuOpen(false)}
                className="text-stone-700 dark:text-stone-200 font-semibold text-base py-1"
              >
                For Businesses & Providers
              </Link>
            </div>
            <div className="pt-3 border-t border-orange-100 dark:border-stone-800 flex flex-col gap-2">
              <Button
                onClick={() => {
                  setMobileMenuOpen(false)
                  onOpenAuth("register")
                }}
                className="w-full bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white rounded-full font-semibold shadow-md"
              >
                Get Started Free <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
