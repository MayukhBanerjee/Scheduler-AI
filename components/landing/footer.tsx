"use client"

import Link from "next/link"
import { Calendar, Github, Linkedin, Mail } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-white dark:bg-stone-950 border-t border-orange-200/50 dark:border-stone-800/80 w-full py-12 px-4 sm:px-8 md:px-12 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Tier: Brand, Links & Developer Attribution */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <Calendar className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg text-stone-900 dark:text-stone-100">
              ScheduleAI
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8 text-sm font-semibold text-stone-600 dark:text-stone-300">
            <Link href="#features" className="hover:text-[#b02f00] dark:hover:text-orange-400 transition-colors">
              Discover
            </Link>
            <Link href="/dashboard/user" className="hover:text-[#b02f00] dark:hover:text-orange-400 transition-colors">
              Customer Portal
            </Link>
            <Link href="/signup?role=provider" className="hover:text-[#b02f00] dark:hover:text-orange-400 transition-colors">
              Business Portal
            </Link>
            <Link href="/login" className="hover:text-[#b02f00] dark:hover:text-orange-400 transition-colors">
              Login
            </Link>
          </div>

          {/* Developer Attribution */}
          <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
            <span>Built by <strong>Mayukh Banerjee</strong></span>
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
              <a
                href="https://github.com/MayukhBanerjee"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#b02f00] transition-colors"
                title="Mayukh's GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://www.linkedin.com/in/mayukh-banerjee"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#b02f00] transition-colors"
                title="Mayukh's LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Copyright & Legal */}
        <div className="pt-6 border-t border-orange-100 dark:border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
          <p>© 2026 ScheduleAI — Universal Service Booking Platform. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-stone-700 cursor-pointer">Terms & Privacy</span>
            <span>•</span>
            <span className="hover:text-stone-700 cursor-pointer">Security</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
