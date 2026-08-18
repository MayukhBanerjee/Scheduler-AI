import type { LucideIcon } from "lucide-react"

export type NavTab = "ai-schedule" | "discover" | "bookings" | "calendar" | "analytics"

export interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  type?: "booking" | "confirmation" | "general" | "results" | "clarification"
  services?: ServiceResult[]
}

export interface ServiceResult {
  service_id: string
  service_name: string
  category: string
  provider_id: string
  provider_name: string
  provider_email: string
  location: string
  price: number
  duration_minutes: number
  available_slots: string[]
  rating: number
  description: string
  tags: string[]
  date?: string
}

export interface UserProfile {
  name: string
  email: string
  role: string
}

export interface BookingRow {
  _id: string
  service_name: string
  provider_name?: string
  date: string
  time: string
  status: string
  location?: string
}

export interface NavItem {
  id: NavTab
  href: string
  label: string
  icon: LucideIcon
  badge?: string
  count?: number
}

export const CHAT_STORAGE_KEY = "scheduleai_user_chat_v3"

export const DISCOVERY_CATEGORIES = [
  "All",
  "Beauty & Hair",
  "Dental",
  "Wellness & Spa",
  "Fitness",
  "Healthcare",
]

export const FEATURED_PROVIDERS = [
  {
    id: "p1",
    name: "The Style Studio",
    category: "Beauty & Hair",
    rating: 4.9,
    location: "Koramangala, Bangalore",
    services: [
      { name: "Signature Haircut & Style", price: 800, duration: 45 },
      { name: "Hydra Facial Treatment", price: 2200, duration: 60 },
      { name: "Hair Spa & Conditioning", price: 1500, duration: 60 },
    ],
  },
  {
    id: "p2",
    name: "City Dental Clinic",
    category: "Dental",
    rating: 4.8,
    location: "Indiranagar, Bangalore",
    services: [
      { name: "Comprehensive Dental Checkup", price: 500, duration: 30 },
      { name: "Teeth Deep Cleaning & Polishing", price: 1500, duration: 45 },
      { name: "Laser Teeth Whitening", price: 4500, duration: 60 },
    ],
  },
  {
    id: "p3",
    name: "Serenity Spa & Wellness",
    category: "Wellness & Spa",
    rating: 4.9,
    location: "HSR Layout, Bangalore",
    services: [
      { name: "Swedish Deep Tissue Massage", price: 2500, duration: 60 },
      { name: "Aromatherapy Full Body", price: 3000, duration: 90 },
      { name: "Hot Stone Therapy", price: 3500, duration: 75 },
    ],
  },
  {
    id: "p4",
    name: "FitZone Training Club",
    category: "Fitness",
    rating: 4.7,
    location: "Whitefield, Bangalore",
    services: [
      { name: "1-on-1 Personal Training Session", price: 1200, duration: 60 },
      { name: "HIIT & Functional Conditioning", price: 800, duration: 45 },
      { name: "Yoga & Flexibility Coaching", price: 900, duration: 60 },
    ],
  },
]
