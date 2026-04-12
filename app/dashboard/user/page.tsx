"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Calendar,
  MessageSquare,
  Phone,
  Send,
  Bot,
  User,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
  LogOut,
  Star,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { GoogleCalendarIntegration } from "@/components/google-calendar-integration"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  type?: "booking" | "confirmation" | "general" | "voice" | "results"
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
}

interface UserProfile {
  name: string
  email: string
  role: string
}

// ─── Service Card Component ────────────────────────────────────────────────────

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
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

      {service.available_slots.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">Available slots:</p>
          <div className="flex flex-wrap gap-1.5">
            {service.available_slots.slice(0, 4).map((slot) => (
              <button
                key={slot}
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
        disabled={(!selectedSlot && service.available_slots.length > 0) || isBooking}
        onClick={() => onBook(service, selectedSlot || service.available_slots[0] || "09:00")}
      >
        {isBooking ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <CheckCircle className="h-3 w-3 mr-1" />
        )}
        {isBooking ? "Booking..." : selectedSlot ? `Book at ${selectedSlot}` : "Book Now"}
      </Button>
    </motion.div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function UserDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! 👋 I'm your AI booking assistant. Tell me what service you're looking for — haircut, dental checkup, massage, fitness session, and more. Just describe what you need!",
      sender: "ai",
      timestamp: new Date(),
      type: "general",
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isInCall, setIsInCall] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null)
  const [conversationId] = useState(`conv-${Date.now()}`)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch current user profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else router.push("/login")
      })
      .catch(() => router.push("/login"))
  }, [router])

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Call timer
  useEffect(() => {
    if (isInCall) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      setCallDuration(0)
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current)
    }
  }, [isInCall])

  const formatCallDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  // ─── Send Message ────────────────────────────────────────────────────────

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isInCall) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date(),
      type: "general",
    }

    setMessages((prev) => [...prev, userMessage])
    const sentText = inputMessage
    setInputMessage("")
    setIsTyping(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: sentText, conversation_id: conversationId }),
      })

      if (!res.ok) {
        throw new Error("Backend unreachable")
      }

      const data = await res.json()

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.reply || "I'm not sure how to help with that. Could you rephrase?",
        sender: "ai",
        timestamp: new Date(),
        type: data.services?.length > 0 ? "results" : "general",
        services: data.services || [],
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "⚠️ The AI backend is offline. Make sure the Python server is running on port 8000. Run: `uvicorn main:app --reload` in the backend folder.",
        sender: "ai",
        timestamp: new Date(),
        type: "general",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }, [inputMessage, isInCall, conversationId])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // ─── Booking Flow ────────────────────────────────────────────────────────

  const handleBookService = async (service: ServiceResult, slot: string) => {
    setBookingInProgress(service.service_id)

    // Parse date from slot (use tomorrow as default)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split("T")[0]

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
          provider_email: service.provider_email,
        }),
      })

      const data = await res.json()

      const confirmMsg: Message = {
        id: Date.now().toString(),
        content: res.ok
          ? `✅ **Booking Confirmed!** Your ${service.service_name} at ${service.provider_name} is booked for ${slot} on ${dateStr}.${
              data.calendar_link
                ? ` [View in Google Calendar](${data.calendar_link})`
                : " Calendar event created!"
            }`
          : `❌ Booking failed: ${data.error || "Please try again."}`,
        sender: "ai",
        timestamp: new Date(),
        type: "confirmation",
      }

      setMessages((prev) => [...prev, confirmMsg])
    } catch {
      const errMsg: Message = {
        id: Date.now().toString(),
        content: "❌ Could not complete booking. Please try again.",
        sender: "ai",
        timestamp: new Date(),
        type: "general",
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setBookingInProgress(null)
    }
  }

  // ─── Voice / Call Controls ────────────────────────────────────────────────

  const toggleVoice = () => {
    setIsListening(!isListening)
    if (!isListening) {
      setTimeout(() => setIsListening(false), 3000)
    }
  }

  const startCall = () => {
    setIsInCall(true)
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content: "📞 Voice call interface is ready. Full voice processing is coming soon! You can still type in the chat.",
        sender: "ai",
        timestamp: new Date(),
        type: "voice",
      },
    ])
  }

  const endCall = () => {
    setIsInCall(false)
    setIsMuted(false)
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content: `Call ended (${formatCallDuration(callDuration)}). Back to chat mode!`,
        sender: "ai",
        timestamp: new Date(),
        type: "voice",
      },
    ])
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <Badge variant="secondary">User Dashboard</Badge>
            {isInCall && (
              <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                <Badge className="bg-green-500 text-white">
                  <PhoneCall className="h-3 w-3 mr-1" />
                  {formatCallDuration(callDuration)}
                </Badge>
              </motion.div>
            )}
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

      <div className="container mx-auto p-4 max-w-7xl">
        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
          {/* Chat Panel */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="h-full flex flex-col">
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
                  <div className="flex items-center gap-2">
                    {!isInCall && (
                      <Button
                        variant={isListening ? "default" : "outline"}
                        size="sm"
                        onClick={toggleVoice}
                        className={isListening ? "bg-orange-500 animate-pulse" : ""}
                        title="Voice input (coming soon)"
                      >
                        {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                      </Button>
                    )}
                    {isInCall ? (
                      <div className="flex gap-2">
                        <Button
                          variant={isMuted ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => setIsMuted(!isMuted)}
                        >
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={endCall}>
                          <PhoneOff className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={startCall} className="bg-green-600 hover:bg-green-700 text-white">
                        <PhoneCall className="h-4 w-4 mr-1" />
                        Call AI
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`flex items-start gap-2 max-w-[85%] ${
                              message.sender === "user" ? "flex-row-reverse" : ""
                            }`}
                          >
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              <AvatarFallback className={message.sender === "ai" ? "bg-primary/20" : "bg-muted"}>
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
                                    : message.type === "voice"
                                    ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                                    : message.type === "confirmation"
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                                    : "bg-muted"
                                }`}
                              >
                                {message.type === "voice" && (
                                  <div className="flex items-center gap-1 mb-1 text-xs text-green-600 dark:text-green-400 font-medium">
                                    <Phone className="h-3 w-3" />
                                    Voice
                                  </div>
                                )}
                                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                <p className="text-xs opacity-60 mt-1">
                                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>

                              {/* Service Results Cards */}
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

                    {/* Typing indicator */}
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-primary/20">
                              <Bot className="h-3.5 w-3.5 text-primary" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="bg-muted rounded-2xl px-4 py-3">
                            <div className="flex space-x-1">
                              {[0, 0.15, 0.3].map((delay, i) => (
                                <motion.div
                                  key={i}
                                  className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                                  animate={{ y: ["0%", "-50%", "0%"] }}
                                  transition={{ duration: 0.6, repeat: Infinity, delay }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Input Area */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      id="chat-input"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={
                        isInCall
                          ? "Voice call in progress — type here anytime"
                          : "Tell me what service you need (e.g. haircut tomorrow afternoon)..."
                      }
                      className="flex-1 rounded-xl"
                      disabled={isTyping}
                    />
                    <Button
                      id="chat-send-btn"
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
                    Try: &quot;Book a massage for Saturday morning&quot; or &quot;I need a dentist appointment&quot;
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Calendar Panel */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <GoogleCalendarIntegration
              userType="user"
              onEventSync={(events) => {
                console.log("[Dashboard] Calendar synced:", events.length, "events")
              }}
            />
          </motion.div>
        </div>
      </div>
    </div>
  )
}