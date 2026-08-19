"use client"

import type React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, User, Mic, Send, Loader2 } from "lucide-react"
import { Message, ServiceResult } from "./types"
import { ServiceCard } from "./service-card"

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
}

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
}: ChatInterfaceProps) {
  const triggerLiveVoice = openVoiceCall || toggleVoice

  return (
    <div className="glass-card rounded-[1.75rem] h-full flex-1 flex flex-col relative overflow-hidden min-h-0 bg-white/70 dark:bg-stone-900/70 backdrop-blur-xl border border-white/60 dark:border-stone-800 shadow-[0_4px_30px_rgba(0,0,0,0.04)]">
      {/* Chat Header */}
      <div className="p-3.5 sm:p-4 border-b border-orange-100/60 dark:border-stone-800 flex justify-between items-center bg-white/40 dark:bg-stone-950/40 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-[#b02f00] dark:text-orange-400 flex items-center justify-center shadow-xs shrink-0">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100 tracking-tight leading-tight">
              AI Booking Assistant
            </h2>
            <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Verified Availability Engine
            </p>
          </div>
        </div>

        {/* Live Call Action Button */}
        <div className="flex items-center gap-2">
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

      {/* Chat Messages Scrollable Area */}
      <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto flex flex-col gap-3.5 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
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

              {/* Bubble Content */}
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

                {/* Service List Cards */}
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

      {/* Input Bar */}
      <div className="p-3 bg-white/50 dark:bg-stone-950/50 backdrop-blur-md border-t border-orange-100/60 dark:border-stone-800 shrink-0 z-10">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="e.g. haircut tomorrow afternoon, or tap mic..."
            disabled={isTyping}
            className="w-full bg-white/90 dark:bg-stone-900/90 border border-orange-200/60 dark:border-stone-700 rounded-full py-2.5 pl-5 pr-20 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#b02f00] focus:ring-2 focus:ring-orange-500/20 transition-all shadow-inner placeholder:text-stone-400"
          />

          {/* Inline Mic Trigger */}
          <button
            type="button"
            onClick={triggerLiveVoice}
            title="Start Live Voice Call"
            className="absolute right-9 w-7 h-7 rounded-full bg-orange-100/70 dark:bg-stone-800 text-[#b02f00] dark:text-orange-400 hover:bg-orange-200/80 dark:hover:bg-stone-700 flex items-center justify-center transition-all cursor-pointer"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>

          {/* Send Button */}
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
