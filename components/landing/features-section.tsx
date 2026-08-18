"use client"

import { motion } from "framer-motion"
import { MessageSquare, AudioLines, RefreshCw } from "lucide-react"

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-28 px-4 sm:px-8 md:px-12 bg-[#fff8f4] dark:bg-stone-950 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-stone-900 dark:text-stone-50 tracking-tight"
          >
            Why Choose ScheduleAI?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed"
          >
            Experience a new paradigm of scheduling where intelligent automation meets human-centric design, providing effortless calendar management.
          </motion.p>
        </div>

        {/* 3 Feature Cards Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1: AI Chat Booking */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="glass-panel bg-white/80 dark:bg-stone-900/80 p-8 rounded-[2rem] border border-orange-100 dark:border-stone-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_35px_rgba(255,87,34,0.12)] transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-orange-100/70 dark:bg-orange-950/70 flex items-center justify-center mb-6 text-[#b02f00] dark:text-orange-400 group-hover:scale-110 group-hover:bg-gradient-to-tr group-hover:from-[#b02f00] group-hover:to-[#ff5722] group-hover:text-white transition-all duration-300 shadow-sm">
                <MessageSquare className="h-7 w-7" />
              </div>

              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-3 tracking-tight">
                AI Chat Booking
              </h3>

              <p className="text-stone-600 dark:text-stone-300 text-sm sm:text-base leading-relaxed">
                Engage clients with a natural, conversational AI that guides them through the booking process 24/7 without friction.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Voice Input */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="glass-panel bg-white/80 dark:bg-stone-900/80 p-8 rounded-[2rem] border border-orange-100 dark:border-stone-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_35px_rgba(255,87,34,0.12)] transition-all duration-300 group relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-orange-100/70 dark:bg-orange-950/70 flex items-center justify-center mb-6 text-[#b02f00] dark:text-orange-400 group-hover:scale-110 group-hover:bg-gradient-to-tr group-hover:from-[#b02f00] group-hover:to-[#ff5722] group-hover:text-white transition-all duration-300 shadow-sm">
                <AudioLines className="h-7 w-7" />
              </div>

              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-3 tracking-tight">
                Voice Input
              </h3>

              <p className="text-stone-600 dark:text-stone-300 text-sm sm:text-base leading-relaxed">
                Allow users to simply state their preferred time. Our advanced NLP instantly parses voice commands into confirmed slots.
              </p>
            </div>
          </motion.div>

          {/* Card 3: Real-Time Sync */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="glass-panel bg-white/80 dark:bg-stone-900/80 p-8 rounded-[2rem] border border-orange-100 dark:border-stone-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_15px_35px_rgba(255,87,34,0.12)] transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-orange-100/70 dark:bg-orange-950/70 flex items-center justify-center mb-6 text-[#b02f00] dark:text-orange-400 group-hover:scale-110 group-hover:bg-gradient-to-tr group-hover:from-[#b02f00] group-hover:to-[#ff5722] group-hover:text-white transition-all duration-300 shadow-sm">
                <RefreshCw className="h-7 w-7" />
              </div>

              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-3 tracking-tight">
                Real-Time Sync
              </h3>

              <p className="text-stone-600 dark:text-stone-300 text-sm sm:text-base leading-relaxed">
                Bidirectional syncing across all major calendars ensures double-bookings are completely eliminated instantly.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
