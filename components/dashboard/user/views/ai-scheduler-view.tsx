"use client"

import type React from "react"
import { Message, ServiceResult, BookingRow } from "../types"
import { ChatInterface } from "../chat-interface"
import { MyBookingsWidget } from "../my-bookings-widget"
import { BookingCalendar } from "@/components/booking-calendar"

interface AISchedulerViewProps {
  messages: Message[]
  inputMessage: string
  setInputMessage: (val: string) => void
  isTyping: boolean
  isListening: boolean
  speechSupported: boolean
  toggleVoice: () => void
  handleSendMessage: (customText?: string) => void
  handleKeyPress: (e: React.KeyboardEvent) => void
  bookingInProgress: string | null
  handleBookService: (service: ServiceResult, slot: string) => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  renderRichText: (content: string) => React.ReactNode
  bookings: BookingRow[]
  onViewAllBookings: () => void
  onCancelBooking: (id: string) => void
  cancellingId: string | null
  calendarKey: number
}

export function AISchedulerView({
  messages,
  inputMessage,
  setInputMessage,
  isTyping,
  isListening,
  speechSupported,
  toggleVoice,
  handleSendMessage,
  handleKeyPress,
  bookingInProgress,
  handleBookService,
  messagesEndRef,
  inputRef,
  renderRichText,
  bookings,
  onViewAllBookings,
  onCancelBooking,
  cancellingId,
  calendarKey,
}: AISchedulerViewProps) {
  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
      {/* Left Column: AI Chat Interface */}
      <section className="flex-1 h-full min-h-0 min-w-0 flex flex-col overflow-hidden">
        <ChatInterface
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
        />
      </section>

      {/* Right Column: Sidebar Widgets */}
      <aside className="w-full lg:w-[350px] xl:w-[370px] h-full flex flex-col gap-3.5 shrink-0 min-h-0 overflow-hidden">
        <MyBookingsWidget
          bookings={bookings}
          onViewAll={onViewAllBookings}
          onCancelBooking={onCancelBooking}
          cancellingId={cancellingId}
        />

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <BookingCalendar key={calendarKey} userType="user" />
        </div>
      </aside>
    </div>
  )
}
