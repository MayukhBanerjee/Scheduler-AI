"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Sparkles,
  Loader2,
  CheckCircle2,
  Brain,
  Cpu,
  Zap,
  Calendar,
  MapPin,
  Star,
  X,
} from "lucide-react"
import { Message, ServiceResult } from "./types"

// ─── Types ────────────────────────────────────────────────────────────────────

type AiPhase = "listening" | "thinking" | "processing" | "generating"

interface LiveVoiceCallModalProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
  onNewMessage: (message: Message) => void
  onBookService: (service: ServiceResult, slot: string) => Promise<void> | void
  bookingInProgress: string | null
}

// ─── Voice Booking Command Parser ─────────────────────────────────────────────

function parseBookingCommand(
  text: string,
  services: ServiceResult[]
): { service: ServiceResult; slot: string } | null {
  if (!services || services.length === 0) return null

  const lower = text.toLowerCase()

  // Ordinal matching: "first", "second", "1st", "2nd", etc.
  const ordinalMap: Record<string, number> = {
    first: 0, "1st": 0, one: 0,
    second: 1, "2nd": 1, two: 1,
    third: 2, "3rd": 2, three: 2,
  }
  for (const [word, idx] of Object.entries(ordinalMap)) {
    if (lower.includes(word) && services[idx]) {
      const slot = services[idx].available_slots?.[0]
      if (slot) return { service: services[idx], slot }
    }
  }

  // Time extraction: "book at 10", "11:30", "2 pm", "10 o'clock"
  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|o'?clock)?\b/)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1])
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    const isPM = lower.includes("pm") && hour < 12
    if (isPM) hour += 12
    const hh = String(hour).padStart(2, "0")
    const mm = String(minute).padStart(2, "0")

    // Exact match first
    for (const svc of services) {
      for (const slot of svc.available_slots || []) {
        if (slot.startsWith(`${hh}:${mm}`)) return { service: svc, slot }
      }
    }
    // Hour-only fuzzy match
    for (const svc of services) {
      const fuzzy = (svc.available_slots || []).find((s) => s.startsWith(`${hh}:`))
      if (fuzzy) return { service: svc, slot: fuzzy }
    }
  }

  // Trigger word fallback — only if user hasn't already booked
  const bookTriggers = ["book", "confirm", "schedule", "take it", "go ahead", "sounds good", "perfect"]
  if (bookTriggers.some((t) => lower.includes(t)) && services[0]?.available_slots?.[0]) {
    return { service: services[0], slot: services[0].available_slots[0] }
  }

  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveVoiceCallModal({
  isOpen,
  onClose,
  conversationId,
  onNewMessage,
  onBookService,
  bookingInProgress,
}: LiveVoiceCallModalProps) {

  // ── UI State ─────────────────────────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState(false)
  const [aiPhase, setAiPhase] = useState<AiPhase>("listening")
  const [liveTranscript, setLiveTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [activeServices, setActiveServices] = useState<ServiceResult[]>([])
  const [confirmedKeys, setConfirmedKeys] = useState<Set<string>>(new Set())
  const [dialogueTitle, setDialogueTitle] = useState("Hello! How can I help you today?")
  const [dialogueSubtitle, setDialogueSubtitle] = useState("Tell me what service you're looking for and I'll find available openings.")

  // ── Stable Refs (never stale in callbacks) ───────────────────────────────────
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null)

  // These refs mirror state so callbacks always have the latest value
  const isMutedRef = useRef(false)
  const isProcessingRef = useRef(false)  // true while API call in flight
  const isOpenRef = useRef(false)        // true while modal is mounted & open
  const callHistoryRef = useRef<{ role: string; content: string }[]>([])
  const latestServicesRef = useRef<ServiceResult[]>([])
  const finalAccumRef = useRef("")       // accumulates final STT results per turn

  // Sync state → refs
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])

  // ── Phase sequence: thinking (1.2s) → processing ─────────────────────────────
  const runPhaseSequence = useCallback(() => {
    setAiPhase("thinking")
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
    phaseTimerRef.current = setTimeout(() => setAiPhase("processing"), 1200)
  }, [])

  // ── Explicit mic start / stop ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isMutedRef.current) return
    try {
      recognitionRef.current.start()
    } catch {
      // Already started — ignore DOMException
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.stop()
    } catch {
      // Already stopped — ignore
    }
  }, [])

  // ── Core: process accumulated speech as a query ───────────────────────────────
  const processUserSpeech = useCallback(async (spokenQuery: string) => {
    const trimmed = spokenQuery.trim()
    if (!trimmed || isProcessingRef.current) return

    // ── IMMEDIATELY stop the mic before any async work ──────────────────────────
    stopListening()
    setIsListening(false)
    isProcessingRef.current = true
    setLiveTranscript("")
    finalAccumRef.current = ""

    // 1) Check for voice booking command first
    const bookCmd = parseBookingCommand(trimmed, latestServicesRef.current)
    if (bookCmd) {
      onNewMessage({
        id: `u-${Date.now()}`,
        content: trimmed,
        sender: "user",
        timestamp: new Date(),
        type: "general",
      })

      runPhaseSequence()
      setAiPhase("generating")

      await onBookService(bookCmd.service, bookCmd.slot)

      const dateStr = bookCmd.service.date || ""
      const confirmTitle = `Booked — ${bookCmd.service.service_name}`
      const confirmSub = `${bookCmd.slot}${dateStr ? ` on ${dateStr}` : ""} with ${bookCmd.service.provider_name}. Added to your calendar!`

      setDialogueTitle(confirmTitle)
      setDialogueSubtitle(confirmSub)
      setConfirmedKeys((prev) => new Set([...prev, `${bookCmd.service.service_id}-${bookCmd.slot}`]))

      callHistoryRef.current = [
        ...callHistoryRef.current,
        { role: "user", content: trimmed },
        { role: "assistant", content: `${confirmTitle}. ${confirmSub}` },
      ]

      isProcessingRef.current = false
      setAiPhase("listening")
      startListening()
      return
    }

    // 2) Normal AI chat query
    onNewMessage({
      id: `u-${Date.now()}`,
      content: trimmed,
      sender: "user",
      timestamp: new Date(),
      type: "general",
    })

    callHistoryRef.current = [...callHistoryRef.current, { role: "user", content: trimmed }]
    runPhaseSequence()

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversation_id: conversationId,
          messages: callHistoryRef.current.slice(0, -1).slice(-8),
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const replyText: string = data.reply || "I've searched for available options."
      const services: ServiceResult[] = data.services || []

      if (services.length > 0) {
        latestServicesRef.current = services
        setActiveServices(services)
      }

      // Brief generating flash before showing response
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      setAiPhase("generating")
      await new Promise<void>((r) => setTimeout(r, 350))

      // Update dialogue card
      const displayTitle = `"${replyText.replace(/\*\*/g, "").split(".")[0].substring(0, 90)}"`
      setDialogueTitle(displayTitle)
      setDialogueSubtitle(
        services.length > 0
          ? `Found ${services.length} option${services.length > 1 ? "s" : ""}. Tap a slot below or say "book at 10" to confirm.`
          : "Let me know if you'd like to adjust the time, service, or location."
      )

      onNewMessage({
        id: `a-${Date.now()}`,
        content: replyText,
        sender: "ai",
        timestamp: new Date(),
        type: services.length > 0 ? "service_list" : "general",
        services: services.length > 0 ? services : undefined,
      })

      callHistoryRef.current = [...callHistoryRef.current, { role: "assistant", content: replyText }]

    } catch (err) {
      console.error("[voice call] error:", err)
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      setDialogueTitle("Oops, something went wrong.")
      setDialogueSubtitle("I couldn't connect. Please check your backend is running and try again.")
    } finally {
      isProcessingRef.current = false
      setAiPhase("listening")
      // Re-enable mic after response is ready
      if (isOpenRef.current && !isMutedRef.current) {
        startListening()
      }
    }
  }, [conversationId, onNewMessage, onBookService, runPhaseSequence, startListening, stopListening])

  // ── Tap-to-book slot pill ─────────────────────────────────────────────────────
  const handleTapBook = useCallback(async (service: ServiceResult, slot: string) => {
    const key = `${service.service_id}-${slot}`
    if (confirmedKeys.has(key) || bookingInProgress === service.service_id) return

    stopListening()
    isProcessingRef.current = true
    setAiPhase("generating")

    await onBookService(service, slot)

    setConfirmedKeys((prev) => new Set([...prev, key]))

    const dateStr = service.date || ""
    setDialogueTitle(`Booked — ${service.service_name}`)
    setDialogueSubtitle(`${slot}${dateStr ? ` on ${dateStr}` : ""} with ${service.provider_name}. Added to your calendar!`)

    callHistoryRef.current = [
      ...callHistoryRef.current,
      { role: "assistant", content: `Booked ${service.service_name} at ${slot} with ${service.provider_name}.` },
    ]

    isProcessingRef.current = false
    setAiPhase("listening")
    if (isOpenRef.current && !isMutedRef.current) startListening()
  }, [confirmedKeys, bookingInProgress, onBookService, stopListening, startListening])

  // ── Speech Recognition setup (stable single instance) ────────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Modal closed — tear everything down
      isOpenRef.current = false
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      stopListening()

      // Destroy the recognition instance so mic is fully released
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        recognitionRef.current = null
      }
      return
    }

    // ── Modal opened — reset all state ────────────────────────────────────────
    isOpenRef.current = true
    isProcessingRef.current = false
    finalAccumRef.current = ""
    callHistoryRef.current = []
    latestServicesRef.current = []

    setLiveTranscript("")
    setActiveServices([])
    setConfirmedKeys(new Set())
    setAiPhase("listening")
    setIsListening(false)
    setIsMuted(false)
    isMutedRef.current = false
    setDialogueTitle("Hello! How can I help you today?")
    setDialogueSubtitle("Tell me what service you're looking for and I'll find available openings.")

    // ── Setup Web Speech API ──────────────────────────────────────────────────
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setDialogueTitle("Browser not supported")
      setDialogueSubtitle("Your browser doesn't support voice input. Try Chrome or Edge.")
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true       // keep mic open between phrases
    recognition.interimResults = true   // get live transcript as user speaks
    recognition.lang = "en-IN"          // Indian English (works for most EN accents)
    recognition.maxAlternatives = 1

    // ── onstart: mic is now live ──────────────────────────────────────────────
    recognition.onstart = () => {
      setIsListening(true)
    }

    // ── onresult: process live STT output ────────────────────────────────────
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Ignore results if we're already processing or muted
      if (isProcessingRef.current || isMutedRef.current) return

      let newFinal = ""
      let latestInterim = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          newFinal += transcript
        } else {
          latestInterim = transcript
        }
      }

      // Accumulate finals across this speaking turn
      if (newFinal) {
        finalAccumRef.current = (finalAccumRef.current + " " + newFinal).trim()
      }

      // Show live: accumulated finals + current interim
      const displayText = [finalAccumRef.current, latestInterim].filter(Boolean).join(" ").trim()
      if (displayText) {
        setLiveTranscript(`"${displayText}"`)
      }

      // Restart 3-second silence timer every time we get a final result
      if (newFinal.trim()) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(() => {
          const query = finalAccumRef.current.trim()
          if (query) {
            processUserSpeech(query)
          }
        }, 3000)
      }
    }

    // ── onerror: handle recognition errors gracefully ─────────────────────────
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      switch (event.error) {
        case "no-speech":
          // Normal — user just isn't speaking, ignore
          break
        case "audio-capture":
          setDialogueTitle("Microphone not found")
          setDialogueSubtitle("Please check your microphone is connected and permissions are granted.")
          break
        case "not-allowed":
          setDialogueTitle("Microphone access denied")
          setDialogueSubtitle("Please allow microphone access in your browser settings.")
          break
        default:
          console.warn("[SpeechRecognition] error:", event.error)
      }
    }

    // ── onend: recognition stopped — restart only if still should be listening ─
    recognition.onend = () => {
      setIsListening(false)

      // Only auto-restart if:
      // 1. Modal is still open
      // 2. NOT currently processing an API call (we stopped it intentionally)
      // 3. Mic is not muted
      if (isOpenRef.current && !isProcessingRef.current && !isMutedRef.current) {
        try {
          recognition.start()
        } catch {
          // Ignore — already starting
        }
      }
    }

    recognitionRef.current = recognition

    // Start recognition immediately when modal opens
    try {
      recognition.start()
    } catch (err) {
      console.warn("[SpeechRecognition] could not start:", err)
    }

    return () => {
      // Cleanup on unmount
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      recognition.onstart = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try { recognition.stop() } catch { /* ok */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Note: processUserSpeech is intentionally excluded from deps above.
  // It's stable via useCallback but re-creating recognition on every render
  // would destroy the single-instance model. We use refs for all callbacks
  // that processUserSpeech needs.
  // Instead, keep processUserSpeech up-to-date via a ref:
  const processUserSpeechRef = useRef(processUserSpeech)
  useEffect(() => {
    processUserSpeechRef.current = processUserSpeech
  }, [processUserSpeech])

  // ── Mute / Unmute ────────────────────────────────────────────────────────────
  const handleToggleMute = useCallback(() => {
    // Can't toggle mute while AI is generating a response
    if (isProcessingRef.current) return

    setIsMuted((prev) => {
      const next = !prev
      isMutedRef.current = next
      if (next) {
        // Muting: stop mic, clear any pending silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        finalAccumRef.current = ""
        setLiveTranscript("")
        stopListening()
      } else {
        // Unmuting: restart mic
        startListening()
      }
      return next
    })
  }, [stopListening, startListening])

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!isOpen) return null

  const isProcessing = aiPhase === "thinking" || aiPhase === "processing" || aiPhase === "generating"

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        className="fixed inset-0 z-[100] flex flex-col bg-[#fff8f4] dark:bg-[#151210] text-[#231a11] dark:text-stone-100 font-sans overflow-hidden select-none"
      >
        {/* Ambient background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-[#ff5722]/15 dark:bg-orange-500/10 blur-[130px] animate-pulse pointer-events-none z-0" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[65vw] h-[65vw] rounded-full bg-[#fdebdc] dark:bg-stone-800/25 blur-[140px] pointer-events-none z-0" />
        {isProcessing && (
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-orange-500/5 pointer-events-none z-0 animate-pulse" />
        )}

        {/* ── Top Nav ── */}
        <nav className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-orange-100/70 dark:border-stone-800/80 bg-white/50 dark:bg-stone-950/50 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-lg sm:text-xl text-[#b02f00] dark:text-orange-400 tracking-tight">ScheduleAI</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-stone-800 text-[#b02f00] dark:text-orange-400 border border-orange-200/60 dark:border-stone-700">
              Live Voice
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-orange-200/50 dark:border-stone-700 shadow-2xs">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </div>
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">Connected</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-orange-100/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* ── Main Canvas ── */}
        <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 py-6 overflow-y-auto w-full max-w-4xl mx-auto pb-36">

          {/* ── Glowing Voice Sphere ── */}
          <div className="relative flex items-center justify-center my-4 md:my-6 shrink-0">

            {/* Ripple rings per phase */}
            {aiPhase === "listening" && isListening && !isMuted && (
              <motion.div
                animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.08, 0.45] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -inset-6 rounded-full border border-[#ff5722]/35 pointer-events-none"
              />
            )}

            {/* Processing spinning ring */}
            {isProcessing && (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-8 rounded-full border-2 border-dashed border-violet-400/50 pointer-events-none"
                />
                <motion.div
                  animate={{ scale: [1, 1.28, 1], opacity: [0.3, 0.05, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -inset-14 rounded-full border border-amber-400/25 pointer-events-none"
                />
              </>
            )}

            {/* Core sphere */}
            <motion.div
              animate={{
                scale: isProcessing ? [1, 1.05, 1] : [1, 1.025, 1],
                boxShadow: isProcessing
                  ? "0 0 65px 22px rgba(139, 92, 246, 0.22)"
                  : "0 0 45px 12px rgba(176, 47, 0, 0.2)",
              }}
              transition={{ duration: isProcessing ? 1.6 : 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-gradient-to-br from-[#b02f00] via-[#ff5722] to-[#ffb5a0] flex items-center justify-center border-2 border-white/40 shadow-2xl backdrop-blur-md"
            >
              <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-full border border-white/35 flex items-center justify-center bg-white/10 backdrop-blur-xs">
                {aiPhase === "thinking"    && <Brain   className="w-14 h-14 sm:w-16 sm:h-16 text-white animate-pulse" />}
                {aiPhase === "processing"  && <Cpu     className="w-14 h-14 sm:w-16 sm:h-16 text-white animate-spin" style={{ animationDuration: "2.5s" }} />}
                {aiPhase === "generating"  && <Zap     className="w-14 h-14 sm:w-16 sm:h-16 text-white animate-bounce" />}
                {aiPhase === "listening"   && (
                  isMuted
                    ? <MicOff className="w-14 h-14 sm:w-16 sm:h-16 text-white/70" />
                    : <Mic    className={`w-14 h-14 sm:w-16 sm:h-16 text-white drop-shadow-md ${isListening ? "animate-pulse" : ""}`} />
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Phase Status Badge ── */}
          <div className="flex items-center gap-2 mb-3">
            {aiPhase === "thinking" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-xs font-bold uppercase tracking-wider border border-violet-200 dark:border-violet-800">
                <Brain className="w-3.5 h-3.5 animate-pulse" /> Thinking...
              </span>
            )}
            {aiPhase === "processing" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800">
                <Cpu className="w-3.5 h-3.5 animate-spin" /> Searching schedules...
              </span>
            )}
            {aiPhase === "generating" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#b02f00] dark:text-orange-400 text-xs font-bold uppercase tracking-wider border border-orange-200 dark:border-orange-800">
                <Zap className="w-3.5 h-3.5 animate-bounce" /> Generating response...
              </span>
            )}
            {aiPhase === "listening" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 dark:bg-stone-900/80 text-stone-600 dark:text-stone-400 text-xs font-semibold uppercase tracking-wider border border-orange-200/40 dark:border-stone-800">
                {isMuted
                  ? <><MicOff className="w-3.5 h-3.5 text-red-500" /> Microphone Muted</>
                  : isListening
                  ? <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Listening — speak now</>
                  : "Ready"}
              </span>
            )}
          </div>

          {/* ── AI Dialogue Card ── */}
          <div className="w-full max-w-2xl space-y-4 text-center z-10">
            <motion.div
              key={dialogueTitle}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/75 dark:bg-stone-900/75 backdrop-blur-2xl p-6 sm:p-8 rounded-[2rem] shadow-xl border border-white/60 dark:border-stone-800"
            >
              <h2 className="font-extrabold text-lg sm:text-xl text-[#b02f00] dark:text-orange-400 mb-2 leading-snug">
                {dialogueTitle}
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 font-medium max-w-xl mx-auto leading-relaxed">
                {dialogueSubtitle}
              </p>
            </motion.div>

            {/* ── Live Transcript ── */}
            <div className="min-h-[50px] flex items-center justify-center px-4">
              {liveTranscript ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2.5 text-xs sm:text-sm text-stone-700 dark:text-stone-200 italic bg-white/70 dark:bg-stone-900/70 px-5 py-2.5 rounded-full border border-orange-200/60 dark:border-stone-800 shadow-sm max-w-lg"
                >
                  <span className="line-clamp-2 text-left">{liveTranscript}</span>
                  <span className="flex gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 bg-[#ff5722] rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-[#ff5722] rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <span className="w-1.5 h-1.5 bg-[#ff5722] rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                  </span>
                </motion.div>
              ) : (
                <p className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 tracking-wide uppercase">
                  {isProcessing
                    ? "Processing your request..."
                    : isMuted
                    ? "Tap mic to unmute"
                    : "Speak naturally — auto-sends after 3s of silence"}
                </p>
              )}
            </div>

            {/* ── Available Booking Service Cards ── */}
            {activeServices.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-3 p-3.5 sm:p-4 bg-white/60 dark:bg-stone-950/60 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-stone-800 shadow-lg text-left"
              >
                <div className="flex items-center justify-between px-2 pb-1 border-b border-orange-100/50 dark:border-stone-800">
                  <span className="text-xs font-extrabold text-stone-800 dark:text-stone-200 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#ff5722]" />
                    Available Openings:
                  </span>
                  <span className="text-[11px] text-stone-500 font-medium">Tap a slot or say "book at 10"</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                  {activeServices.map((svc) => (
                    <div
                      key={svc.service_id}
                      className="p-3.5 bg-white/90 dark:bg-stone-900/90 rounded-xl border border-orange-200/50 dark:border-stone-700 shadow-xs flex flex-col gap-2.5 hover:border-orange-300 dark:hover:border-stone-600 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <h4 className="font-extrabold text-xs sm:text-sm text-stone-900 dark:text-stone-100 line-clamp-1">
                            {svc.service_name}
                          </h4>
                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-orange-100 dark:bg-stone-800 text-[#b02f00] dark:text-orange-400 shrink-0">
                            ₹{svc.price}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400">
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-[#ff5722] shrink-0" />
                            {svc.provider_name} ({svc.location})
                          </span>
                          <span className="flex items-center gap-0.5 text-amber-600 font-semibold shrink-0">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {svc.rating}
                          </span>
                        </div>
                        {svc.date && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-stone-500 dark:text-stone-400">
                            <Calendar className="w-3 h-3 text-[#b02f00]" />
                            {svc.date} · {svc.duration_minutes} min
                          </div>
                        )}
                      </div>

                      {/* Slot buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-orange-100/40 dark:border-stone-800">
                        {(svc.available_slots || []).slice(0, 4).map((slot) => {
                          const key = `${svc.service_id}-${slot}`
                          const isConfirmed = confirmedKeys.has(key)
                          const isBooking = bookingInProgress === svc.service_id
                          return (
                            <button
                              key={slot}
                              onClick={() => !isConfirmed && !isBooking && handleTapBook(svc, slot)}
                              disabled={isBooking || isConfirmed}
                              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                isConfirmed
                                  ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 cursor-default"
                                  : "bg-orange-500/10 dark:bg-orange-500/20 text-[#b02f00] dark:text-orange-400 hover:bg-[#b02f00] hover:text-white active:scale-95 border border-orange-200/50 dark:border-stone-700"
                              } disabled:opacity-60`}
                            >
                              {isBooking ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isConfirmed ? (
                                <><CheckCircle2 className="h-3 w-3" /><span>{slot}</span></>
                              ) : (
                                slot
                              )}
                            </button>
                          )
                        })}
                        {(svc.available_slots || []).length === 0 && (
                          <span className="text-[10px] text-stone-400 italic">No slots available</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Bottom Floating Control Bar ── */}
          <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-5 sm:gap-6 bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl px-7 sm:px-8 py-3.5 sm:py-4 rounded-full border border-white/60 dark:border-stone-700 shadow-[0_15px_40px_rgba(176,47,0,0.18)]">

            {/* Mute Button — disabled during processing */}
            <button
              onClick={handleToggleMute}
              disabled={isProcessing}
              title={isProcessing ? "Mic locked while processing..." : isMuted ? "Unmute Microphone" : "Mute Microphone"}
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isMuted
                  ? "bg-red-100 dark:bg-red-950/60 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400"
                  : "bg-white/90 dark:bg-stone-800/90 border-white/50 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-[#b02f00]"
              }`}
            >
              {isMuted ? <MicOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Mic className="h-5 w-5 sm:h-6 sm:w-6" />}
            </button>

            {/* End Call */}
            <button
              onClick={onClose}
              title="End Voice Call"
              className="px-7 sm:px-9 py-3.5 sm:py-4 rounded-full bg-[#ba1a1a] hover:bg-[#93000a] text-white flex items-center gap-2.5 sm:gap-3 transition-all duration-300 shadow-[0_10px_25px_rgba(186,26,26,0.35)] active:scale-95 border border-red-400/40 cursor-pointer font-extrabold text-xs sm:text-sm tracking-wide"
            >
              <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>End Call</span>
            </button>

            {/* Speaker placeholder (TTS disabled per user request) */}
            <button
              title="Audio output off (TTS disabled)"
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border cursor-default opacity-40 bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400"
            >
              <VolumeX className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </main>
      </motion.div>
    </AnimatePresence>
  )
}
