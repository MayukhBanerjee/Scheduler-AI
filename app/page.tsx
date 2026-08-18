"use client"

import { useState } from "react"
import { TopNavBar } from "@/components/landing/navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { PreviewSection } from "@/components/landing/preview-section"
import { Footer } from "@/components/landing/footer"
import { AuthModal } from "@/components/auth-modal"

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [authAction, setAuthAction] = useState<"login" | "register" | null>(null)

  const openAuthModal = (action: "login" | "register") => {
    setAuthAction(action)
    setIsModalOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fff8f4] dark:bg-stone-950 text-stone-900 dark:text-stone-100 selection:bg-orange-500/20 selection:text-[#b02f00] font-sans antialiased overflow-x-hidden">
      {/* 1. Top Navigation Bar */}
      <TopNavBar onOpenAuth={openAuthModal} />

      {/* 2. Main Landing Page Experience */}
      <main className="flex-grow">
        {/* Hero Section with Wavy Background & 3D Dashboard Mockup */}
        <HeroSection onOpenAuth={openAuthModal} />

        {/* Why Choose ScheduleAI Feature Grid */}
        <FeaturesSection />

        {/* Interactive Chat Assistant Preview & Context Engine */}
        <PreviewSection />
      </main>

      {/* 3. Global Footer */}
      <Footer />

      {/* 4. Dual-Role Authentication Modal (Customer vs Business) */}
      <AuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        action={authAction}
      />
    </div>
  )
}