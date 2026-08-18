export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          password?: string;
          role: "customer" | "provider";
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          password?: string;
          role?: "customer" | "provider";
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          password?: string;
          role?: "customer" | "provider";
          phone?: string | null;
          created_at?: string;
        };
      };
      service_providers: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          email: string;
          category: string;
          location: string;
          location_lower: string;
          rating: number;
          review_count: number;
          search_tags: string[];
          services: Json;
          availability_hours: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          email: string;
          category: string;
          location: string;
          location_lower: string;
          rating?: number;
          review_count?: number;
          search_tags?: string[];
          services?: Json;
          availability_hours?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          email?: string;
          category?: string;
          location?: string;
          location_lower?: string;
          rating?: number;
          review_count?: number;
          search_tags?: string[];
          services?: Json;
          availability_hours?: Json;
          created_at?: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          provider_id: string;
          service_id: string;
          service_name: string;
          booking_date: string;
          slot_time: string;
          status: "confirmed" | "cancelled" | "completed";
          total_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider_id: string;
          service_id: string;
          service_name: string;
          booking_date: string;
          slot_time: string;
          status?: "confirmed" | "cancelled" | "completed";
          total_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider_id?: string;
          service_id?: string;
          service_name?: string;
          booking_date?: string;
          slot_time?: string;
          status?: "confirmed" | "cancelled" | "completed";
          total_price?: number;
          created_at?: string;
        };
      };
    };
  };
}
