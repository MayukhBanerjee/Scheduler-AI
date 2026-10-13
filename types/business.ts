/**
 * types/business.ts
 * ScheduleAI - Provider & Business Domain Source of Truth
 * 
 * Author: Mayukh Banerjee
 * Defines all strictly-typed interfaces, domain models, state schemas,
 * and operational contracts for the ScheduleAI Business Portal & Dashboards.
 */

// ─── 1. Core Enumerations & Literals ──────────────────────────────────────────

export type BusinessCategory =
  | "Beauty & Hair"
  | "Fitness"
  | "Healthcare"
  | "Wellness & Spa"
  | "Dental"
  | "Legal"
  | "Consulting"
  | "Education"
  | "Home Services"
  | "General";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "partially_paid"
  | "refunded"
  | "waived";

export type CalendarViewMode = "day" | "week" | "month";

export type DashboardTab =
  | "schedule"       // Booking Calendar & Live Agenda
  | "availability"   // Working hours, slot intervals & custom date overrides
  | "services"       // Service catalog, durations, AI tags & pricing
  | "crm"            // Client pipeline, history, lifetime spend & tags
  | "analytics"      // Financial metrics, occupancy, retention & trends
  | "reviews"        // Reputation, feedback & rating management
  | "profile";       // Business identity, contact, branding & address

// ─── 2. Service Catalog & Offerings ───────────────────────────────────────────

export interface ServiceItem {
  id: string;
  providerId: string;
  name: string;
  category: BusinessCategory | string;
  description: string;
  price: number;
  currency?: "INR" | "USD" | string;
  durationMinutes: number;
  bufferMinutesBefore?: number;
  bufferMinutesAfter?: number;
  isActive: boolean;
  sortOrder: number;
  /** Semantic tags utilized by the AWS Bedrock / Gemini AI agent to match user intents */
  tags: string[];
  maxSimultaneousCapacity?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ServiceFormData = Omit<ServiceItem, "id" | "providerId" | "createdAt" | "updatedAt">;

// ─── 3. Availability, Shifts & Overrides ──────────────────────────────────────

export interface TimeBlock {
  start: string; // HH:mm format e.g. "09:00"
  end: string;   // HH:mm format e.g. "17:00"
}

export interface DaySchedule {
  isOpen: boolean;
  shifts: TimeBlock[];
  /** Discrete slot strings generated for the AI & booking picker (e.g. ["09:00", "09:30"]) */
  slots: string[];
}

/** Weekly recurring schedule mapping each day of the week to its schedule */
export type WeeklySchedule = Record<DayOfWeek, DaySchedule>;

/** Custom date override (holiday, custom split shifts, temporary blackout) */
export interface SpecificDateOverride {
  date: string; // "YYYY-MM-DD"
  isBlackout: boolean; // Entire day closed
  note?: string;
  slots: string[];     // Specific slot times available on this date
  shifts?: TimeBlock[];
}

/** Complete availability configuration payload synchronized with Supabase */
export interface AvailabilityConfig {
  weeklySlots: Record<string, string[]>; // e.g. { monday: ["09:00", "10:00", ...] }
  dateOverrides: Record<string, string[]>; // e.g. { "2026-10-14": ["11:00", "14:00"] }
  slotIntervalMinutes: number; // default: 30 or 60
  bufferBetweenBookingsMinutes: number; // default: 10
  advanceBookingDays: number; // default: 30
  minimumNoticeHours: number; // default: 2
}

// ─── 4. Business Profile & Identity ───────────────────────────────────────────

export interface BusinessCoordinates {
  latitude: number;
  longitude: number;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  businessName: string;
  ownerName: string | null;
  email: string;
  phone: string | null;
  category: BusinessCategory;
  description: string;
  location: string;
  locationLower: string;
  coordinates?: BusinessCoordinates;
  rating: number;
  totalReviews: number;
  isVerified: boolean;
  searchTags: string[];
  services: ServiceItem[];
  availability: AvailabilityConfig;
  avatarUrl?: string;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 5. Bookings & Appointments ───────────────────────────────────────────────

export interface BookingCustomerInfo {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}

export interface BusinessBooking {
  id: string;
  userId: string;
  providerId: string;
  serviceId: string | null;
  serviceName: string;
  customer: BookingCustomerInfo;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  durationMinutes: number;
  price: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  notes?: string;
  cancellationReason?: string;
  googleEventId?: string;
  isGoogleSynced?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarDayViewModel {
  date: Date;
  dateString: string; // "YYYY-MM-DD"
  bookings: BusinessBooking[];
  isToday: boolean;
  isCurrentMonth: boolean;
  availableSlots: string[];
  isOverrideActive: boolean;
  totalRevenue: number;
}

// ─── 6. Client CRM & Relationship Data ─────────────────────────────────────────

export type ClientTag = "VIP" | "New" | "Regular" | "High-Value" | "Need Attention";

export interface ClientCRMRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  lifetimeSpend: number;
  firstBookingDate: string;
  lastBookingDate: string;
  preferredServices: string[];
  tags: ClientTag[];
  notes?: string;
}

// ─── 7. Operations & KPI Metrics ──────────────────────────────────────────────

export interface BusinessMetrics {
  totalBookingsCount: number;
  todayBookingsCount: number;
  pendingBookingsCount: number;
  completedBookingsCount: number;
  cancelledBookingsCount: number;
  grossRevenue: number;
  todayRevenue: number;
  averageBookingValue: number;
  occupancyRatePercentage: number;
  repeatClientPercentage: number;
  averageRating: number;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    bookingsCount: number;
  }>;
  popularServices: Array<{
    serviceName: string;
    bookingsCount: number;
    revenue: number;
  }>;
}

// ─── 8. Reputation & Reviews ──────────────────────────────────────────────────

export interface BusinessReview {
  id: string;
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerAvatar?: string;
  serviceName: string;
  rating: number; // 1 to 5
  comment: string;
  reply?: string;
  repliedAt?: string;
  isPublic: boolean;
  createdAt: string;
}

// ─── 9. Filter & Query State Contracts ────────────────────────────────────────

export interface BookingFilters {
  status?: BookingStatus | "all";
  serviceId?: string | "all";
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

export interface CRMFilters {
  tag?: ClientTag | "all";
  searchQuery?: string;
  sortBy?: "spend" | "bookings" | "recent" | "name";
  sortDirection?: "asc" | "desc";
}
