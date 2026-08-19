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
} from "lucide-react"
import { Message, ServiceResult } from "./types"

interface LiveVoiceCallModalProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
  onNewMessage: (message: Message) => void
  onBookService: (service: ServiceResult, slot: string) => void
  bookingInProgress: string | null
}

export function LiveVoiceCallModal({
  isOpen,
  onClose,
  conversationId,
  onNewMessage,
  onBookService,
  bookingInProgress,
}: LiveVoiceCallModalProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [aiSpeechState, setAiSpeechState] = useState<"listening" | "thinking" | "speaking">("listening")
  const [currentAiText, setCurrentAiText] = useState("Hello! I'm listening.")
  const [currentAiSubtitle, setCurrentAiSubtitle] = useState("How can I help you book or manage your appointments today?")
  const [liveTranscript, setLiveTranscript] = useState("")
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [latestServices, setLatestServices] = useState<ServiceResult[]>([])

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isMutedRef = useRef(isMuted)
  const isSpeakerOnRef = useRef(isSpeakerOn)
  const isProcessingRef = useRef(false)

  // Keep refs synced
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn
  }, [isSpeakerOn])

  // Text-To-Speech function
  const speakText = useCallback((text: string, onComplete?: () => void) => {
    if (!isSpeakerOnRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (onComplete) onComplete()
      return
    }

    try {
      window.speechSynthesis.cancel() // Stop any previous speech
      // Clean markdown tags from spoken text
      const cleanText = text
        .replace(/\*\*/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[#_`~]/g, "")
        .replace(/\n+/g, " ")

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.rate = 1.05
      utterance.pitch = 1.0

      // Try selecting a natural English voice
      const voices = window.speechSynthesis.getVoices()
      const preferredVoice = voices.find(
        (v) =>
          (v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Karen"))) ||
          v.lang === "en-US" ||
          v.lang === "en-GB"
      )
      if (preferredVoice) {
        utterance.voice = preferredVoice
      }

      utterance.onstart = () => {
        setAiSpeechState("speaking")
      }

      utterance.onend = () => {
        setAiSpeechState("listening")
        if (onComplete) onComplete()
      }

      utterance.onerror = () => {
        setAiSpeechState("listening")
        if (onComplete) onComplete()
      }

      window.speechSynthesis.speak(utterance)
    } catch {
      setAiSpeechState("listening")
      if (onComplete) onComplete()
    }
  }, [])

  // Send speech transcript to backend AI agent
  const processUserSpeech = useCallback(
    async (spokenQuery: string) => {
      const trimmed = spokenQuery.trim()
      if (!trimmed || isProcessingRef.current) return

      isProcessingRef.current = true
      setAiSpeechState("thinking")
      setLiveTranscript(trimmed)

      // Add user message to parent chat state
      const userMsg: Message = {
        id: Date.now().toString(),
        content: trimmed,
        sender: "user",
        timestamp: new Date(),
        type: "general",
      }
      onNewMessage(userMsg)

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversation_id: conversationId,
          }),
        })

        if (!res.ok) {
          throw new Error("Chat request failed")
        }

        const data = await res.json()
        const replyText = data.reply || "I've checked our schedule for you."
        const servicesFound = (data.services || []) as ServiceResult[]

        setCurrentAiText(`"${replyText.substring(0, 80)}${replyText.length > 80 ? "..." : ""}"`)
        setCurrentAiSubtitle(
          servicesFound.length > 0
            ? `Found ${servicesFound.length} matching service option(s). Tap any slot below to book!`
            : "Let me know if you would like to refine your request or book another time."
        )

        if (servicesFound.length > 0) {
          setLatestServices(servicesFound)
        }

        // Add AI message to parent chat state
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          content: replyText,
          sender: "ai",
          timestamp: new Date(),
          type: servicesFound.length > 0 ? "service_list" : "general",
          services: servicesFound,
        }
        onNewMessage(aiMsg)

        // Speak the reply
        speakText(replyText, () => {
          setLiveTranscript("")
        })
      } catch (err) {
        console.error("Live voice call error:", err)
        const errMsg = "I had trouble processing that. Could you please try again?"
        setCurrentAiText(`"${errMsg}"`)
        setCurrentAiSubtitle("Please check your connection and speak again.")
        speakText(errMsg)
      } finally {
        isProcessingRef.current = false
      }
    },
    [conversationId, onNewMessage, speakText]
  )

  // Initialize Speech Recognition when modal opens
  useEffect(() => {
    if (!isOpen) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      return
    }

    // Greet user on call connect
    const initialGreeting = "Hello! I'm listening. How can I help you book or manage your appointments today?"
    setCurrentAiText('"Hello! I\'m listening."')
    setCurrentAiSubtitle("How can I help you book or manage your appointments today?")
    setLiveTranscript("")
    setLatestServices([])

    const timer = setTimeout(() => {
      speakText(initialGreeting)
    }, 400)

    // Setup Speech Recognition
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onstart = () => {
        setIsRecognizing(true)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (isMutedRef.current || isProcessingRef.current) return

        let interim = ""
        let final = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            final += transcript
          } else {
            interim += transcript
          }
        }

        const currentSpoken = final || interim
        if (currentSpoken) {
          setLiveTranscript(`"${currentSpoken.trim()}"`)
        }

        // Debounced final speech processing
        if (final.trim()) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = setTimeout(() => {
            processUserSpeech(final)
          }, 600)
        }
      }

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error !== "no-speech") {
          console.warn("Speech recognition error:", e.error)
        }
      }

      recognition.onend = () => {
        setIsRecognizing(false)
        // Automatically restart listening if call is still active and not muted
        if (isOpen && !isMutedRef.current && !isProcessingRef.current) {
          try {
            recognition.start()
          } catch {
            // ignore
          }
        }
      }

      try {
        recognition.start()
        recognitionRef.current = recognition
      } catch (err) {
        console.warn("Could not start speech recognition:", err)
      }
    }

    return () => {
      clearTimeout(timer)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [isOpen, processUserSpeech, speakText])

  // Toggle Mute
  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev
      if (next) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop()
          } catch {
            // ignore
          }
        }
      } else {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch {
            // ignore
          }
        }
      }
      return next
    })
  }

  // Toggle Speaker (TTS)
  const handleToggleSpeaker = () => {
    setIsSpeakerOn((prev) => {
      const next = !prev
      if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      return next
    })
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-[#fff8f4] dark:bg-[#1c1917] text-[#231a11] dark:text-stone-100 font-sans overflow-hidden select-none"
      >
        {/* Ambient Organic Blurred Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-[#ff5722]/15 dark:bg-orange-500/10 blur-[130px] animate-pulse pointer-events-none z-0" />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[65vw] h-[65vw] rounded-full bg-[#f7e5d7] dark:bg-stone-800/20 blur-[120px] pointer-events-none z-0"
          style={{ animationDuration: "12s" }}
        />

        {/* Top Header Navigation */}
        <nav className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-orange-100/60 dark:border-stone-800 bg-white/40 dark:bg-stone-950/40 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg sm:text-xl text-[#b02f00] dark:text-orange-400 tracking-tight">
              ScheduleAI
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-stone-800 text-[#b02f00] dark:text-orange-400 border border-orange-200/60 dark:border-stone-700">
              Live Voice
            </span>
          </div>

          <div className="flex items-center gap-2.5 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-orange-200/50 dark:border-stone-700 shadow-2xs">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </div>
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Connected to ScheduleAI Assistant
            </span>
          </div>
        </nav>

        {/* Main Live Voice Canvas */}
        <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 py-6 overflow-y-auto max-w-4xl mx-auto w-full">
          {/* Central Hero: Glowing Voice Sphere with Soundwave Rings */}
          <div className="relative flex items-center justify-center my-6">
            {/* Animated Soundwave Ripples */}
            {aiSpeechState === "speaking" && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0.05, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -inset-10 rounded-full border-2 border-[#ff5722]/30 pointer-events-none"
                />
                <motion.div
                  animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  className="absolute -inset-16 rounded-full border border-[#ff5722]/20 pointer-events-none"
                />
              </>
            )}

            {aiSpeechState === "listening" && isRecognizing && (
              <motion.div
                animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -inset-6 rounded-full border border-[#ff5722]/40 pointer-events-none"
              />
            )}

            {/* Glowing Core Sphere */}
            <motion.div
              animate={{
                scale: aiSpeechState === "speaking" ? [1, 1.06, 1] : [1, 1.02, 1],
                boxShadow:
                  aiSpeechState === "speaking"
                    ? "0 0 60px 20px rgba(255, 87, 34, 0.35)"
                    : "0 0 40px 10px rgba(176, 47, 0, 0.2)",
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-gradient-to-br from-[#b02f00] via-[#ff5722] to-[#ffb5a0] flex items-center justify-center border-2 border-white/40 shadow-2xl backdrop-blur-md"
            >
              {/* Inner Glowing Ring */}
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border border-white/40 flex items-center justify-center bg-white/10 backdrop-blur-xs">
                {aiSpeechState === "thinking" ? (
                  <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 text-white animate-spin opacity-95" />
                ) : isMuted ? (
                  <MicOff className="w-12 h-12 sm:w-16 sm:h-16 text-white/80 drop-shadow-md" />
                ) : (
                  <Mic className="w-12 h-12 sm:w-16 sm:h-16 text-white drop-shadow-md animate-pulse" />
                )}
              </div>
            </motion.div>
          </div>

          {/* AI Response Card & Dynamic Dialogue */}
          <div className="w-full max-w-xl space-y-4 text-center mt-2 z-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-2xl p-6 sm:p-7 rounded-[2rem] shadow-xl border border-white/60 dark:border-stone-800 transition-all hover:bg-white/85 dark:hover:bg-stone-900/85"
            >
              <p className="font-extrabold text-lg sm:text-xl text-[#b02f00] dark:text-orange-400 mb-2 leading-snug">
                {currentAiText}
              </p>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 font-medium">
                {currentAiSubtitle}
              </p>
            </motion.div>

            {/* Real-time Transcription Stream */}
            <div className="min-h-[44px] flex items-center justify-center px-4">
              {liveTranscript ? (
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 italic bg-white/50 dark:bg-stone-900/50 px-4 py-2 rounded-full border border-orange-200/50 dark:border-stone-800 shadow-2xs animate-fade-in flex items-center gap-2">
                  <span>{liveTranscript}</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#ff5722] rounded-full animate-bounce" />
                    <span
                      className="w-1.5 h-1.5 bg-[#ff5722] rounded-full animate-bounce"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-[#ff5722] rounded-full animate-bounce"
                      style={{ animationDelay: "0.3s" }}
                    />
                  </span>
                </p>
              ) : (
                <p className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 tracking-wide uppercase">
                  {aiSpeechState === "speaking" ? "AI is speaking..." : isMuted ? "Microphone Muted" : "Listening for your voice..."}
                </p>
              )}
            </div>

            {/* Interactive Live Booking Cards (if services returned during call) */}
            {latestServices.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-h-48 overflow-y-auto space-y-2.5 p-2 bg-white/40 dark:bg-stone-950/40 rounded-2xl border border-white/50 dark:border-stone-800 text-left"
              >
                <div className="flex items-center justify-between px-2">
                  <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-[#ff5722]" /> Available Booking Options:
                  </span>
                  <span className="text-[10px] text-stone-500 font-medium">Tap slot to confirm</span>
                </div>

                {latestServices.slice(0, 2).map((svc) => (
                  <div
                    key={svc.service_id}
                    className="p-3 bg-white/90 dark:bg-stone-900/90 rounded-xl border border-orange-200/50 dark:border-stone-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-stone-900 dark:text-stone-100">
                          {svc.service_name}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-stone-800 text-[#b02f00] dark:text-orange-400">
                          ₹{svc.price}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">
                        {svc.provider_name} • {svc.location}
                      </p>
                    </div>

                    {/* Slot Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(svc.available_slots || []).slice(0, 3).map((slot) => (
                        <button
                          key={slot}
                          onClick={() => onBookService(svc, slot)}
                          disabled={bookingInProgress === svc.service_id}
                          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-orange-500/10 dark:bg-orange-500/20 text-[#b02f00] dark:text-orange-400 hover:bg-[#b02f00] hover:text-white transition-all cursor-pointer disabled:opacity-50"
                        >
                          {bookingInProgress === svc.service_id ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            slot
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Bottom Floating Control Bar */}
          <div className="mt-8 mb-4 flex items-center gap-5 sm:gap-6 bg-white/75 dark:bg-stone-900/75 backdrop-blur-2xl px-6 sm:px-8 py-3.5 sm:py-4 rounded-full border border-white/50 dark:border-stone-700 shadow-2xl">
            {/* Mute Toggle */}
            <button
              onClick={handleToggleMute}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border active:scale-95 cursor-pointer ${
                isMuted
                  ? "bg-red-100 dark:bg-red-950/60 border-red-200 text-red-600 dark:text-red-400"
                  : "bg-white/90 dark:bg-stone-800/90 border-white/50 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-[#b02f00]"
              }`}
            >
              {isMuted ? <MicOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Mic className="h-5 w-5 sm:h-6 sm:w-6" />}
            </button>

            {/* End Call Button */}
            <button
              onClick={onClose}
              title="End Voice Call"
              className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-[#ba1a1a] hover:bg-[#93000a] text-white flex items-center gap-2.5 transition-all duration-300 shadow-[0_10px_25px_rgba(186,26,26,0.35)] active:scale-95 border border-red-400/40 cursor-pointer font-extrabold text-xs sm:text-sm tracking-wide"
            >
              <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>End Call</span>
            </button>

            {/* Speaker Toggle */}
            <button
              onClick={handleToggleSpeaker}
              title={isSpeakerOn ? "Mute Voice Speaker" : "Enable Voice Speaker"}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border active:scale-95 cursor-pointer ${
                !isSpeakerOn
                  ? "bg-stone-200 dark:bg-stone-800 border-stone-300 text-stone-400"
                  : "bg-white/90 dark:bg-stone-800/90 border-white/50 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-[#b02f00]"
              }`}
            >
              {isSpeakerOn ? <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <VolumeX className="h-5 w-5 sm:h-6 sm:w-6" />}
            </button>
          </div>
        </main>
      </motion.div>
    </AnimatePresence>
  )
}
