"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Calendar,
  Users,
  Clock,
  Phone,
  Mail,
  TrendingUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bot,
  LogOut,
  RefreshCw,
  Loader2,
  DollarSign,
  Plus,
  Trash2,
  Edit3,
  Search,
  Filter,
  Download,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Sliders,
  ExternalLink,
  Tag,
  Building2,
  Award,
  BarChart3,
  UserCheck,
  Star,
  MapPin,
  Coffee,
} from "lucide-react"
import Link from "next/link"
import { BookingCalendar } from "@/components/booking-calendar"
import { useToast } from "@/hooks/use-toast"
import type {
  BusinessCategory,
  BookingStatus,
  ClientTag,
  DayOfWeek,
} from "@/types/business"

// ─── Types & Models ───────────────────────────────────────────────────────────

interface RawBooking {
  _id: string
  id?: string
  user_id: string
  user_email: string
  user_name?: string
  service_name: string
  service_id?: string
  provider_id: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  duration_minutes: number
  price?: number
  status: BookingStatus
  notes?: string
  created_at: string
}

interface CalendarDay {
  date: Date
  dateStr: string
  bookings: RawBooking[]
  isToday: boolean
  isCurrentMonth: boolean
  availableSlots: string[]
  isOverride: boolean
}

interface ServiceItem {
  id?: string
  name: string
  price: number
  duration_minutes: number
  description: string
  tags: string[]
  is_active?: boolean
}

interface ProviderProfileData {
  _id?: string
  userId?: string
  name: string
  ownerName?: string
  email?: string
  phone?: string
  category: BusinessCategory | string
  location: string
  description?: string
  rating?: number
  services: ServiceItem[]
  availability: Record<string, string[]>
  search_tags?: string[]
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

// ─── Status UI Helpers ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    completed: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    no_show: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700",
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
    </span>
  )
}

