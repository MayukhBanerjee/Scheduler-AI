"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, User, Mic, Send, Loader2, PlusCircle, Check, X, Sparkles } from "lucide-react"
import { Message, ServiceResult } from "./types"
import { ServiceCard } from "./service-card"

const QUICK_PROMPTS = [
  { label: "👋 How's your day?", text: "Hey! How's your day going?" },
  { label: "💆 Help me unwind", text: "I had such a stressful week, help me unwind." },
  { label: "💇 Haircut in Indiranagar", text: "Can you recommend the best place for a haircut in Indiranagar?" },
  { label: "✨ Balayage vs Highlights", text: "What's the difference between balayage and highlights?" },
  { label: "🦷 Dental Cleaning advice", text: "How often should I actually get my teeth cleaned?" },
  { label: "☕ Work cafes in Bangalore", text: "What are some of the best quiet work cafes in Bangalore?" },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  messages: Message[]
  inputMessage: string
  setInputMessage: (val: string) => void
  isTyping: boolean
  isListening: boolean
  speechSupported: boolean
  toggleVoice: () => void
  openVoiceCall?: () => void
  handleSendMessage: (customText?: string) => void
  handleKeyPress: (e: React.KeyboardEvent) => void
  bookingInProgress: string | null
  handleBookService: (service: ServiceResult, slot: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  renderRichText: (content: string) => React.ReactNode
  onNewConversation?: () => void
}

// ─── New Chat Button with 2-step confirmation ─────────────────────────────────

function NewChatButton({
  onConfirm,
  hasMessages,
}: {
  onConfirm: () => void
  hasMessages: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-dismiss after 4 seconds if user doesn't confirm
  useEffect(() => {
    if (confirming) {
      timerRef.current = setTimeout(() => setConfirming(false), 4000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [confirming])

  const handleClick = () => {
    // If no real messages (only welcome), just start fresh immediately
    if (!hasMessages) {
      onConfirm()
      return
    }
    setConfirming(true)
  }

  const handleConfirm = () => {
    setConfirming(false)
    onConfirm()
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={handleClick}
        title="Start a new conversation"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-stone-800/80 hover:bg-orange-50 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-[#b02f00] dark:hover:text-orange-400 text-xs font-bold border border-orange-200/50 dark:border-stone-700 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        <PlusCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">New Chat</span>
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-stone-800 border border-orange-300/60 dark:border-orange-700/40 shadow-sm"
    >
      <span className="text-[11px] font-bold text-stone-700 dark:text-stone-200 whitespace-nowrap">
        Start fresh?
      </span>
      {/* Confirm */}
      <button
        type="button"
        onClick={handleConfirm}
        title="Yes — start new conversation"
        className="w-5 h-5 rounded-full bg-[#b02f00] hover:bg-[#902700] text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer"
      >
        <Check className="h-3 w-3" />
      </button>
      {/* Cancel */}
      <button
        type="button"
        onClick={() => setConfirming(false)}
        title="Cancel"
        className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-600 dark:text-stone-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  )
}

// ─── Chat Interface ───────────────────────────────────────────────────────────

export function ChatInterface({
  messages,
  inputMessage,
  setInputMessage,
  isTyping,
  isListening,
  speechSupported,
  toggleVoice,
  openVoiceCall,
  handleSendMessage,
  handleKeyPress,
  bookingInProgress,
  handleBookService,
  messagesEndRef,
  inputRef,
  renderRichText,
  onNewConversation,
}: ChatInterfaceProps) {
  const triggerLiveVoice = openVoiceCall || toggleVoice

  return (
    <div className="glass-card rounded-[1.75rem] h-full flex-1 flex flex-col relative overflow-hidden min-h-0 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-[0_4px_30px_rgba(0,0,0,0.04)]">

      {/* ── Chat Header ── */}
      <div className="p-3.5 sm:p-4 border-b border-orange-100/60 dark:border-stone-800 flex justify-between items-center bg-white/40 dark:bg-stone-950/40 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#b02f00]/15 to-orange-500/20 text-[#b02f00] dark:text-orange-400 flex items-center justify-center shadow-xs shrink-0 ring-1 ring-orange-500/20">
            <Sparkles className="h-4 w-4 text-[#b02f00] dark:text-orange-400" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100 tracking-tight leading-tight flex items-center gap-1.5">
              <span>ScheduleAI</span>
              <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 hidden sm:inline">• Your All-Knowing AI Friend</span>
            </h2>
            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Always online • Casual chat, expert advice & verified booking
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* New Chat */}
          {onNewConversation && (
            <NewChatButton
              onConfirm={onNewConversation}
              hasMessages={messages.length > 1}
            />
          )}

          {/* Live Call */}
          <button
            type="button"
            onClick={triggerLiveVoice}
            title="Start Live Voice Call with ScheduleAI"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white text-xs font-bold shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Mic className="h-3.5 w-3.5 animate-pulse" />
            <span className="hidden sm:inline">Live Call</span>
          </button>
        </div>
      </div>

      {/* ── Messages Scroll Area ── */}
      <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto flex flex-col gap-3.5 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3 }}
              className={`flex gap-2.5 max-w-[88%] ${message.sender === "user" ? "self-end flex-row-reverse" : "self-start"}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 shadow-xs ${
                  message.sender === "user"
                    ? "bg-gradient-to-tr from-[#b02f00] to-[#ff5722] text-white"
                    : "bg-orange-100 text-[#b02f00] dark:bg-orange-950 dark:text-orange-400"
                }`}
              >
                {message.sender === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>

              {/* Bubble */}
              <div className="flex flex-col gap-1 min-w-0">
                <div
                  className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                    message.sender === "user"
                      ? "bg-gradient-to-tr from-[#b02f00] to-[#ff5722] text-white rounded-tr-sm"
                      : "bg-white/80 dark:bg-stone-900/80 text-stone-900 dark:text-stone-100 rounded-tl-sm border border-orange-100 dark:border-stone-800 backdrop-blur-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap font-sans">{renderRichText(message.content)}</p>
                </div>

                {/* Service Cards */}
                {message.services && message.services.length > 0 && (
                  <div className="flex flex-col gap-2.5 mt-2 w-full">
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

                {/* Timestamp */}
                <span
                  className={`text-[9px] font-semibold text-stone-500 dark:text-stone-400 px-1 ${
                    message.sender === "user" ? "self-end" : "self-start"
                  }`}
                >
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Loader */}
        {isTyping && (
          <div className="flex gap-2.5 self-start max-w-[88%] items-center">
            <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-stone-800 text-[#b02f00] dark:text-orange-400 flex items-center justify-center text-xs">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="bg-white/80 dark:bg-stone-900/80 border border-orange-100 dark:border-stone-800 rounded-2xl rounded-tl-sm px-3 py-2 shadow-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff5722]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Conversational Starters Bar ── */}
      <div className="px-3 pt-2 pb-1.5 border-t border-orange-100/60 dark:border-stone-800 bg-white/30 dark:bg-stone-950/30 backdrop-blur-xs shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider shrink-0 px-1">
            Try:
          </span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(qp.text)}
              disabled={isTyping}
              className="text-[11px] font-medium whitespace-nowrap px-2.5 py-1 rounded-full bg-white/90 dark:bg-stone-800/90 hover:bg-orange-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 hover:text-[#b02f00] dark:hover:text-orange-400 border border-orange-200/60 dark:border-stone-700 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input Bar ── */}
      <div className="p-3 bg-white/50 dark:bg-stone-950/50 backdrop-blur-md border-t border-orange-100/60 dark:border-stone-800 shrink-0 z-10">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask me anything, chat about your day, or book a service..."
            disabled={isTyping}
            className="w-full bg-white/90 dark:bg-stone-900/90 border border-orange-200/60 dark:border-stone-700 rounded-full py-2.5 pl-5 pr-20 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#b02f00] focus:ring-2 focus:ring-orange-500/20 transition-all shadow-inner placeholder:text-stone-400"
          />

          {/* Inline Mic */}
          <button
            type="button"
            onClick={triggerLiveVoice}
            title="Start Live Voice Call"
            className="absolute right-9 w-7 h-7 rounded-full bg-orange-100/70 dark:bg-stone-800 text-[#b02f00] dark:text-orange-400 hover:bg-orange-200/80 dark:hover:bg-stone-700 flex items-center justify-center transition-all cursor-pointer"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>

          {/* Send */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isTyping}
            className="absolute right-1.5 w-7 h-7 rounded-full bg-gradient-to-tr from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isTyping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 ml-0.5" />}
          </button>
        </div>

        <p className="text-center text-[10px] font-semibold text-stone-500 dark:text-stone-400 mt-1.5">
          Tap <strong className="text-[#b02f00] dark:text-orange-400">Live Call</strong> or the mic icon to talk in real-time
        </p>
      </div>
    </div>
  )
}
