"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar as CalendarIcon,
  Send,
  Bot,
  User,
  Mic,
  MicOff,
  LogOut,
  Star,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle,
  Loader2,
  XCircle,
  ListChecks,
  Sparkles,
  Bell,
  ChevronDown,
  CalendarCheck,
  CalendarX,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { BookingCalendar } from "@/components/booking-calendar"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  type?: "booking" | "confirmation" | "general" | "results" | "clarification"
  services?: ServiceResult[]
}

interface ServiceResult {
  service_id: string
  service_name: string
  category: string
  provider_id: string
  provider_name: string
  provider_email: string
  location: string
  price: number
  duration_minutes: number
  available_slots: string[]
  rating: number
  description: string
  tags: string[]
  date?: string
}

interface UserProfile {
  name: string
  email: string
  role: string
}

interface BookingRow {
  _id: string
  service_name: string
  provider_name?: string
  date: string
  time: string
  status: string
  location?: string
}

const CHAT_STORAGE_KEY = "scheduleai_user_chat_v2"

function renderRichText(content: string) {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) {
      parts.push(content.slice(last, match.index))
    }
    if (match[0].startsWith("**")) {
      parts.push(<strong key={key++} className="font-bold text-stone-950 dark:text-white">{match[0].slice(2, -2)}</strong>)
    } else {
      parts.push(
        <a
          key={key++}
          href={match[3]}
          className="text-[#b02f00] dark:text-orange-400 underline underline-offset-2 font-semibold"
          target="_blank"
          rel="noreferrer"
        >
          {match[2]}
        </a>
      )
    }
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push(content.slice(last))
  return parts.length ? parts : content
}

