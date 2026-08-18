"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { UserProfile, BookingRow } from "@/components/dashboard/user/types"
import { CustomerSidebar } from "@/components/dashboard/user/sidebar"
import { CustomerHeader } from "@/components/dashboard/user/header"

export default function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [bookingsCount, setBookingsCount] = useState(0)

  // Fetch session user
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else router.push("/login?type=user")
      })
      .catch(() => router.push("/login?type=user"))
  }, [router])

  // Fetch active bookings count for sidebar badge
  useEffect(() => {
    fetch("/api/bookings")
      .then((res) => res.json())
      .then((data) => {
        if (data.bookings && Array.isArray(data.bookings)) {
          const active = data.bookings.filter(
            (b: BookingRow) => b.status !== "cancelled"
          )
          setBookingsCount(active.length)
        }
      })
      .catch(() => {})
  }, [pathname])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  // Derive dynamic header title from pathname
  const getHeaderTitle = () => {
    if (pathname === "/dashboard/user/discover") return "Discover Services"
    if (pathname === "/dashboard/user/bookings") return "My Bookings"
    if (pathname === "/dashboard/user/calendar") return "Weekly View Calendar"
    if (pathname === "/dashboard/user/analytics") return "Booking Analytics"
    return "AI Scheduler"
  }

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden flex bg-[#fff8f4] dark:bg-stone-950 text-stone-900 dark:text-stone-100 relative selection:bg-orange-500/20 selection:text-[#b02f00] font-sans antialiased">
      {/* Ambient background wave */}
      <div className="wavy-bg fixed inset-0 pointer-events-none -z-10 opacity-70" />

      {/* Persistent Collapsible Sidebar */}
      <CustomerSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={user}
        bookingsCount={bookingsCount}
      />

      {/* Main Workspace Layout */}
      <div
        className="flex-1 h-screen max-h-screen flex flex-col min-w-0 overflow-hidden transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 80 : 256 }}
      >
        {/* Top Header */}
        <CustomerHeader
          activeTabLabel={getHeaderTitle()}
          user={user}
          onLogout={handleLogout}
        />

        {/* Dynamic Nested Page Route Content */}
        <main className="flex-1 min-h-0 overflow-hidden p-3.5 sm:p-4 w-full flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
