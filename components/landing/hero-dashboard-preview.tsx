"use client"

import { motion } from "framer-motion"
import { Mic, CheckCircle, MessageSquare, Calendar, Sparkles, Clock, Zap, ShieldCheck } from "lucide-react"

export function HeroDashboardPreview() {
  return (
    <div className="relative w-full max-w-xl mx-auto h-[520px] lg:h-[580px] flex items-center justify-center">
      {/* Background ambient glow */}
      <div className="absolute inset-4 bg-gradient-to-tr from-orange-400/20 via-orange-300/10 to-amber-200/20 rounded-[2.5rem] blur-3xl -z-10" />

      {/* Main Glass Dashboard Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full h-full glass-panel rounded-[2.5rem] p-6 shadow-2xl border border-white/60 dark:border-stone-700/60 overflow-hidden flex flex-col justify-between relative bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl"
      >
        {/* Mock App Header */}
        <div className="flex items-center justify-between border-b border-orange-100 dark:border-stone-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-[#b02f00] to-[#ff5722] flex items-center justify-center text-white text-xs font-bold">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-xs text-stone-800 dark:text-stone-100">ScheduleAI Studio</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Live Agent Ready</span>
          </div>
        </div>

        {/* Mock Body: Featured Services Grid Preview */}
        <div className="space-y-3 flex-1 flex flex-col justify-center">
          <div className="text-center space-y-1 mb-2">
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Why Choose ScheduleAI?
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Experience conversational bookings with verified real-time slots.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Item 1 */}
            <div className="p-2.5 rounded-xl bg-orange-50/60 dark:bg-stone-800/60 border border-orange-200/40 dark:border-stone-700/40 flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-[#b02f00] dark:bg-orange-950 dark:text-orange-400">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">AI Chat Assistant</p>
                <p className="text-[9px] text-stone-500 leading-tight">Multi-turn intent understanding</p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="p-2.5 rounded-xl bg-orange-50/60 dark:bg-stone-800/60 border border-orange-200/40 dark:border-stone-700/40 flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-[#b02f00] dark:bg-orange-950 dark:text-orange-400">
                <Mic className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">Voice Input</p>
                <p className="text-[9px] text-stone-500 leading-tight">Native Web Speech recognition</p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="p-2.5 rounded-xl bg-orange-50/60 dark:bg-stone-800/60 border border-orange-200/40 dark:border-stone-700/40 flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-[#b02f00] dark:bg-orange-950 dark:text-orange-400">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">ScheduleAI Calendar</p>
                <p className="text-[9px] text-stone-500 leading-tight">Native conflict-safe schedule</p>
              </div>
            </div>

            {/* Item 4 */}
            <div className="p-2.5 rounded-xl bg-orange-50/60 dark:bg-stone-800/60 border border-orange-200/40 dark:border-stone-700/40 flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-[#b02f00] dark:bg-orange-950 dark:text-orange-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">Live Availability</p>
                <p className="text-[9px] text-stone-500 leading-tight">Instant slot consumption</p>
              </div>
            </div>

            {/* Item 5 */}
            <div className="p-2.5 rounded-xl bg-orange-50/60 dark:bg-stone-800/60 border border-orange-200/40 dark:border-stone-700/40 flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-[#b02f00] dark:bg-orange-950 dark:text-orange-400">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">Dual Dashboard</p>
                <p className="text-[9px] text-stone-500 leading-tight">Customer & Business portals</p>
              </div>
            </div>

            {/* Item 6 */}
            <div className="p-2.5 rounded-xl bg-orange-50/60 dark:bg-stone-800/60 border border-orange-200/40 dark:border-stone-700/40 flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-[#b02f00] dark:bg-orange-950 dark:text-orange-400">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">Instant Confirmations</p>
                <p className="text-[9px] text-stone-500 leading-tight">No double-booking conflicts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mock Footer Status */}
        <div className="mt-3 pt-2.5 border-t border-orange-100 dark:border-stone-800 flex items-center justify-between text-[10px] text-stone-500">
          <span>LangGraph + MongoDB Indexing</span>
          <span className="font-semibold text-[#b02f00]">Deterministic Slots</span>
        </div>
      </motion.div>

      {/* Floating Pill 1 (Top-Left): Voice Input Active */}
      <motion.div
        initial={{ opacity: 0, x: -30, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute -left-6 top-16 glass-panel px-4 py-2.5 rounded-2xl shadow-xl ai-glow flex items-center gap-2.5 border border-white/80 dark:border-stone-700 bg-white/90 dark:bg-stone-900/90 z-20"
      >
        <div className="h-8 w-8 rounded-full bg-orange-500/15 text-[#b02f00] dark:text-orange-400 flex items-center justify-center animate-pulse">
          <Mic className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-stone-800 dark:text-stone-100 leading-none">Voice Input Active</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Listening to request...</p>
        </div>
      </motion.div>

      {/* Floating Pill 2 (Bottom-Right): Synced Instantly */}
      <motion.div
        initial={{ opacity: 0, x: 30, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="absolute -right-6 bottom-20 glass-panel px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 border border-white/80 dark:border-stone-700 bg-white/90 dark:bg-stone-900/90 z-20"
      >
        <div className="h-8 w-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <CheckCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-stone-800 dark:text-stone-100 leading-none">Synced instantly</p>
          <p className="text-[10px] text-emerald-600 font-medium mt-0.5">0 conflict guarantee</p>
        </div>
      </motion.div>
    </div>
  )
}
