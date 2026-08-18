"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Star, MapPin, Clock, DollarSign, CheckCircle, Loader2 } from "lucide-react"
import { ServiceResult } from "./types"

interface ServiceCardProps {
  service: ServiceResult
  onBook: (service: ServiceResult, slot: string) => void
  isBooking: boolean
}

export function ServiceCard({ service, onBook, isBooking }: ServiceCardProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const hasSlots = service.available_slots && service.available_slots.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-orange-200/60 dark:border-stone-700/60 rounded-2xl p-4 bg-white/90 dark:bg-stone-900/90 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">{service.service_name}</h4>
          <p className="text-xs text-stone-500 dark:text-stone-400">{service.provider_name}</p>
        </div>
        <div className="flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 text-amber-700 dark:text-amber-300 font-bold">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span>{service.rating.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-stone-600 dark:text-stone-300 mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-[#ff5722]" />
          {service.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-stone-400" />
          {service.duration_minutes} min
        </span>
        <span className="flex items-center gap-0.5 text-[#b02f00] dark:text-orange-400 font-bold">
          <DollarSign className="h-3.5 w-3.5" />
          ₹{service.price}
        </span>
      </div>

      {hasSlots && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5">Available slots:</p>
          <div className="flex flex-wrap gap-1.5">
            {service.available_slots.slice(0, 5).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot === selectedSlot ? null : slot)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                  selectedSlot === slot
                    ? "bg-[#b02f00] text-white border-[#b02f00] shadow-xs scale-105"
                    : "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-[#b02f00] text-stone-700 dark:text-stone-300 cursor-pointer"
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
        className="w-full bg-gradient-to-r from-[#b02f00] to-[#ff5722] hover:from-[#902700] hover:to-[#e64a19] text-white rounded-xl font-semibold shadow-sm transition-all cursor-pointer"
        disabled={!hasSlots || !selectedSlot || isBooking}
        onClick={() => selectedSlot && onBook(service, selectedSlot)}
      >
        {isBooking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
        )}
        {isBooking ? "Booking Slot..." : selectedSlot ? `Confirm Booking at ${selectedSlot}` : "Select a Time Slot"}
      </Button>
    </motion.div>
  )
}