function StatusIcon({ status }: { status: BookingStatus }) {
  switch (status) {
    case "confirmed":
      return <CheckCircle className="h-4 w-4 text-emerald-500" />
    case "pending":
      return <AlertCircle className="h-4 w-4 text-amber-500" />
    case "completed":
      return <Award className="h-4 w-4 text-indigo-500" />
    case "cancelled":
      return <XCircle className="h-4 w-4 text-rose-500" />
    default:
      return <Clock className="h-4 w-4 text-stone-400" />
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const router = useRouter()
  const { toast } = useToast()

  // State: Core entities
  const [profile, setProfile] = useState<ProviderProfileData | null>(null)
  const [bookings, setBookings] = useState<RawBooking[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingBookings, setIsLoadingBookings] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // State: Navigation & Views
  const [activeTab, setActiveTab] = useState<string>("schedule")
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("week")
  const [scheduleDisplayMode, setScheduleDisplayMode] = useState<"calendar" | "table">("calendar")
  const [currentDate, setCurrentDate] = useState(new Date())

  // State: Modals & Selections
  const [selectedBooking, setSelectedBooking] = useState<RawBooking | null>(null)
  const [bookingActionLoading, setBookingActionLoading] = useState(false)
  const [selectedDayOverride, setSelectedDayOverride] = useState<CalendarDay | null>(null)
  const [overrideInputTime, setOverrideInputTime] = useState("")
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<string | null>(null)

  // State: Service modal
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [serviceForm, setServiceForm] = useState<ServiceItem>({
    name: "",
    price: 0,
    duration_minutes: 60,
    description: "",
    tags: [],
    is_active: true,
  })

  // State: Table filters
  const [searchFilter, setSearchFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // State: Slot auto-generator
  const [generatorDay, setGeneratorDay] = useState<DayOfWeek>("monday")
  const [generatorStart, setGeneratorStart] = useState("09:00")
  const [generatorEnd, setGeneratorEnd] = useState("18:00")
  const [generatorInterval, setGeneratorInterval] = useState(60)

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    setIsLoadingProfile(true)
    try {
      const res = await fetch("/api/provider/profile")
      if (!res.ok) {
        if (res.status === 401) router.push("/login")
        return
      }
      const data = await res.json()
      if (data.provider) {
        setProfile({
          ...data.provider,
          userId: data.provider._id || data.provider.id,
          services: data.provider.services || [],
          availability: data.provider.availability || {},
        })
      } else {
        router.push("/login")
      }
    } catch (err) {
      console.error("Failed to fetch provider profile:", err)
    } finally {
      setIsLoadingProfile(false)
    }
  }, [router])

  const fetchBookings = useCallback(async () => {
    setIsLoadingBookings(true)
    try {
      const res = await fetch("/api/bookings")
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings || [])
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err)
    } finally {
      setIsLoadingBookings(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
    fetchBookings()
  }, [fetchProfile, fetchBookings])

  // ─── Actions & Handlers ─────────────────────────────────────────────────────

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  const handleSaveProfile = async (customProfile?: ProviderProfileData) => {
    const dataToSave = customProfile || profile
    if (!dataToSave) return
    setIsSaving(true)
    try {
      const res = await fetch("/api/provider/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      })
      if (res.ok) {
        toast({
          title: "Changes Saved",
          description: "Your business profile and settings are updated.",
        })
        fetchProfile()
      } else {
        const errData = await res.json().catch(() => ({}))
        toast({
          title: "Save Failed",
          description: errData.error || "Could not update profile",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Save Failed",
        description: "Network error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleBookingAction = async (action: "cancel" | "complete") => {
    if (!selectedBooking) return
    setBookingActionLoading(true)
    try {
      const id = selectedBooking._id || selectedBooking.id
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: "Action Failed",
          description: data.error || "Failed to update booking status",
          variant: "destructive",
        })
      } else {
        toast({
          title: action === "cancel" ? "Booking Cancelled" : "Booking Completed",
          description:
            action === "cancel"
              ? "The customer was notified and the slot restored."
              : "Marked appointment as fulfilled.",
        })
        setSelectedBooking(null)
        fetchBookings()
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to communicate with server.",
        variant: "destructive",
      })
    } finally {
      setBookingActionLoading(false)
    }
  }

  // ─── Computed Stats & Metrics ───────────────────────────────────────────────

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])

  const metrics = useMemo(() => {
    const total = bookings.length
    const todayCount = bookings.filter((b) => b.date === todayStr && b.status !== "cancelled").length
    const pendingCount = bookings.filter((b) => b.status === "pending").length
    const completedCount = bookings.filter((b) => b.status === "completed").length
    const confirmedCount = bookings.filter((b) => b.status === "confirmed").length

    const grossRevenue = bookings
      .filter((b) => b.status === "completed" || b.status === "confirmed")
      .reduce((acc, b) => acc + (b.price || 0), 0)

    const averageOrderValue =
      completedCount + confirmedCount > 0
        ? Math.round(grossRevenue / (completedCount + confirmedCount))
        : 0

    return {
      total,
      todayCount,
      pendingCount,
      completedCount,
      confirmedCount,
      grossRevenue,
      averageOrderValue,
    }
  }, [bookings, todayStr])

  // ─── Client CRM Aggregation ─────────────────────────────────────────────────

  const clientCRMList = useMemo(() => {
    const clientMap = new Map<
      string,
      {
        email: string
        name: string
        totalBookings: number
        completedBookings: number
        totalSpend: number
        lastBookingDate: string
        firstBookingDate: string
        services: Set<string>
        tag: ClientTag
      }
    >()

    for (const b of bookings) {
      if (!b.user_email) continue
      const existing = clientMap.get(b.user_email)
      const price = b.price || 0
      const isCompletedOrConfirmed = b.status === "completed" || b.status === "confirmed"

      if (!existing) {
        clientMap.set(b.user_email, {
          email: b.user_email,
          name: b.user_name || b.user_email.split("@")[0],
          totalBookings: 1,
          completedBookings: b.status === "completed" ? 1 : 0,
          totalSpend: isCompletedOrConfirmed ? price : 0,
          lastBookingDate: b.date,
          firstBookingDate: b.date,
          services: new Set([b.service_name]),
          tag: "New",
        })
      } else {
        existing.totalBookings += 1
        if (b.status === "completed") existing.completedBookings += 1
        if (isCompletedOrConfirmed) existing.totalSpend += price
        if (b.date > existing.lastBookingDate) existing.lastBookingDate = b.date
        if (b.date < existing.firstBookingDate) existing.firstBookingDate = b.date
        existing.services.add(b.service_name)
      }
    }

    // Determine tags
    return Array.from(clientMap.values()).map((client) => {
      let tag: ClientTag = "New"
      if (client.totalSpend >= 3000 || client.totalBookings >= 4) {
        tag = "VIP"
      } else if (client.totalBookings >= 2) {
        tag = "Regular"
      }
      return {
        ...client,
        tag,
        servicesList: Array.from(client.services),
      }
    })
  }, [bookings])

  // ─── Calendar Generator ─────────────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = []
    const today = new Date()
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const startOfWeek = new Date(startOfMonth)
    startOfWeek.setDate(startOfMonth.getDate() - startOfMonth.getDay())

    for (let i = 0; i < 42; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const dateStr = date.toISOString().split("T")[0]

      const dayBookings = bookings.filter(
        (b) => b.date === dateStr && b.status !== "cancelled"
      )
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()

      let availableSlots: string[] = []
      let isOverride = false

      if (profile?.availability) {
        if (profile.availability[dateStr]) {
          availableSlots = profile.availability[dateStr]
          isOverride = true
        } else if (profile.availability[dayName]) {
          availableSlots = profile.availability[dayName]
        }
      }

      days.push({
        date,
        dateStr,
        bookings: dayBookings,
        isToday:
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear(),
        isCurrentMonth: date.getMonth() === currentDate.getMonth(),
        availableSlots,
        isOverride,
      })
    }
    return days
  }, [currentDate, bookings, profile])

  const weekDays = useMemo(() => {
    const start = new Date(currentDate)
    start.setDate(currentDate.getDate() - currentDate.getDay())
    start.setHours(12, 0, 0, 0)
    const today = new Date()

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const dateStr = date.toISOString().split("T")[0]
      const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
        date.getDay()
      ]
      const availability = profile?.availability || {}
      const isOverride = Boolean(availability[dateStr])
      const availableSlots = isOverride
        ? availability[dateStr] || []
        : availability[dayName] || []

      return {
        date,
        dateStr,
        bookings: bookings.filter((b) => b.date === dateStr && b.status !== "cancelled"),
        isToday:
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear(),
        isCurrentMonth: date.getMonth() === currentDate.getMonth(),
        availableSlots,
        isOverride,
      } as CalendarDay
    })
  }, [currentDate, bookings, profile])

  const daySelectedDateStr = currentDate.toISOString().split("T")[0]
  const singleDayBookings = useMemo(
    () => bookings.filter((b) => b.date === daySelectedDateStr && b.status !== "cancelled"),
    [bookings, daySelectedDateStr]
  )

  const upcomingBookings = useMemo(() => {
    return bookings
      .filter((b) => b.date >= todayStr && b.status !== "cancelled")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 6)
  }, [bookings, todayStr])

  // Table filter
  const filteredTableBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        searchFilter === "" ||
        b.user_email.toLowerCase().includes(searchFilter.toLowerCase()) ||
        b.service_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (b.user_name && b.user_name.toLowerCase().includes(searchFilter.toLowerCase()))
      const matchesStatus = statusFilter === "all" || b.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [bookings, searchFilter, statusFilter])

  // ─── Availability Handlers ──────────────────────────────────────────────────

  const toggleDayAvailability = (day: string) => {
    if (!profile) return
    const av = { ...(profile.availability || {}) }
    if (av[day]) {
      delete av[day]
    } else {
      av[day] = ["09:00", "11:00", "14:00", "16:00"]
    }
    setProfile({ ...profile, availability: av })
  }

  const handleAddSlot = (day: string, time: string) => {
    if (!profile || !time) return
    const av = { ...(profile.availability || {}) }
    if (!av[day]) av[day] = []
    if (!av[day].includes(time)) {
      av[day] = [...av[day], time].sort()
    }
    setProfile({ ...profile, availability: av })
  }

  const handleRemoveSlot = (day: string, time: string) => {
    if (!profile) return
    const av = { ...(profile.availability || {}) }
    if (av[day]) {
      av[day] = av[day].filter((t) => t !== time)
    }
    setProfile({ ...profile, availability: av })
  }

  const handleRunSlotGenerator = () => {
    if (!profile) return
    const [startH, startM] = generatorStart.split(":").map(Number)
    const [endH, endM] = generatorEnd.split(":").map(Number)
    const slots: string[] = []

    let currentMinutes = startH * 60 + startM
    const totalEndMinutes = endH * 60 + endM

    while (currentMinutes < totalEndMinutes) {
      const h = Math.floor(currentMinutes / 60)
      const m = currentMinutes % 60
      const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      slots.push(formatted)
      currentMinutes += generatorInterval
    }

    const av = { ...(profile.availability || {}) }
    av[generatorDay] = slots
    setProfile({ ...profile, availability: av })
    toast({
      title: "Schedule Generated",
      description: `Populated ${slots.length} slots for ${generatorDay}.`,
    })
  }

  const handleCopyScheduleToAllWeekdays = (sourceDay: DayOfWeek) => {
    if (!profile) return
    const sourceSlots = profile.availability?.[sourceDay] || []
    const av = { ...(profile.availability || {}) }
    ;["monday", "tuesday", "wednesday", "thursday", "friday"].forEach((d) => {
      av[d] = [...sourceSlots]
    })
    setProfile({ ...profile, availability: av })
    toast({
      title: "Schedule Copied",
      description: `Applied ${sourceDay}'s hours to all weekdays (Mon-Fri).`,
    })
  }

  // Override handlers
  const handleAddOverrideSlot = () => {
    if (!profile || !selectedDayOverride || !overrideInputTime) return
    const dateStr = selectedDayOverride.dateStr
    const av = { ...(profile.availability || {}) }
    if (!av[dateStr]) av[dateStr] = []
    if (!av[dateStr].includes(overrideInputTime)) {
      av[dateStr] = [...av[dateStr], overrideInputTime].sort()
    }
    setProfile({ ...profile, availability: av })
    setOverrideInputTime("")
  }

  const handleRemoveOverrideSlot = (time: string) => {
    if (!profile || !selectedDayOverride) return
    const dateStr = selectedDayOverride.dateStr
    const av = { ...(profile.availability || {}) }
    if (av[dateStr]) {
      av[dateStr] = av[dateStr].filter((t) => t !== time)
    }
    setProfile({ ...profile, availability: av })
  }

  const handleClearOverride = () => {
    if (!profile || !selectedDayOverride) return
    const dateStr = selectedDayOverride.dateStr
    const av = { ...(profile.availability || {}) }
    delete av[dateStr]
    setProfile({ ...profile, availability: av })
    setSelectedDayOverride(null)
  }

  // ─── Service CRUD Handlers ──────────────────────────────────────────────────

  const handleOpenNewServiceModal = () => {
    setEditingServiceIndex(null)
    setServiceForm({
      name: "",
      price: 500,
      duration_minutes: 45,
      description: "",
      tags: [],
      is_active: true,
    })
    setServiceModalOpen(true)
  }

  const handleOpenEditServiceModal = (index: number) => {
    if (!profile || !profile.services[index]) return
    setEditingServiceIndex(index)
    setServiceForm({ ...profile.services[index] })
    setServiceModalOpen(true)
  }

  const handleSaveServiceModal = () => {
    if (!profile || !serviceForm.name.trim()) return
    const updated = [...profile.services]
    if (editingServiceIndex !== null) {
      updated[editingServiceIndex] = { ...serviceForm }
    } else {
      updated.push({ ...serviceForm })
    }
    setProfile({ ...profile, services: updated })
    setServiceModalOpen(false)
    toast({
      title: editingServiceIndex !== null ? "Service Updated" : "Service Added",
      description: "Click Save Changes at the bottom to publish.",
    })
  }

  const handleDeleteService = (index: number) => {
    if (!profile) return
    const updated = [...profile.services]
    updated.splice(index, 1)
    setProfile({ ...profile, services: updated })
    toast({ title: "Service Removed" })
  }

  // Export CSV
  const handleExportCSV = () => {
    if (bookings.length === 0) {
      toast({ title: "No Bookings", description: "Nothing to export yet." })
      return
    }
    const headers = "ID,Date,Time,Client Email,Service,Duration Min,Price,Status\n"
    const rows = bookings
      .map(
        (b) =>
          `"${b._id || b.id}","${b.date}","${b.time}","${b.user_email}","${b.service_name}",${b.duration_minutes},${b.price || 0},"${b.status}"`
      )
      .join("\n")
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `scheduleai-bookings-${todayStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#fff8f4] dark:bg-stone-950 text-stone-900 dark:text-stone-100 pb-20">
      {/* ── Top Navigation Bar ────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-40 w-full border-b border-amber-200/50 dark:border-stone-800 bg-[#fff8f4]/90 dark:bg-stone-950/90 backdrop-blur-md"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center space-x-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-sm shadow-orange-500/20 text-white font-bold">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-stone-900 dark:text-white leading-tight">
                  ScheduleAI
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold tracking-wider uppercase">
                  Business Portal
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {profile && (
              <div className="flex items-center gap-2.5 bg-white/70 dark:bg-stone-900/70 border border-amber-200/60 dark:border-stone-800 rounded-full px-3 py-1.5 shadow-xs">
                <Avatar className="h-7 w-7 border border-orange-200 dark:border-orange-900">
                  <AvatarFallback className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 text-xs font-bold">
                    {profile.name?.charAt(0)?.toUpperCase() || "B"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold leading-tight truncate max-w-[140px]">
                    {profile.name}
                  </span>
                  <span className="text-[10px] text-stone-500 leading-tight">
                    {profile.category || "Provider"}
                  </span>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-amber-200 dark:border-stone-800 text-xs gap-1.5 hidden md:flex hover:bg-orange-50 dark:hover:bg-orange-950/30"
              onClick={() => {
                if (profile?.name) {
                  window.open(`/dashboard/user/discover?search=${encodeURIComponent(profile.name)}`, "_blank")
                }
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 text-orange-600" />
              Public Storefront
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-full h-8 w-8 p-0 text-stone-600 hover:text-stone-900 hover:bg-amber-100/50 dark:hover:bg-stone-800"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* ── Main Container ────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 max-w-7xl pt-6">
        {/* Operations KPI Ribbon */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          {[
            {
              label: "Total Bookings",
              value: metrics.total,
              sub: "All-time customer volume",
              icon: CalendarDays,
              color: "text-orange-600 dark:text-orange-400",
              bgColor: "bg-orange-50 dark:bg-orange-950/40",
            },
            {
              label: "Today's Agenda",
              value: metrics.todayCount,
              sub: "Scheduled for today",
              icon: Clock,
              color: "text-amber-600 dark:text-amber-400",
              bgColor: "bg-amber-50 dark:bg-amber-950/40",
            },
            {
              label: "Pending Approvals",
              value: metrics.pendingCount,
              sub: "Require action",
              icon: AlertCircle,
              color: "text-yellow-600 dark:text-yellow-400",
              bgColor: "bg-yellow-50 dark:bg-yellow-950/40",
            },
            {
              label: "Realized Revenue",
              value: `₹${metrics.grossRevenue.toLocaleString("en-IN")}`,
              sub: `Avg. ticket ₹${metrics.averageOrderValue}`,
              icon: DollarSign,
              color: "text-emerald-600 dark:text-emerald-400",
              bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
            },
          ].map(({ label, value, sub, icon: Icon, color, bgColor }) => (
            <Card
              key={label}
              className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                      {isLoadingBookings ? (
                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                      ) : (
                        value
                      )}
                    </p>
                    <p className="text-[11px] text-stone-400 leading-tight">{sub}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${bgColor}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* ── Main Dashboard Tabs Navigation ──────────────────────────────── */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-200/50 dark:border-stone-800 pb-3">
            <TabsList className="bg-amber-100/60 dark:bg-stone-900 p-1 rounded-xl h-auto flex flex-wrap gap-1 max-w-full">
              <TabsTrigger
                value="schedule"
                className="rounded-lg text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-xs"
              >
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Schedule & Bookings
              </TabsTrigger>
              <TabsTrigger
                value="availability"
                className="rounded-lg text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-xs"
              >
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Availability & Shifts
              </TabsTrigger>
              <TabsTrigger
                value="services"
                className="rounded-lg text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-xs"
              >
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                Service Catalog & AI Tags
              </TabsTrigger>
              <TabsTrigger
                value="crm"
                className="rounded-lg text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-xs"
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Client CRM
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="rounded-lg text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-xs"
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Analytics & Revenue
              </TabsTrigger>
              <TabsTrigger
                value="profile"
                className="rounded-lg text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-stone-800 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-xs"
              >
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Business Profile
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchBookings}
                disabled={isLoadingBookings}
                className="h-8 rounded-lg text-xs border-amber-200 dark:border-stone-800 gap-1"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoadingBookings ? "animate-spin text-orange-500" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: SCHEDULE & BOOKINGS
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="schedule" className="mt-0 space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Main Interactive Calendar / Table */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
                  <CardHeader className="pb-3 border-b border-amber-100 dark:border-stone-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-orange-600" />
                        <CardTitle className="text-base font-bold">
                          Booking Calendar & Agenda
                        </CardTitle>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Table vs Calendar Toggle */}
                        <div className="flex bg-amber-100/60 dark:bg-stone-800 p-0.5 rounded-lg text-xs">
                          <button
                            type="button"
                            onClick={() => setScheduleDisplayMode("calendar")}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                              scheduleDisplayMode === "calendar"
                                ? "bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-300 shadow-xs"
                                : "text-stone-600 dark:text-stone-400"
                            }`}
                          >
                            Calendar
                          </button>
                          <button
                            type="button"
                            onClick={() => setScheduleDisplayMode("table")}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                              scheduleDisplayMode === "table"
                                ? "bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-300 shadow-xs"
                                : "text-stone-600 dark:text-stone-400"
                            }`}
                          >
                            Table View
                          </button>
                        </div>

                        {scheduleDisplayMode === "calendar" && (
                          <Select
                            value={calendarView}
                            onValueChange={(v: "day" | "week" | "month") => setCalendarView(v)}
                          >
                            <SelectTrigger className="w-24 h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">Day</SelectItem>
                              <SelectItem value="week">Week</SelectItem>
                              <SelectItem value="month">Month</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Date Navigation Bar */}
                    {scheduleDisplayMode === "calendar" && (
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-full"
                            onClick={() => {
                              const d = new Date(currentDate)
                              if (calendarView === "day") d.setDate(d.getDate() - 1)
                              else if (calendarView === "week") d.setDate(d.getDate() - 7)
                              else d.setMonth(d.getMonth() - 1)
                              setCurrentDate(d)
                            }}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-bold min-w-[140px] text-center">
                            {currentDate.toLocaleDateString("en-US", {
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-full"
                            onClick={() => {
                              const d = new Date(currentDate)
                              if (calendarView === "day") d.setDate(d.getDate() + 1)
                              else if (calendarView === "week") d.setDate(d.getDate() + 7)
                              else d.setMonth(d.getMonth() + 1)
                              setCurrentDate(d)
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-medium"
                          onClick={() => setCurrentDate(new Date())}
                        >
                          Today
                        </Button>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="pt-4">
                    {/* ── View A: Table View ────────────────────────────── */}
                    {scheduleDisplayMode === "table" && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                          <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
                            <Input
                              placeholder="Search client or service..."
                              value={searchFilter}
                              onChange={(e) => setSearchFilter(e.target.value)}
                              className="pl-8 h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800"
                            />
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                              <SelectTrigger className="w-32 h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800">
                                <SelectValue placeholder="All Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleExportCSV}
                              className="h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800 gap-1"
                            >
                              <Download className="h-3 w-3" />
                              Export CSV
                            </Button>
                          </div>
                        </div>

                        <div className="border border-amber-200/50 dark:border-stone-800 rounded-xl overflow-hidden">
                          <div className="overflow-x-auto max-h-[420px]">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-amber-100/40 dark:bg-stone-800/60 border-b border-amber-200/50 dark:border-stone-800 sticky top-0">
                                <tr>
                                  <th className="p-3 font-semibold">Date & Time</th>
                                  <th className="p-3 font-semibold">Client</th>
                                  <th className="p-3 font-semibold">Service</th>
                                  <th className="p-3 font-semibold">Duration</th>
                                  <th className="p-3 font-semibold">Price</th>
                                  <th className="p-3 font-semibold">Status</th>
                                  <th className="p-3 font-semibold text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-100 dark:divide-stone-800">
                                {filteredTableBookings.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="p-8 text-center text-stone-400">
                                      No appointments match your filters.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredTableBookings.map((b) => (
                                    <tr
                                      key={b._id || b.id}
                                      className="hover:bg-amber-50/50 dark:hover:bg-stone-800/40 transition-colors cursor-pointer"
                                      onClick={() => setSelectedBooking(b)}
                                    >
                                      <td className="p-3 font-medium">
                                        <div>{b.date}</div>
                                        <div className="text-[11px] text-stone-500">{b.time}</div>
                                      </td>
                                      <td className="p-3">
                                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                                          {b.user_name || b.user_email.split("@")[0]}
                                        </div>
                                        <div className="text-[11px] text-stone-500 truncate max-w-[140px]">
                                          {b.user_email}
                                        </div>
                                      </td>
                                      <td className="p-3 font-medium">{b.service_name}</td>
                                      <td className="p-3 text-stone-500">
                                        {b.duration_minutes}m
                                      </td>
                                      <td className="p-3 font-semibold text-stone-900 dark:text-stone-100">
                                        ₹{b.price || 0}
                                      </td>
                                      <td className="p-3">
                                        <StatusBadge status={b.status} />
                                      </td>
                                      <td className="p-3 text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-xs text-orange-600 hover:text-orange-700"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedBooking(b)
                                          }}
                                        >
                                          Manage
                                        </Button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── View B: Month View ────────────────────────────── */}
                    {scheduleDisplayMode === "calendar" && calendarView === "month" && (
                      <div className="grid grid-cols-7 gap-1.5">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                          <div
                            key={d}
                            className="p-1.5 text-center text-xs font-bold text-stone-500"
                          >
                            {d}
                          </div>
                        ))}
                        {calendarDays.map((day, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.003 }}
                            onClick={() => setSelectedDayOverride(day)}
                            className={`min-h-[82px] p-2 border rounded-xl cursor-pointer hover:bg-orange-50/50 dark:hover:bg-stone-800/50 transition-all ${
                              day.isToday
                                ? "bg-orange-50/70 border-orange-400 dark:bg-orange-950/30 dark:border-orange-600"
                                : "border-amber-200/50 dark:border-stone-800"
                            } ${!day.isCurrentMonth ? "opacity-35" : ""}`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                              <span>{day.date.getDate()}</span>
                              {day.isOverride && (
                                <span title="Custom date override active" className="text-amber-500 text-xs">
                                  ⭐
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {day.bookings.slice(0, 2).map((b) => (
                                <div
                                  key={b._id || b.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedBooking(b)
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200 font-medium truncate cursor-pointer hover:bg-orange-200"
                                >
                                  {b.time} {b.service_name}
                                </div>
                              ))}
                              {day.bookings.length > 2 && (
                                <div className="text-[10px] font-semibold text-stone-500">
                                  +{day.bookings.length - 2} more
                                </div>
                              )}
                              {day.availableSlots.length > 0 && day.bookings.length === 0 && (
                                <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded px-1 py-0.5 inline-block">
                                  {day.availableSlots.length} slots
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* ── View C: Week View ─────────────────────────────── */}
                    {scheduleDisplayMode === "calendar" && calendarView === "week" && (
                      <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ y: 8, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.03 }}
                            onClick={() => {
                              setCurrentDate(day.date)
                              setSelectedDayOverride(day)
                            }}
                            className={`p-3 border rounded-xl cursor-pointer hover:bg-orange-50/40 dark:hover:bg-stone-800/40 transition-all ${
                              day.isToday
                                ? "bg-orange-50/60 border-orange-400 shadow-xs dark:bg-orange-950/30"
                                : "border-amber-200/50 dark:border-stone-800"
                            }`}
                          >
                            <div className="text-center pb-2 border-b border-amber-100 dark:border-stone-800 mb-2">
                              <div className="text-[11px] font-bold uppercase text-stone-500">
                                {day.date.toLocaleDateString("en-US", { weekday: "short" })}
                              </div>
                              <div
                                className={`text-lg font-black ${
                                  day.isToday ? "text-orange-600 dark:text-orange-400" : ""
                                }`}
                              >
                                {day.date.getDate()}
                              </div>
                            </div>

                            <div className="space-y-1.5 min-h-[90px]">
                              {day.bookings.map((b) => (
                                <div
                                  key={b._id || b.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedBooking(b)
                                  }}
                                  className="text-[10px] p-1.5 rounded-lg bg-orange-100 text-orange-900 dark:bg-orange-950/70 dark:text-orange-200 font-medium cursor-pointer hover:bg-orange-200 shadow-2xs"
                                >
                                  <div className="font-bold flex items-center justify-between">
                                    <span>{b.time}</span>
                                    <StatusIcon status={b.status} />
                                  </div>
                                  <div className="truncate">{b.service_name}</div>
                                </div>
                              ))}

                              {day.availableSlots.length > 0 && day.bookings.length === 0 && (
                                <div className="text-[10px] p-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-center font-medium">
                                  {day.isOverride ? "⭐ " : ""}
                                  {day.availableSlots.length} open slot
                                  {day.availableSlots.length !== 1 && "s"}
                                </div>
                              )}

                              {day.bookings.length === 0 && day.availableSlots.length === 0 && (
                                <div className="text-[10px] text-stone-400 text-center py-4 italic">
                                  Closed
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* ── View D: Day View ──────────────────────────────── */}
                    {scheduleDisplayMode === "calendar" && calendarView === "day" && (
                      <div className="space-y-3">
                        <div className="text-center pb-3 border-b border-amber-100 dark:border-stone-800">
                          <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                            {currentDate.toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </h3>
                          <p className="text-xs text-stone-500">
                            {singleDayBookings.length} booking
                            {singleDayBookings.length !== 1 && "s"} scheduled
                          </p>
                        </div>

                        {singleDayBookings.length > 0 ? (
                          <div className="space-y-2.5">
                            {singleDayBookings.map((b) => (
                              <motion.div
                                key={b._id || b.id}
                                whileHover={{ scale: 1.005 }}
                                onClick={() => setSelectedBooking(b)}
                                className="p-4 border border-amber-200/60 dark:border-stone-800 rounded-xl bg-white/70 dark:bg-stone-900/60 hover:shadow-xs cursor-pointer transition-all flex items-center justify-between"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                                      {b.service_name}
                                    </span>
                                    <StatusBadge status={b.status} />
                                  </div>
                                  <div className="text-xs text-stone-500 flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span>{b.user_email}</span>
                                    <span>·</span>
                                    <span>{b.duration_minutes} mins</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-base text-orange-600 dark:text-orange-400">
                                    {b.time}
                                  </div>
                                  <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                                    ₹{b.price || 0}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-stone-400">
                            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-medium">No appointments on this date</p>
                            <p className="text-xs">
                              Click above to inspect slots or manage overrides.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Col: Internal Calendar Sync & Upcoming Agenda */}
              <div className="space-y-6">
                <BookingCalendar userType="client" onEventSync={() => {}} />

                {/* Upcoming appointments list */}
                <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                      <span>Upcoming Appointments</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Next {upcomingBookings.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64 pr-2">
                      {upcomingBookings.length === 0 ? (
                        <div className="text-center py-8 text-stone-400">
                          <Users className="h-8 w-8 mx-auto mb-1.5 opacity-30" />
                          <p className="text-xs">No upcoming customer bookings</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {upcomingBookings.map((b) => (
                            <div
                              key={b._id || b.id}
                              onClick={() => setSelectedBooking(b)}
                              className="p-3 border border-amber-100 dark:border-stone-800 rounded-xl hover:bg-amber-50/40 dark:hover:bg-stone-800/40 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                                  {new Date(b.date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}{" "}
                                  · {b.time}
                                </span>
                                <StatusBadge status={b.status} />
                              </div>
                              <div className="text-xs font-semibold truncate text-stone-900 dark:text-stone-100">
                                {b.service_name}
                              </div>
                              <div className="text-[11px] text-stone-500 truncate">
                                {b.user_email}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: AVAILABILITY & SHIFTS
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="availability" className="mt-0 space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: 7-Day Weekly Recurring Schedule */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold">
                          Weekly Recurring Hours & Shifts
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Configure your standard bookable hours. The AI assistant and
                          public scheduling page book appointments within these slots.
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSaveProfile()}
                        disabled={isSaving}
                        className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs gap-1.5 self-start sm:self-auto"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        Save Availability
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {DAYS_OF_WEEK.map((day) => {
                      const isActive = Boolean(profile?.availability?.[day])
                      const slots = profile?.availability?.[day] || []

                      return (
                        <div
                          key={day}
                          className={`p-4 border rounded-xl transition-all ${
                            isActive
                              ? "bg-white/60 dark:bg-stone-900/50 border-amber-200/60 dark:border-stone-800"
                              : "bg-stone-100/40 dark:bg-stone-900/20 border-dashed border-stone-300 dark:border-stone-800 opacity-70"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={isActive}
                                onCheckedChange={() => toggleDayAvailability(day)}
                              />
                              <span className="font-bold text-sm capitalize">{day}</span>
                              <span className="text-xs text-stone-500">
                                {isActive ? `${slots.length} slots active` : "Closed"}
                              </span>
                            </div>

                            {isActive && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[11px] text-stone-500 hover:text-orange-600"
                                  onClick={() => handleCopyScheduleToAllWeekdays(day)}
                                >
                                  Copy to Mon-Fri
                                </Button>
                              </div>
                            )}
                          </div>

                          {isActive && (
                            <div className="space-y-3 pt-2 border-t border-amber-100 dark:border-stone-800">
                              {slots.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {slots.map((time) => (
                                    <div
                                      key={time}
                                      className="flex items-center gap-1.5 bg-orange-100/70 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
                                    >
                                      <span>{time}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSlot(day, time)}
                                        className="hover:text-rose-600 rounded-full p-0.5"
                                        title="Remove slot"
                                      >
                                        <XCircle className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-stone-400 italic">
                                  No slots added yet. Use generator or add custom slots below.
                                </p>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                <Input
                                  type="time"
                                  id={`time-input-${day}`}
                                  className="w-32 h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800"
                                />
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 text-xs rounded-lg"
                                  onClick={() => {
                                    const input = document.getElementById(
                                      `time-input-${day}`
                                    ) as HTMLInputElement
                                    if (input?.value) {
                                      handleAddSlot(day, input.value)
                                      input.value = ""
                                    }
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Add Time
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Right Col: Smart Slot Interval Generator & Rules */}
              <div className="space-y-6">
                <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-orange-600" />
                      Shift Interval Auto-Generator
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Automatically generate hourly or 30-min booking intervals for a day.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                        Target Day
                      </label>
                      <Select
                        value={generatorDay}
                        onValueChange={(v: DayOfWeek) => setGeneratorDay(v)}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((d) => (
                            <SelectItem key={d} value={d} className="capitalize text-xs">
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                          Start Time
                        </label>
                        <Input
                          type="time"
                          value={generatorStart}
                          onChange={(e) => setGeneratorStart(e.target.value)}
                          className="h-8 text-xs rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                          End Time
                        </label>
                        <Input
                          type="time"
                          value={generatorEnd}
                          onChange={(e) => setGeneratorEnd(e.target.value)}
                          className="h-8 text-xs rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                        Interval Duration
                      </label>
                      <Select
                        value={String(generatorInterval)}
                        onValueChange={(v) => setGeneratorInterval(Number(v))}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">60 minutes (1 hour)</SelectItem>
                          <SelectItem value="90">90 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      className="w-full h-8 text-xs rounded-lg bg-orange-600 hover:bg-orange-700 text-white mt-2"
                      onClick={handleRunSlotGenerator}
                    >
                      Generate Shifts
                    </Button>
                  </CardContent>
                </Card>

                {/* Overrides Overview */}
                <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-amber-500" />
                      Active Date Overrides
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Single-date exceptions that supersede standard weekly schedules.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const overrides = Object.keys(profile?.availability || {}).filter(
                        (k) => /^\d{4}-\d{2}-\d{2}$/.test(k)
                      )

                      if (overrides.length === 0) {
                        return (
                          <div className="text-center py-6 text-stone-400 text-xs italic">
                            No special date overrides active. Click any date on the calendar
                            to add one.
                          </div>
                        )
                      }

                      return (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {overrides.map((d) => (
                            <div
                              key={d}
                              className="p-2.5 border border-amber-200/60 dark:border-stone-800 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold">{d}</span>
                                <div className="text-[11px] text-stone-500">
                                  {profile?.availability[d]?.length || 0} special slots
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] text-rose-600 hover:text-rose-700"
                                onClick={() => {
                                  const av = { ...(profile?.availability || {}) }
                                  delete av[d]
                                  setProfile(profile ? { ...profile, availability: av } : null)
                                }}
                              >
                                Clear
                              </Button>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: SERVICE CATALOG & AI TAGS
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="services" className="mt-0 space-y-6">
            <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 dark:border-stone-800 pb-4">
                <div>
                  <CardTitle className="text-base font-bold">
                    Service Catalog & AI Semantic Search Tags
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Define the services you offer. AI tags are automatically indexed into
                    Amazon Bedrock and Gemini RAG pipelines so customers can discover and
                    book your offerings via voice and chat.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs gap-1.5"
                    onClick={handleOpenNewServiceModal}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Service
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveProfile()}
                    disabled={isSaving}
                    className="rounded-xl text-xs border-amber-200 dark:border-stone-800"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {profile?.services?.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-amber-200 dark:border-stone-800 rounded-2xl">
                    <Tag className="h-10 w-10 text-stone-400 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold">No services in catalog</p>
                    <p className="text-xs text-stone-500 mb-4">
                      Create your first service so customers can book specific treatments.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleOpenNewServiceModal}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-xl"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Create Service
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {profile?.services?.map((svc, idx) => (
                      <div
                        key={idx}
                        className="p-4 border border-amber-200/60 dark:border-stone-800 rounded-2xl bg-white/60 dark:bg-stone-900/40 hover:shadow-sm transition-shadow flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                                {svc.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-extrabold text-orange-600 dark:text-orange-400">
                                  ₹{svc.price}
                                </span>
                                <span className="text-xs text-stone-400">·</span>
                                <span className="text-xs text-stone-500">
                                  {svc.duration_minutes} mins
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 rounded-full text-stone-500 hover:text-stone-900"
                                onClick={() => handleOpenEditServiceModal(idx)}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => handleDeleteService(idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                            {svc.description || "No description provided."}
                          </p>

                          {/* AI Semantic Tags */}
                          <div className="pt-2">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                              AI Intent Tags
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {svc.tags && svc.tags.length > 0 ? (
                                svc.tags.map((t, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="text-[10px] bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 px-2 py-0.5 rounded-full font-medium"
                                  >
                                    #{t}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-stone-400 italic">
                                  No AI tags added
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4: CLIENT CRM
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="crm" className="mt-0 space-y-6">
            <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
              <CardHeader className="border-b border-amber-100 dark:border-stone-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold">
                      Customer Relationship Directory (CRM)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Aggregate database of all customers who have booked your business.
                      Tracks lifetime spend, visit frequency, and segmentation.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs self-start sm:self-auto">
                    {clientCRMList.length} Unique Clients
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {clientCRMList.length === 0 ? (
                  <div className="text-center py-16 text-stone-400">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No customer records yet</p>
                    <p className="text-xs">
                      When customers book appointments with your business, they appear here.
                    </p>
                  </div>
                ) : (
                  <div className="border border-amber-200/50 dark:border-stone-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-amber-100/40 dark:bg-stone-800/60 border-b border-amber-200/50 dark:border-stone-800">
                          <tr>
                            <th className="p-3 font-semibold">Client Name</th>
                            <th className="p-3 font-semibold">Contact Email</th>
                            <th className="p-3 font-semibold">Segmentation</th>
                            <th className="p-3 font-semibold">Total Visits</th>
                            <th className="p-3 font-semibold">Lifetime Spend</th>
                            <th className="p-3 font-semibold">Last Visit</th>
                            <th className="p-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 dark:divide-stone-800">
                          {clientCRMList.map((client) => (
                            <tr
                              key={client.email}
                              className="hover:bg-amber-50/50 dark:hover:bg-stone-800/40 transition-colors"
                            >
                              <td className="p-3 font-bold text-stone-900 dark:text-stone-100">
                                {client.name}
                              </td>
                              <td className="p-3 text-stone-600 dark:text-stone-400">
                                {client.email}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    client.tag === "VIP"
                                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                      : client.tag === "Regular"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                      : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                                  }`}
                                >
                                  {client.tag}
                                </span>
                              </td>
                              <td className="p-3 font-semibold">{client.totalBookings}</td>
                              <td className="p-3 font-bold text-orange-600 dark:text-orange-400">
                                ₹{client.totalSpend.toLocaleString("en-IN")}
                              </td>
                              <td className="p-3 text-stone-500">{client.lastBookingDate}</td>
                              <td className="p-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-orange-600 hover:text-orange-700"
                                  onClick={() => setSelectedClientForHistory(client.email)}
                                >
                                  History
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 5: REVENUE & ANALYTICS
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="analytics" className="mt-0 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Financial Metrics Summary */}
              <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Revenue Trajectory
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Realized income and pipeline performance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Total Realized Revenue
                    </p>
                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                      ₹{metrics.grossRevenue.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">
                      From {metrics.completedCount + metrics.confirmedCount} fulfilled and confirmed
                      appointments.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-amber-200/50 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50">
                      <p className="text-xs text-stone-500">Average Order Value</p>
                      <p className="text-lg font-bold mt-1">₹{metrics.averageOrderValue}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-amber-200/50 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50">
                      <p className="text-xs text-stone-500">Completion Rate</p>
                      <p className="text-lg font-bold mt-1">
                        {metrics.total > 0
                          ? Math.round(
                              ((metrics.completedCount + metrics.confirmedCount) / metrics.total) *
                                100
                            )
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                    Appointment Status Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Operational fulfillment health
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      label: "Confirmed",
                      count: metrics.confirmedCount,
                      color: "bg-emerald-500",
                    },
                    {
                      label: "Completed",
                      count: metrics.completedCount,
                      color: "bg-indigo-500",
                    },
                    {
                      label: "Pending",
                      count: metrics.pendingCount,
                      color: "bg-amber-500",
                    },
                    {
                      label: "Cancelled",
                      count: bookings.filter((b) => b.status === "cancelled").length,
                      color: "bg-rose-500",
                    },
                  ].map(({ label, count, color }) => {
                    const percentage = metrics.total > 0 ? (count / metrics.total) * 100 : 0
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>{label}</span>
                          <span className="text-stone-500">
                            {count} ({Math.round(percentage)}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} rounded-full`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 6: BUSINESS PROFILE
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="profile" className="mt-0 space-y-6">
            <Card className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-amber-200/60 dark:border-stone-800 shadow-xs rounded-2xl">
              <CardHeader className="border-b border-amber-100 dark:border-stone-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold">
                      Business Identity & Storefront Information
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Public business profile displayed to customers on the ScheduleAI Marketplace.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs gap-1.5 self-start sm:self-auto"
                    onClick={() => handleSaveProfile()}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Save Profile
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {profile && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                          Business Name
                        </label>
                        <Input
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          className="rounded-xl border-amber-200 dark:border-stone-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                          Primary Category
                        </label>
                        <Select
                          value={profile.category || "General"}
                          onValueChange={(v) => setProfile({ ...profile, category: v })}
                        >
                          <SelectTrigger className="rounded-xl border-amber-200 dark:border-stone-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Beauty & Hair">Beauty & Hair</SelectItem>
                            <SelectItem value="Fitness">Fitness</SelectItem>
                            <SelectItem value="Healthcare">Healthcare</SelectItem>
                            <SelectItem value="Wellness & Spa">Wellness & Spa</SelectItem>
                            <SelectItem value="Dental">Dental</SelectItem>
                            <SelectItem value="Legal">Legal</SelectItem>
                            <SelectItem value="Consulting">Consulting</SelectItem>
                            <SelectItem value="Education">Education</SelectItem>
                            <SelectItem value="Home Services">Home Services</SelectItem>
                            <SelectItem value="General">General</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                          Location / Operating Address
                        </label>
                        <Input
                          value={profile.location || ""}
                          placeholder="e.g. Koramangala 5th Block, Bangalore"
                          onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                          className="rounded-xl border-amber-200 dark:border-stone-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                          About the Business
                        </label>
                        <Textarea
                          rows={4}
                          value={profile.description || ""}
                          placeholder="Tell customers about your services, certifications, and philosophy..."
                          onChange={(e) =>
                            setProfile({ ...profile, description: e.target.value })
                          }
                          className="rounded-xl border-amber-200 dark:border-stone-800 resize-none text-xs"
                        />
                      </div>

                      {/* Storefront preview teaser */}
                      <div className="p-4 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-800">
                        <div className="flex items-center gap-2 mb-1">
                          <ShieldCheck className="h-4 w-4 text-orange-600" />
                          <span className="text-xs font-bold text-orange-900 dark:text-orange-200">
                            Verified Provider Storefront
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 dark:text-stone-400 mb-2">
                          Your profile is active in search results. Customers can book directly via
                          conversational AI or the web schedule picker.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-lg border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300"
                          onClick={() => {
                            window.open(
                              `/dashboard/user/discover?search=${encodeURIComponent(profile.name)}`,
                              "_blank"
                            )
                          }}
                        >
                          View Public Page <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Modal 1: Booking Management Details ───────────────────────────── */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setSelectedBooking(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-stone-900 border border-amber-200/60 dark:border-stone-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-amber-100 dark:border-stone-800">
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  Appointment Details
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedBooking(null)}
                  className="rounded-full h-7 w-7 p-0"
                >
                  ×
                </Button>
              </div>

              <div className="p-3.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-stone-900 dark:text-stone-100">
                    {selectedBooking.service_name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {selectedBooking.duration_minutes} minutes session
                  </p>
                </div>
                <StatusBadge status={selectedBooking.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg border border-amber-100 dark:border-stone-800">
                  <span className="text-stone-400 block text-[10px] uppercase">Date</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    {new Date(selectedBooking.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-amber-100 dark:border-stone-800">
                  <span className="text-stone-400 block text-[10px] uppercase">Time</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    {selectedBooking.time}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-amber-100 dark:border-stone-800">
                  <span className="text-stone-400 block text-[10px] uppercase">Fee</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    ₹{selectedBooking.price || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-amber-100 dark:border-stone-800">
                  <span className="text-stone-400 block text-[10px] uppercase">Customer</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200 truncate block">
                    {selectedBooking.user_email}
                  </span>
                </div>
              </div>

              {/* Direct Communication Quick Links */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs rounded-xl border-amber-200 gap-1.5"
                  onClick={() => {
                    window.location.href = `mailto:${selectedBooking.user_email}?subject=Regarding your appointment at ${profile?.name}`
                  }}
                >
                  <Mail className="h-3.5 w-3.5 text-stone-500" />
                  Email Client
                </Button>
              </div>

              {/* Action Buttons: Complete or Cancel */}
              {selectedBooking.status !== "completed" && selectedBooking.status !== "cancelled" && (
                <div className="flex gap-2 pt-3 border-t border-amber-100 dark:border-stone-800">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs"
                    disabled={bookingActionLoading}
                    onClick={() => handleBookingAction("complete")}
                  >
                    {bookingActionLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Mark Complete"
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl text-xs"
                    disabled={bookingActionLoading}
                    onClick={() => handleBookingAction("cancel")}
                  >
                    Cancel Booking
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal 2: Date Overrides Inspector ────────────────────────────── */}
      <AnimatePresence>
        {selectedDayOverride && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setSelectedDayOverride(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-stone-900 border border-amber-200/60 dark:border-stone-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-amber-100 dark:border-stone-800">
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                    {selectedDayOverride.date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <p className="text-xs text-stone-500">Manage date-specific availability override</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDayOverride(null)}
                  className="rounded-full h-7 w-7 p-0"
                >
                  ×
                </Button>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-stone-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    {selectedDayOverride.isOverride ? (
                      <span className="text-amber-600 flex items-center gap-1">
                        ⭐ Custom Override Active
                      </span>
                    ) : (
                      "Standard Weekly Hours Active"
                    )}
                  </span>
                  {selectedDayOverride.isOverride && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-rose-600 hover:text-rose-700"
                      onClick={handleClearOverride}
                    >
                      Reset to Standard
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                  {selectedDayOverride.availableSlots.length > 0 ? (
                    selectedDayOverride.availableSlots.map((time) => (
                      <div
                        key={time}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 ${
                          selectedDayOverride.isOverride
                            ? "bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                            : "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200"
                        }`}
                      >
                        <span>{time}</span>
                        {selectedDayOverride.isOverride && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOverrideSlot(time)}
                            className="hover:text-rose-600"
                          >
                            <XCircle className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400 italic">No slots available on this day.</p>
                  )}
                </div>
              </div>

              {/* Add Custom Slot */}
              <div className="p-3.5 border border-dashed border-amber-300 dark:border-stone-700 rounded-xl space-y-2">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                  Add Special Time Slot for this Date
                </span>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={overrideInputTime}
                    onChange={(e) => setOverrideInputTime(e.target.value)}
                    className="h-8 text-xs rounded-lg"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleAddOverrideSlot}
                  >
                    Add Slot
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl text-xs bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={async () => {
                    setSelectedDayOverride(null)
                    await handleSaveProfile()
                  }}
                >
                  Save & Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal 3: Service Create / Edit ───────────────────────────────── */}
      <AnimatePresence>
        {serviceModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setServiceModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-stone-900 border border-amber-200/60 dark:border-stone-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-amber-100 dark:border-stone-800">
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-orange-600" />
                  {editingServiceIndex !== null ? "Edit Service" : "Add New Service"}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setServiceModalOpen(false)}
                  className="rounded-full h-7 w-7 p-0"
                >
                  ×
                </Button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 dark:text-stone-300">
                    Service Name *
                  </label>
                  <Input
                    placeholder="e.g. Signature Haircut & Beard Trim"
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    className="h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 dark:text-stone-300">
                      Price (₹) *
                    </label>
                    <Input
                      type="number"
                      value={serviceForm.price}
                      onChange={(e) =>
                        setServiceForm({ ...serviceForm, price: Number(e.target.value) })
                      }
                      className="h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 dark:text-stone-300">
                      Duration (Mins) *
                    </label>
                    <Input
                      type="number"
                      value={serviceForm.duration_minutes}
                      onChange={(e) =>
                        setServiceForm({
                          ...serviceForm,
                          duration_minutes: Number(e.target.value),
                        })
                      }
                      className="h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 dark:text-stone-300">
                    Description
                  </label>
                  <Textarea
                    rows={2}
                    placeholder="Explain what is included in this session..."
                    value={serviceForm.description}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, description: e.target.value })
                    }
                    className="text-xs rounded-lg border-amber-200 dark:border-stone-800 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                    <span>AI Semantic Search Tags</span>
                    <span className="text-[10px] text-stone-400 font-normal">
                      Comma separated
                    </span>
                  </label>
                  <Input
                    placeholder="haircut, fade, trim, styling, wash"
                    value={serviceForm.tags?.join(", ") || ""}
                    onChange={(e) => {
                      const tags = e.target.value
                        .split(",")
                        .map((t) => t.trim().toLowerCase())
                        .filter(Boolean)
                      setServiceForm({ ...serviceForm, tags })
                    }}
                    className="h-8 text-xs rounded-lg border-amber-200 dark:border-stone-800"
                  />
                  <p className="text-[10px] text-stone-400 leading-tight">
                    These keywords train the Amazon Bedrock & Gemini LLMs to recommend this service
                    during customer conversations.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-amber-100 dark:border-stone-800">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => setServiceModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl text-xs bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleSaveServiceModal}
                >
                  Confirm Service
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal 4: Client Appointment History Drawer ────────────────────── */}
      <AnimatePresence>
        {selectedClientForHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setSelectedClientForHistory(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-stone-900 border border-amber-200/60 dark:border-stone-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-amber-100 dark:border-stone-800">
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                    Client History
                  </h3>
                  <p className="text-xs text-stone-500">{selectedClientForHistory}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClientForHistory(null)}
                  className="rounded-full h-7 w-7 p-0"
                >
                  ×
                </Button>
              </div>

              <ScrollArea className="max-h-72 pr-2">
                <div className="space-y-2">
                  {bookings
                    .filter((b) => b.user_email === selectedClientForHistory)
                    .map((b) => (
                      <div
                        key={b._id || b.id}
                        className="p-3 border border-amber-100 dark:border-stone-800 rounded-xl bg-amber-50/30 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold">{b.service_name}</p>
                          <p className="text-stone-500 text-[11px]">
                            {b.date} at {b.time} ({b.duration_minutes}m)
                          </p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={b.status} />
                          <p className="font-bold text-stone-800 dark:text-stone-200 text-xs mt-1">
                            ₹{b.price || 0}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
                  onClick={() => setSelectedClientForHistory(null)}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
