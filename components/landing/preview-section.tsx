"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Mic, Send, Bot, Sparkles } from "lucide-react"

export function PreviewSection() {
  const [inputValue, setInputValue] = useState("")
  const [isListening, setIsListening] = useState(false)

  const handleQuickPrompt = () => {
    setInputValue("Book a 3:00 PM slot for next Tuesday")
  }

  const toggleMic = () => {
    setIsListening(!isListening)
    if (!isListening) {
      setInputValue("I need a haircut tomorrow afternoon")
    }
  }

  return (
    <section className="py-20 md:py-32 px-4 sm:px-8 md:px-12 bg-gradient-to-b from-[#fff8f4] via-[#fff1e7]/40 to-[#fff8f4] dark:from-stone-950 dark:via-stone-900/50 dark:to-stone-950 relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left Column: Interactive Chat Preview Card */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="order-2 lg:order-1 glass-panel rounded-[2.5rem] p-5 sm:p-7 shadow-2xl border border-white/70 dark:border-stone-800 relative bg-white/85 dark:bg-stone-900/85 backdrop-blur-2xl"
        >
          {/* Subtle Accent Glow */}
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-orange-400/20 rounded-full blur-3xl pointer-events-none" />

          <div className="bg-white/90 dark:bg-stone-950/90 rounded-3xl p-5 sm:p-6 border border-orange-100 dark:border-stone-800 h-[430px] flex flex-col justify-between shadow-inner">
            {/* Chat Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-orange-100 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white font-bold shadow-md shadow-orange-500/20">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    Schedule Assistant
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Online & Ready</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleQuickPrompt}
                className="text-[11px] font-semibold text-[#b02f00] dark:text-orange-400 hover:underline bg-orange-50 dark:bg-stone-800 px-2.5 py-1 rounded-full border border-orange-200/50"
              >
                Sample Prompt
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto py-3.5 pr-1 text-sm">
              {/* Assistant Message 1 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-orange-50/80 dark:bg-stone-800/80 p-3.5 rounded-2xl rounded-tl-sm self-start max-w-[85%] text-stone-800 dark:text-stone-200 border border-orange-100/60 dark:border-stone-700"
              >
                Hello! How can I help you schedule your appointment today?
              </motion.div>

              {/* User Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-[#b02f00] to-[#ff5722] text-white p-3.5 rounded-2xl rounded-tr-sm self-end max-w-[85%] shadow-md shadow-orange-500/15"
              >
                I need a 30 min meeting with Sarah next Tuesday afternoon.
              </motion.div>

              {/* Assistant Message 2 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-orange-50/80 dark:bg-stone-800/80 p-3.5 rounded-2xl rounded-tl-sm self-start max-w-[85%] text-stone-800 dark:text-stone-200 border border-orange-100/60 dark:border-stone-700 space-y-1.5"
              >
                <p>I found a few verified slots for next Tuesday with Sarah:</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-900 text-xs font-bold text-[#b02f00] border border-orange-200 shadow-2xs">
                    1:30 PM
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-900 text-xs font-bold text-[#b02f00] border border-orange-200 shadow-2xs">
                    3:00 PM
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-900 text-xs font-bold text-[#b02f00] border border-orange-200 shadow-2xs">
                    4:30 PM
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Chat Input Bar */}
            <div className="pt-3 border-t border-orange-100 dark:border-stone-800 flex items-center gap-2">
              <div className="flex-1 bg-orange-50/60 dark:bg-stone-800/60 rounded-full px-4 py-2 flex items-center justify-between border border-orange-200/50 dark:border-stone-700 focus-within:border-[#b02f00] transition-colors">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your reply or question..."
                  className="w-full bg-transparent text-sm text-stone-800 dark:text-stone-100 outline-none placeholder:text-stone-400"
                />
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-1.5 rounded-full transition-all ${
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "text-[#b02f00] hover:bg-orange-200/50"
                  }`}
                  title="Toggle voice mic simulation"
                >
                  <Mic className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInputValue("")}
                className="bg-gradient-to-tr from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Narrative & Checkmarks */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="order-1 lg:order-2 space-y-6 text-left"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-stone-900 dark:text-stone-50 leading-tight tracking-tight">
            Effortless coordination, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b02f00] to-[#ff5722]">
              powered by context.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
            Our AI doesn&apos;t just match time slots; it understands context, preferences, and timezone nuances. It negotiates times on your behalf, handling the back-and-forth so you can focus on the meeting itself.
          </p>

          <ul className="space-y-4 pt-2">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#b02f00] dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <span className="text-stone-700 dark:text-stone-200 font-medium text-sm sm:text-base">
                Understands natural language and multi-turn conversations
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#b02f00] dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <span className="text-stone-700 dark:text-stone-200 font-medium text-sm sm:text-base">
                Automatically detects conflicts and consumes slots atomically
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#b02f00] dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <span className="text-stone-700 dark:text-stone-200 font-medium text-sm sm:text-base">
                Learns your scheduling preferences and provider rules over time
              </span>
            </li>
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