function ServiceCard({
  service,
  onBook,
  isBooking,
}: {
  service: ServiceResult
  onBook: (service: ServiceResult, slot: string) => void
  isBooking: boolean
}) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const hasSlots = service.available_slots && service.available_slots.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-orange-200/60 dark:border-stone-700/60 rounded-2xl p-4 bg-white/90 dark:bg-stone-900/90 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">{service.service_name}</h4>
          <p className="text-xs text-stone-500 dark:text-stone-400">{service.provider_name}</p>
        </div>
        <div className="flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 text-amber-700 dark:text-amber-300 font-bold">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span>{service.rating.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-stone-600 dark:text-stone-300 mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-[#ff5722]" />
          {service.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-stone-400" />
          {service.duration_minutes} min
        </span>
        <span className="flex items-center gap-0.5 text-[#b02f00] dark:text-orange-400 font-bold">
          <DollarSign className="h-3.5 w-3.5" />
          ₹{service.price}
        </span>
      </div>

      {hasSlots && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">Available slots:</p>
          <div className="flex flex-wrap gap-1.5">
            {service.available_slots.slice(0, 5).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot === selectedSlot ? null : slot)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                  selectedSlot === slot
                    ? "bg-[#b02f00] text-white border-[#b02f00] shadow-xs scale-105"
                    : "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-[#b02f00] text-stone-700 dark:text-stone-300"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        size="sm"
        className="w-full bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white rounded-xl font-semibold shadow-sm transition-all"
        disabled={!hasSlots || !selectedSlot || isBooking}
        onClick={() => selectedSlot && onBook(service, selectedSlot)}
      >
        {isBooking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
        )}
        {isBooking ? "Booking Slot..." : selectedSlot ? `Confirm Booking at ${selectedSlot}` : "Select a Time Slot"}
      </Button>
    </motion.div>
  )
}

export default function UserDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState(`conv-${Date.now()}`)
  const [myBookings, setMyBookings] = useState<BookingRow[]>([])
  const [calendarKey, setCalendarKey] = useState(0)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const hydratedRef = useRef(false)

  const defaultWelcome: Message = {
    id: "welcome-1",
    content:
      "Hello! I'm your AI booking assistant. Tell me what you need — or tap the mic — and I'll find verified slots.",
    sender: "ai",
    timestamp: new Date(),
    type: "general",
  }

  // Session fetch
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else router.push("/login")
      })
      .catch(() => router.push("/login"))
  }, [router])

  // Hydrate chat from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          conversationId?: string
          messages?: Array<Omit<Message, "timestamp"> & { timestamp: string }>
        }
        if (parsed.conversationId) setConversationId(parsed.conversationId)
        if (parsed.messages?.length) {
          setMessages(
            parsed.messages.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }))
          )
        } else {
          setMessages([defaultWelcome])
        }
      } else {
        setMessages([defaultWelcome])
      }
    } catch {
      setMessages([defaultWelcome])
    }
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist chat to localStorage
  useEffect(() => {
    if (!hydratedRef.current || messages.length === 0) return
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        conversationId,
        messages: messages.map((m) => ({
          ...m,
          timestamp: m.timestamp.toISOString(),
        })),
      })
    )
  }, [messages, conversationId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch Bookings
  const fetchMyBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings")
      if (!res.ok) return
      const data = await res.json()
      setMyBookings(
        (data.bookings || []).filter((b: BookingRow) => b.status !== "cancelled").slice(0, 10)
      )
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchMyBookings()
  }, [fetchMyBookings])

  // Web Speech setup
  useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined
    setSpeechSupported(Boolean(SR))
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      let finalText = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += transcript
        else interim += transcript
      }
      if (finalText) {
        setInputMessage(finalText.trim())
      } else if (interim) {
        setInputMessage(interim)
      }
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [])

  const toggleVoice = () => {
    const recognition = recognitionRef.current
    if (!recognition) {
      toast({
        title: "Voice not supported",
        description: "Voice input needs Chrome or Edge.",
        variant: "destructive",
      })
      return
    }
    if (isListening) {
      recognition.stop()
      setIsListening(false)
      return
    }
    setIsListening(true)
    try {
      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date(),
      type: "general",
    }

    const historyPayload = [...messages, userMessage]
      .filter((m) => m.content)
      .slice(-8)
      .map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      }))

    setMessages((prev) => [...prev, userMessage])
    const sentText = inputMessage
    setInputMessage("")
    setIsTyping(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: sentText,
          conversation_id: conversationId,
          messages: historyPayload.slice(0, -1),
        }),
      })

      if (!res.ok) throw new Error("Backend unreachable")

      const data = await res.json()
      const isClarification = Boolean(data.needs_clarification)
      const services = isClarification ? [] : data.services || []

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          data.clarification_question && isClarification
            ? data.reply || data.clarification_question
            : data.reply || "I'm not sure how to help with that. Could you rephrase?",
        sender: "ai",
        timestamp: new Date(),
        type: isClarification
          ? "clarification"
          : services.length > 0
            ? "results"
            : "general",
        services,
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          content:
            "The AI backend is offline. Make sure the Python server is running on port 8000.",
          sender: "ai",
          timestamp: new Date(),
          type: "general",
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }, [inputMessage, conversationId, messages])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleBookService = async (service: ServiceResult, slot: string) => {
    setBookingInProgress(service.service_id)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    let dateStr = tomorrow.toISOString().split("T")[0]
    if (service.date && /^\d{4}-\d{2}-\d{2}$/.test(service.date)) {
      dateStr = service.date
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: service.service_id,
          provider_id: service.provider_id,
          date: dateStr,
          time: slot,
          duration_minutes: service.duration_minutes,
          service_name: service.service_name,
        }),
      })

      const data = await res.json()

      const confirmMsg: Message = {
        id: Date.now().toString(),
        content: res.ok
          ? `**Booking confirmed!** ${service.service_name} at ${service.provider_name} — ${slot} on ${dateStr}. Added to your ScheduleAI calendar.`
          : `Booking failed: ${data.error || "Please try again."}`,
        sender: "ai",
        timestamp: new Date(),
        type: "confirmation",
      }

      setMessages((prev) => [...prev, confirmMsg])
      if (res.ok) {
        toast({ title: "Booked", description: "Added to your ScheduleAI calendar." })
        fetchMyBookings()
        setCalendarKey((k) => k + 1)
      } else {
        toast({
          title: "Booking failed",
          description: data.error || "Please try another slot.",
          variant: "destructive",
        })
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          content: "Could not complete booking. Please try again.",
          sender: "ai",
          timestamp: new Date(),
          type: "general",
        },
      ])
    } finally {
      setBookingInProgress(null)
    }
  }

  const handleCancelBooking = async (id: string) => {
    setCancellingId(id)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Cancel failed", description: data.error, variant: "destructive" })
      } else {
        toast({ title: "Cancelled", description: "Slot freed for others." })
        fetchMyBookings()
        setCalendarKey((k) => k + 1)
      }
    } finally {
      setCancellingId(null)
    }
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  const getInitials = (name?: string) => {
    if (!name) return "U"
    const parts = name.trim().split(" ")
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-[#fff8f4] dark:bg-stone-950 text-stone-900 dark:text-stone-100 relative selection:bg-orange-500/20 selection:text-[#b02f00] font-sans antialiased overflow-x-hidden">
      {/* Background Soft Wave Accent */}
      <div className="wavy-bg fixed inset-0 pointer-events-none -z-10 opacity-70" />

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-white/75 dark:bg-stone-950/75 backdrop-blur-xl border-b border-orange-200/50 dark:border-stone-800 shadow-[0_10px_30px_rgba(255,87,34,0.08)] transition-all">
        <div className="flex justify-between items-center px-4 sm:px-8 md:px-12 py-3.5 max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl md:text-2xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <span className="bg-gradient-to-r from-stone-900 via-stone-800 to-[#b02f00] dark:from-white dark:to-orange-400 bg-clip-text text-transparent font-bold">
                ScheduleAI
              </span>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex gap-7 items-center">
              <Link href="/#features" className="text-stone-600 hover:text-[#b02f00] dark:text-stone-300 dark:hover:text-orange-400 font-semibold text-sm transition-colors">
                Discover
              </Link>
              <Link href="/dashboard/user" className="text-stone-600 hover:text-[#b02f00] dark:text-stone-300 dark:hover:text-orange-400 font-semibold text-sm transition-colors">
                Bookings
              </Link>
              <Link href="/dashboard/user" className="text-[#b02f00] dark:text-orange-400 font-bold text-sm flex items-center gap-1.5 border-b-2 border-[#b02f00] dark:border-orange-400 pb-0.5">
                <Sparkles className="h-3.5 w-3.5 text-[#ff5722]" />
                AI Schedule
              </Link>
              <Link href="/signup?role=provider" className="text-stone-600 hover:text-[#b02f00] dark:text-stone-300 dark:hover:text-orange-400 font-semibold text-sm transition-colors">
                For Businesses
              </Link>
            </div>
          </div>

          {/* Right User Actions */}
          <div className="flex items-center gap-3.5">
            <Link href="/dashboard/client">
              <Button
                size="sm"
                className="hidden sm:flex bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white rounded-full font-semibold text-xs px-4 py-1.5 shadow-[0_4px_14px_rgba(255,87,34,0.25)] transition-all hover:scale-[1.02]"
              >
                Switch to Business
              </Button>
            </Link>

            {/* User Dropdown Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 bg-orange-100/60 dark:bg-stone-800/80 hover:bg-orange-200/60 px-3 py-1.5 rounded-full border border-orange-200/60 dark:border-stone-700 transition-colors shadow-2xs cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white font-bold text-xs shadow-xs">
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
                      <p className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">{user?.name || "User"}</p>
                      <p className="text-[10px] text-stone-500 truncate">{user?.email || "customer@scheduleai.com"}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors mt-1"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="pt-24 pb-12 px-4 sm:px-8 md:px-12 max-w-7xl mx-auto min-h-screen flex flex-col lg:flex-row gap-6 relative z-10">
        {/* Left Column: AI Chat Interface */}
        <section className="flex-1 flex flex-col min-w-0">
          <div className="glass-card rounded-[2rem] flex-1 flex flex-col relative overflow-hidden min-h-[620px] bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-[0_4px_30px_rgba(0,0,0,0.04)]">
            
            {/* Chat Header */}
            <div className="p-5 sm:p-6 border-b border-orange-100/60 dark:border-stone-800 flex justify-between items-center bg-white/40 dark:bg-stone-950/40 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-[#b02f00] dark:text-orange-400 flex items-center justify-center shadow-xs">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base sm:text-lg text-stone-900 dark:text-stone-100 tracking-tight">
                    AI Booking Assistant
                  </h2>
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Verified Availability Engine
                  </p>
                </div>
              </div>

              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleVoice}
                disabled={!speechSupported}
                title={speechSupported ? "Toggle browser mic voice input" : "Voice input requires Chrome or Edge"}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30"
                    : "bg-orange-100/70 dark:bg-stone-800 text-[#b02f00] dark:text-orange-400 hover:bg-orange-200/70"
                }`}
              >
                {isListening ? <Mic className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
            </div>

            {/* Chat Messages Scrollable Area */}
            <div className="flex-1 p-5 sm:p-6 overflow-y-auto flex flex-col gap-5">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 max-w-[88%] ${message.sender === "user" ? "self-end flex-row-reverse" : "self-start"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold mt-1 shadow-xs ${
                        message.sender === "user"
                          ? "bg-gradient-to-tr from-[#b02f00] to-[#ff5722] text-white"
                          : "bg-orange-100 text-[#b02f00] dark:bg-orange-950 dark:text-orange-400"
                      }`}
                    >
                      {message.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    {/* Bubble Content */}
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          message.sender === "user"
                            ? "bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white rounded-tr-sm"
                            : message.type === "confirmation"
                              ? "bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-stone-900 dark:text-emerald-100 rounded-tl-sm"
                              : message.type === "clarification"
                                ? "bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-stone-900 dark:text-amber-100 rounded-tl-sm"
                                : "bg-white/85 dark:bg-stone-900/85 border border-white/60 dark:border-stone-800 text-stone-800 dark:text-stone-200 rounded-tl-sm backdrop-blur-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{renderRichText(message.content)}</p>
                      </div>

                      {/* Timestamp */}
                      <span className={`text-[10px] text-stone-400 px-1 font-medium ${message.sender === "user" ? "text-right" : "text-left"}`}>
                        {message.timestamp.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {/* Attached Service Cards (If search returned ranked options) */}
                      {message.services && message.services.length > 0 && (
                        <div className="grid gap-2.5 mt-1">
                          {message.services.map((service) => (
                            <ServiceCard
                              key={service.service_id}
                              service={service}
                              onBook={handleBookService}
                              isBooking={bookingInProgress === service.service_id}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing loader */}
              {isTyping && (
                <div className="flex gap-3 self-start max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-[#b02f00] flex items-center justify-center mt-1">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-white/80 dark:bg-stone-900/80 border border-orange-100 dark:border-stone-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs">
                    <Loader2 className="h-4 w-4 animate-spin text-[#ff5722]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 sm:p-5 bg-white/50 dark:bg-stone-950/50 backdrop-blur-md border-t border-orange-100/60 dark:border-stone-800 z-10">
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="e.g. haircut tomorrow afternoon..."
                  disabled={isTyping}
                  className="w-full bg-white/90 dark:bg-stone-900/90 border border-orange-200/60 dark:border-stone-700 rounded-full py-3.5 pl-6 pr-14 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#b02f00] focus:ring-2 focus:ring-orange-500/20 transition-all shadow-inner placeholder:text-stone-400"
                />

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                  className="absolute right-2 w-9 h-9 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                </button>
              </div>

              <p className="text-center text-[11px] font-semibold text-stone-500 dark:text-stone-400 mt-2.5">
                Multi-turn works — try &quot;haircut&quot; then &quot;tomorrow afternoon&quot;
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Sidebar Widgets (Width: 380px) */}
        <aside className="w-full lg:w-[380px] flex flex-col gap-6 shrink-0">
          
          {/* Widget 1: My Bookings */}
          <div className="glass-card rounded-[2rem] p-5 sm:p-6 flex flex-col gap-3.5 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-[0_4px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-[#b02f00] dark:text-orange-400" />
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                My bookings
              </h3>
            </div>

            <div className="space-y-2">
              {myBookings.length === 0 ? (
                <div className="bg-white/50 dark:bg-stone-950/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center border border-white/60 dark:border-stone-800 min-h-[100px]">
                  <p className="text-sm font-medium text-stone-500 dark:text-stone-400">No active bookings yet.</p>
                </div>
              ) : (
                myBookings.map((b) => (
                  <div
                    key={b._id}
                    className="flex items-start justify-between gap-2 border border-orange-100/80 dark:border-stone-800 rounded-xl p-3 bg-white/80 dark:bg-stone-950/80 text-sm shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900 dark:text-stone-100 truncate">{b.service_name}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {b.date} · {b.time}
                        {b.provider_name ? ` · ${b.provider_name}` : ""}
                      </p>
                      <Badge variant="outline" className="mt-1 text-[10px] bg-orange-50 text-[#b02f00] border-orange-200">
                        {b.status}
                      </Badge>
                    </div>

                    {b.status === "confirmed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                        disabled={cancellingId === b._id}
                        onClick={() => handleCancelBooking(b._id)}
                      >
                        {cancellingId === b._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Widget 2: ScheduleAI Calendar */}
          <div className="flex-1 min-h-[22rem]">
            <BookingCalendar key={calendarKey} userType="user" />
          </div>
        </aside>
      </main>
    </div>
  )
}
