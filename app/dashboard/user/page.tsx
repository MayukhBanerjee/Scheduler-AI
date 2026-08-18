"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import {
  Message,
  ServiceResult,
  BookingRow,
  CHAT_STORAGE_KEY,
} from "@/components/dashboard/user/types"
import { AISchedulerView } from "@/components/dashboard/user/views/ai-scheduler-view"

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

export default function AISchedulePage() {
  const router = useRouter()
  const { toast } = useToast()

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
    id: "welcome-1",
    content:
      "Hello! I'm your AI booking assistant. Tell me what you need — or tap the mic — and I'll find verified slots.",
    sender: "ai",
    timestamp: new Date(),
    type: "general",
  }

  // 1. Hydrate chat from LocalStorage
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

  // 2. Persist chat to LocalStorage
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

  // 3. Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 4. Fetch Bookings
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

  // Process any quick prompt passed from Discover or Calendar
  useEffect(() => {
    try {
      const quickPrompt = sessionStorage.getItem("scheduleai_quick_prompt")
      if (quickPrompt) {
        sessionStorage.removeItem("scheduleai_quick_prompt")
        setTimeout(() => {
          handleSendMessage(quickPrompt)
        }, 300)
      }
    } catch {}
  }, [handleSendMessage])

  // 5. Web Speech API Setup
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

  // 6. Handle AI Message
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

  // 7. Handle Slot Booking
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

  // 8. Handle Booking Cancellation
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

  return (
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
      onViewAllBookings={() => router.push("/dashboard/user/bookings")}
      onCancelBooking={handleCancelBooking}
      cancellingId={cancellingId}
      calendarKey={calendarKey}
    />
  )
}
