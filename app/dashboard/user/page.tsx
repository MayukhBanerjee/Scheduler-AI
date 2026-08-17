"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Calendar,
  MessageSquare,
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
} from "lucide-react"
import Link from "next/link"
import { BookingCalendar } from "@/components/booking-calendar"
import { useToast } from "@/hooks/use-toast"

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

const CHAT_STORAGE_KEY = "scheduleai_user_chat_v1"

function renderRichText(content: string) {
  // Simple **bold** and [label](url) rendering
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
      parts.push(<strong key={key++}>{match[0].slice(2, -2)}</strong>)
    } else {
      parts.push(
        <a
          key={key++}
          href={match[3]}
          className="underline underline-offset-2"
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
  const hasSlots = service.available_slots.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-xl p-4 bg-card hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-sm">{service.service_name}</h4>
          <p className="text-xs text-muted-foreground">{service.provider_name}</p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{service.rating.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {service.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {service.duration_minutes} min
        </span>
        <span className="flex items-center gap-1 text-primary font-semibold">
          <DollarSign className="h-3 w-3" />
          ₹{service.price}
        </span>
      </div>

      {hasSlots && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">Available slots:</p>
          <div className="flex flex-wrap gap-1.5">
            {service.available_slots.slice(0, 4).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot === selectedSlot ? null : slot)}
                className={`text-xs px-2 py-1 rounded-md border transition-all ${
                  selectedSlot === slot
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50"
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
        className="w-full"
        disabled={!hasSlots || !selectedSlot || isBooking}
        onClick={() => selectedSlot && onBook(service, selectedSlot)}
      >
        {isBooking ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <CheckCircle className="h-3 w-3 mr-1" />
        )}
        {isBooking ? "Booking..." : selectedSlot ? `Book at ${selectedSlot}` : "Select a slot"}
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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const hydratedRef = useRef(false)

  const defaultWelcome: Message = {
    id: "1",
    content:
      "Hello! I'm your AI booking assistant. Tell me what you need — or tap the mic — and I'll find verified slots.",
    sender: "ai",
    timestamp: new Date(),
    type: "general",
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else router.push("/login")
      })
      .catch(() => router.push("/login"))
  }, [router])

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
            "The AI backend is offline. Make sure the Python server is running on port 8000 and BACKEND_API_KEY matches.",
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
          ? `**Booking confirmed!** ${service.service_name} at ${service.provider_name} — ${slot} on ${dateStr}. Saved to your ScheduleAI calendar.`
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

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur"
      >
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Calendar className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ScheduleAI</span>
          </Link>

          <div className="flex items-center space-x-3">
            <Badge variant="secondary">Customer</Badge>
            {user && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {user.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden md:block">{user.name}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-7xl flex flex-col pt-4 pb-8">
        <div className="grid lg:grid-cols-3 gap-6 min-h-[70vh] lg:h-[calc(100vh-8rem)]">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="lg:col-span-2 min-h-[28rem] flex flex-col h-full"
          >
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="flex-shrink-0 pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    AI Booking Assistant
                    {isListening && (
                      <Badge variant="secondary" className="animate-pulse">
                        <Mic className="h-3 w-3 mr-1" />
                        Listening...
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant={isListening ? "default" : "outline"}
                    size="sm"
                    onClick={toggleVoice}
                    disabled={!speechSupported}
                    title={
                      speechSupported
                        ? "Speak your request"
                        : "Voice input needs Chrome or Edge"
                    }
                    className={isListening ? "bg-orange-500 animate-pulse" : ""}
                  >
                    {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0 min-h-0 relative">
                <div className="absolute inset-0 overflow-y-auto p-4 scroll-smooth">
                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`flex items-start gap-2 max-w-[85%] ${
                              message.sender === "user" ? "flex-row-reverse" : ""
                            }`}
                          >
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              <AvatarFallback
                                className={message.sender === "ai" ? "bg-primary/20" : "bg-muted"}
                              >
                                {message.sender === "user" ? (
                                  <User className="h-3.5 w-3.5" />
                                ) : (
                                  <Bot className="h-3.5 w-3.5 text-primary" />
                                )}
                              </AvatarFallback>
                            </Avatar>

                            <div className="space-y-2 flex-1">
                              <div
                                className={`rounded-2xl p-3 text-sm ${
                                  message.sender === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : message.type === "confirmation"
                                      ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                                      : message.type === "clarification"
                                        ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                                        : "bg-muted"
                                }`}
                              >
                                <p className="whitespace-pre-wrap leading-relaxed">
                                  {renderRichText(message.content)}
                                </p>
                                <p className="text-xs opacity-60 mt-1">
                                  {message.timestamp.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>

                              {message.services && message.services.length > 0 && (
                                <div className="grid gap-2">
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
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-primary/20">
                              <Bot className="h-3.5 w-3.5 text-primary" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="bg-muted rounded-2xl px-4 py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </CardContent>

              <div className="flex-shrink-0 border-t p-4 z-10 bg-card rounded-b-xl">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="e.g. haircut tomorrow afternoon..."
                    className="flex-1 rounded-xl"
                    disabled={isTyping}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    className="rounded-xl"
                  >
                    {isTyping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Multi-turn works — try &quot;haircut&quot; then &quot;tomorrow afternoon&quot;
                </p>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="lg:col-span-1 min-h-0 flex flex-col gap-4 h-full overflow-y-auto"
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  My bookings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {myBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active bookings yet.</p>
                ) : (
                  myBookings.map((b) => (
                    <div
                      key={b._id}
                      className="flex items-start justify-between gap-2 border rounded-lg p-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{b.service_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.date} · {b.time}
                          {b.provider_name ? ` · ${b.provider_name}` : ""}
                        </p>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {b.status}
                        </Badge>
                      </div>
                      {b.status === "confirmed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive h-8 px-2"
                          disabled={cancellingId === b._id}
                          onClick={() => handleCancelBooking(b._id)}
                        >
                          {cancellingId === b._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex-1 min-h-[20rem]">
              <BookingCalendar key={calendarKey} userType="user" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
