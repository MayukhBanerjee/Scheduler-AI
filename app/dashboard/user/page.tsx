"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

import {
  NavTab,
  Message,
  ServiceResult,
  UserProfile,
  BookingRow,
  CHAT_STORAGE_KEY,
  FEATURED_PROVIDERS,
} from "@/components/dashboard/user/types"
import { CustomerSidebar } from "@/components/dashboard/user/sidebar"
import { CustomerHeader } from "@/components/dashboard/user/header"
import { AISchedulerView } from "@/components/dashboard/user/views/ai-scheduler-view"
import { DiscoverView } from "@/components/dashboard/user/views/discover-view"
import { BookingsView } from "@/components/dashboard/user/views/bookings-view"
import { CalendarView } from "@/components/dashboard/user/views/calendar-view"
import { AnalyticsView } from "@/components/dashboard/user/views/analytics-view"

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
      parts.push(
        <strong key={key++} className="font-bold text-stone-950 dark:text-white">
          {match[0].slice(2, -2)}
        </strong>
      )
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

export default function UserDashboard() {
  const router = useRouter()
  const { toast } = useToast()

  // Navigation & Layout State
  const [activeTab, setActiveTab] = useState<NavTab>("ai-schedule")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Auth & Chat State
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

  // Discover Filters
  const [discoveryCategory, setDiscoveryCategory] = useState("All")
  const [discoverySearch, setDiscoverySearch] = useState("")

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

  // 1. Session Fetch
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else router.push("/login?type=user")
      })
      .catch(() => router.push("/login?type=user"))
  }, [router])

  // 2. Chat Hydration from LocalStorage
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

  // 3. Persist Chat to LocalStorage
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

  // 4. Auto Scroll
  useEffect(() => {
    if (activeTab === "ai-schedule") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, activeTab])

  // 5. Fetch Bookings
  const fetchMyBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings")
      if (!res.ok) return
      const data = await res.json()
      setMyBookings(
        (data.bookings || []).filter((b: BookingRow) => b.status !== "cancelled")
      )
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchMyBookings()
  }, [fetchMyBookings])

  // 6. Web Speech Recognition API
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

  // 7. Dispatch AI Message
  const handleSendMessage = useCallback(
    async (customText?: string) => {
      const textToSend = customText || inputMessage
      if (!textToSend.trim()) return

      const userMessage: Message = {
        id: Date.now().toString(),
        content: textToSend,
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
      if (!customText) setInputMessage("")
      setIsTyping(true)
      setActiveTab("ai-schedule")

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: textToSend,
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
    },
    [inputMessage, conversationId, messages]
  )

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 8. Atomic Booking Execution
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

  // 9. Booking Cancellation
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

  // 10. Filtered Providers for Discover Tab
  const filteredProviders = useMemo(() => {
    return FEATURED_PROVIDERS.filter((p) => {
      const matchesCategory =
        discoveryCategory === "All" || p.category === discoveryCategory
      const matchesSearch =
        !discoverySearch.trim() ||
        p.name.toLowerCase().includes(discoverySearch.toLowerCase()) ||
        p.services.some((s) => s.name.toLowerCase().includes(discoverySearch.toLowerCase()))
      return matchesCategory && matchesSearch
    })
  }, [discoveryCategory, discoverySearch])

  const tabLabels: Record<NavTab, string> = {
    "ai-schedule": "AI Scheduler",
    discover: "Discover Services",
    bookings: "My Bookings",
    calendar: "Schedule Calendar",
    analytics: "Booking Analytics",
  }

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden flex bg-[#fff8f4] dark:bg-stone-950 text-stone-900 dark:text-stone-100 relative selection:bg-orange-500/20 selection:text-[#b02f00] font-sans antialiased">
      {/* Background Ambient Wave */}
      <div className="wavy-bg fixed inset-0 pointer-events-none -z-10 opacity-70" />

      {/* ─── 1. Modular Collapsible Sidebar ─────────────────────────────── */}
      <CustomerSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={user}
        bookingsCount={myBookings.length}
      />

      {/* ─── 2. Main Workspace Layout ──────────────────────────────────── */}
      <div
        className="flex-1 h-screen max-h-screen flex flex-col min-w-0 overflow-hidden transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 80 : 256 }}
      >
        {/* Modular Top Header */}
        <CustomerHeader
          activeTabLabel={tabLabels[activeTab]}
          user={user}
          onLogout={handleLogout}
        />

        {/* Dynamic Views */}
        <main className="flex-1 min-h-0 overflow-hidden p-3.5 sm:p-4 w-full flex flex-col">
          {activeTab === "ai-schedule" && (
            <AISchedulerView
              messages={messages}
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              isTyping={isTyping}
              isListening={isListening}
              speechSupported={speechSupported}
              toggleVoice={toggleVoice}
              handleSendMessage={handleSendMessage}
              handleKeyPress={handleKeyPress}
              bookingInProgress={bookingInProgress}
              handleBookService={handleBookService}
              messagesEndRef={messagesEndRef}
              inputRef={inputRef}
              renderRichText={renderRichText}
              bookings={myBookings}
              onViewAllBookings={() => setActiveTab("bookings")}
              onCancelBooking={handleCancelBooking}
              cancellingId={cancellingId}
              calendarKey={calendarKey}
            />
          )}

          {activeTab === "discover" && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <DiscoverView
                category={discoveryCategory}
                onCategoryChange={setDiscoveryCategory}
                search={discoverySearch}
                onSearchChange={setDiscoverySearch}
                providers={filteredProviders}
                onBookWithAI={handleSendMessage}
              />
            </div>
          )}

          {activeTab === "bookings" && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <BookingsView
                bookings={myBookings}
                onNewBooking={() => setActiveTab("ai-schedule")}
                onCancelBooking={handleCancelBooking}
                cancellingId={cancellingId}
              />
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <CalendarView calendarKey={calendarKey} />
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <AnalyticsView bookings={myBookings} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
