"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  Calendar as CalendarIcon,
  Sparkles,
  Compass,
  ListChecks,
  BarChart3,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { NavTab, UserProfile, NavItem } from "./types"

interface CustomerSidebarProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
  collapsed: boolean
  onToggleCollapse: () => void
  user: UserProfile | null
  bookingsCount: number
}

export function CustomerSidebar({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  user,
  bookingsCount,
}: CustomerSidebarProps) {
  const getInitials = (name?: string) => {
    if (!name) return "U"
    const parts = name.trim().split(" ")
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const navItems: NavItem[] = [
    {
      id: "ai-schedule",
      label: "AI Scheduler",
      icon: Sparkles,
      badge: "Live",
    },
    {
      id: "discover",
      label: "Discover",
      icon: Compass,
    },
    {
      id: "bookings",
      label: "Bookings",
      icon: ListChecks,
      count: bookingsCount > 0 ? bookingsCount : undefined,
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: CalendarIcon,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
    },
  ]

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed top-0 left-0 bottom-0 z-40 bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl border-r border-orange-200/50 dark:border-stone-800 shadow-[0_10px_30px_rgba(255,87,34,0.06)] flex flex-col justify-between overflow-hidden"
    >
      {/* Sidebar Brand Header */}
      <div>
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-orange-100 dark:border-stone-800">
          <Link href="/" className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <CalendarIcon className="h-5 w-5" />
            </div>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gradient-to-r from-stone-900 via-stone-800 to-[#b02f00] dark:from-white dark:to-orange-400 bg-clip-text text-transparent font-extrabold text-lg tracking-tight truncate"
              >
                ScheduleAI
              </motion.span>
            )}
          </Link>

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-stone-500 hover:text-[#b02f00] hover:bg-orange-100/50 dark:hover:bg-stone-800 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav Items List */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white shadow-md shadow-orange-500/20 scale-[1.02]"
                    : "text-stone-600 dark:text-stone-300 hover:bg-orange-100/60 dark:hover:bg-stone-800/60 hover:text-[#b02f00]"
                } ${collapsed ? "justify-center px-0" : "justify-start"}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-[#ff5722]"}`} />

                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex items-center justify-between min-w-0"
                  >
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-orange-100 text-[#b02f00] dark:bg-orange-950/60 dark:text-orange-400"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.count !== undefined && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </motion.div>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Sidebar Footer User Profile */}
      <div className="p-3 border-t border-orange-100 dark:border-stone-800">
        <div
          className={`flex items-center gap-2.5 p-2 rounded-2xl bg-orange-50/60 dark:bg-stone-800/50 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
            {getInitials(user?.name)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                {user?.name || "Customer"}
              </p>
              <p className="text-[10px] text-stone-500 truncate">{user?.email || "customer@demo.com"}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
