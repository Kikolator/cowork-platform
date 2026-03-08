export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      booking_credit_deductions: {
        Row: {
          booking_id: string
          created_at: string
          grant_id: string
          id: string
          minutes: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          grant_id: string
          id?: string
          minutes: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          grant_id?: string
          id?: string
          minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_credit_deductions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_credit_deductions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "credit_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_cents: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string | null
          credit_type_id: string | null
          credits_deducted: number | null
          duration_minutes: number | null
          end_time: string
          id: string
          recurring_rule_id: string | null
          reminded_at: string | null
          resource_id: string
          space_id: string
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_session_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string | null
          credit_type_id?: string | null
          credits_deducted?: number | null
          duration_minutes?: number | null
          end_time: string
          id?: string
          recurring_rule_id?: string | null
          reminded_at?: string | null
          resource_id: string
          space_id: string
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_session_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string | null
          credit_type_id?: string | null
          credits_deducted?: number | null
          duration_minutes?: number | null
          end_time?: string
          id?: string
          recurring_rule_id?: string | null
          reminded_at?: string | null
          resource_id?: string
          space_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_session_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_credit_type_id_fkey"
            columns: ["credit_type_id"]
            isOneToOne: false
            referencedRelation: "resource_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_grants: {
        Row: {
          amount_minutes: number
          created_at: string
          id: string
          metadata: Json | null
          resource_type_id: string
          source: Database["public"]["Enums"]["credit_grant_source"]
          space_id: string
          stripe_invoice_id: string | null
          stripe_line_item_id: string | null
          updated_at: string
          used_minutes: number
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          amount_minutes: number
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_type_id: string
          source: Database["public"]["Enums"]["credit_grant_source"]
          space_id: string
          stripe_invoice_id?: string | null
          stripe_line_item_id?: string | null
          updated_at?: string
          used_minutes?: number
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          amount_minutes?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_type_id?: string
          source?: Database["public"]["Enums"]["credit_grant_source"]
          space_id?: string
          stripe_invoice_id?: string | null
          stripe_line_item_id?: string | null
          updated_at?: string
          used_minutes?: number
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_grants_resource_type_id_fkey"
            columns: ["resource_type_id"]
            isOneToOne: false
            referencedRelation: "resource_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_grants_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          active_passes: number | null
          check_ins: number | null
          check_outs: number | null
          date: string
          desk_occupancy: number | null
          generated_at: string | null
          id: string
          room_bookings: number | null
          space_id: string
        }
        Insert: {
          active_passes?: number | null
          check_ins?: number | null
          check_outs?: number | null
          date: string
          desk_occupancy?: number | null
          generated_at?: string | null
          id?: string
          room_bookings?: number | null
          space_id: string
        }
        Update: {
          active_passes?: number | null
          check_ins?: number | null
          check_outs?: number | null
          date?: string
          desk_occupancy?: number | null
          generated_at?: string | null
          id?: string
          room_bookings?: number | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          admin_notes: string | null
          archived_at: string | null
          company: string | null
          converted_user_id: string | null
          created_at: string | null
          email: string
          follow_up_count: number | null
          full_name: string | null
          id: string
          last_contacted_at: string | null
          phone: string | null
          source: string | null
          space_id: string
          status: Database["public"]["Enums"]["lead_status"]
          trial_confirmed: boolean | null
          trial_date: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          archived_at?: string | null
          company?: string | null
          converted_user_id?: string | null
          created_at?: string | null
          email: string
          follow_up_count?: number | null
          full_name?: string | null
          id?: string
          last_contacted_at?: string | null
          phone?: string | null
          source?: string | null
          space_id: string
          status?: Database["public"]["Enums"]["lead_status"]
          trial_confirmed?: boolean | null
          trial_date?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          archived_at?: string | null
          company?: string | null
          converted_user_id?: string | null
          created_at?: string | null
          email?: string
          follow_up_count?: number | null
          full_name?: string | null
          id?: string
          last_contacted_at?: string | null
          phone?: string | null
          source?: string | null
          space_id?: string
          status?: Database["public"]["Enums"]["lead_status"]
          trial_confirmed?: boolean | null
          trial_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      member_notes: {
        Row: {
          author_id: string
          category: string | null
          content: string
          created_at: string | null
          id: string
          member_id: string
          space_id: string
        }
        Insert: {
          author_id: string
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          member_id: string
          space_id: string
        }
        Update: {
          author_id?: string
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          member_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          access_code: string | null
          alarm_approved: boolean | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_company_name: string | null
          billing_company_tax_id: string | null
          billing_company_tax_id_type:
            | Database["public"]["Enums"]["fiscal_id_type"]
            | null
          billing_country: string | null
          billing_entity_type: string | null
          billing_postal_code: string | null
          billing_state_province: string | null
          cancel_requested_at: string | null
          cancelled_at: string | null
          company: string | null
          created_at: string | null
          fiscal_id: string | null
          fiscal_id_type: Database["public"]["Enums"]["fiscal_id_type"] | null
          fixed_desk_id: string | null
          has_twenty_four_seven: boolean | null
          id: string
          joined_at: string | null
          paused_at: string | null
          plan_id: string
          role_title: string | null
          space_id: string
          status: Database["public"]["Enums"]["member_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_code?: string | null
          alarm_approved?: boolean | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_company_tax_id?: string | null
          billing_company_tax_id_type?:
            | Database["public"]["Enums"]["fiscal_id_type"]
            | null
          billing_country?: string | null
          billing_entity_type?: string | null
          billing_postal_code?: string | null
          billing_state_province?: string | null
          cancel_requested_at?: string | null
          cancelled_at?: string | null
          company?: string | null
          created_at?: string | null
          fiscal_id?: string | null
          fiscal_id_type?: Database["public"]["Enums"]["fiscal_id_type"] | null
          fixed_desk_id?: string | null
          has_twenty_four_seven?: boolean | null
          id?: string
          joined_at?: string | null
          paused_at?: string | null
          plan_id: string
          role_title?: string | null
          space_id: string
          status?: Database["public"]["Enums"]["member_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_code?: string | null
          alarm_approved?: boolean | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_company_tax_id?: string | null
          billing_company_tax_id_type?:
            | Database["public"]["Enums"]["fiscal_id_type"]
            | null
          billing_country?: string | null
          billing_entity_type?: string | null
          billing_postal_code?: string | null
          billing_state_province?: string | null
          cancel_requested_at?: string | null
          cancelled_at?: string | null
          company?: string | null
          created_at?: string | null
          fiscal_id?: string | null
          fiscal_id_type?: Database["public"]["Enums"]["fiscal_id_type"] | null
          fixed_desk_id?: string | null
          has_twenty_four_seven?: boolean | null
          id?: string
          joined_at?: string | null
          paused_at?: string | null
          plan_id?: string
          role_title?: string | null
          space_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_fixed_desk_id_fkey"
            columns: ["fixed_desk_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_stats: {
        Row: {
          avg_desk_occupancy: number | null
          avg_room_utilisation: number | null
          churned_members: number | null
          day_passes_sold: number | null
          generated_at: string | null
          id: string
          leads_converted: number | null
          leads_created: number | null
          members_by_plan: Json | null
          month: string
          mrr_cents: number | null
          new_members: number | null
          peak_hour: number | null
          space_id: string
          total_members: number | null
          total_revenue_cents: number | null
          variable_revenue_cents: number | null
          week_passes_sold: number | null
        }
        Insert: {
          avg_desk_occupancy?: number | null
          avg_room_utilisation?: number | null
          churned_members?: number | null
          day_passes_sold?: number | null
          generated_at?: string | null
          id?: string
          leads_converted?: number | null
          leads_created?: number | null
          members_by_plan?: Json | null
          month: string
          mrr_cents?: number | null
          new_members?: number | null
          peak_hour?: number | null
          space_id: string
          total_members?: number | null
          total_revenue_cents?: number | null
          variable_revenue_cents?: number | null
          week_passes_sold?: number | null
        }
        Update: {
          avg_desk_occupancy?: number | null
          avg_room_utilisation?: number | null
          churned_members?: number | null
          day_passes_sold?: number | null
          generated_at?: string | null
          id?: string
          leads_converted?: number | null
          leads_created?: number | null
          members_by_plan?: Json | null
          month?: string
          mrr_cents?: number | null
          new_members?: number | null
          peak_hour?: number | null
          space_id?: string
          total_members?: number | null
          total_revenue_cents?: number | null
          variable_revenue_cents?: number | null
          week_passes_sold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_stats_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          booking_reminders: boolean | null
          created_at: string | null
          credit_warnings: boolean | null
          id: string
          marketing: boolean | null
          preferred_channel: string | null
          space_id: string
          updated_at: string | null
          user_id: string
          weekly_summary: boolean | null
        }
        Insert: {
          booking_reminders?: boolean | null
          created_at?: string | null
          credit_warnings?: boolean | null
          id?: string
          marketing?: boolean | null
          preferred_channel?: string | null
          space_id: string
          updated_at?: string | null
          user_id: string
          weekly_summary?: boolean | null
        }
        Update: {
          booking_reminders?: boolean | null
          created_at?: string | null
          credit_warnings?: boolean | null
          id?: string
          marketing?: boolean | null
          preferred_channel?: string | null
          space_id?: string
          updated_at?: string | null
          user_id?: string
          weekly_summary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          channel: string
          error: string | null
          id: string
          metadata: Json | null
          recipient: string
          sent_at: string | null
          space_id: string
          subject: string | null
          template: string
          user_id: string | null
        }
        Insert: {
          channel: string
          error?: string | null
          id?: string
          metadata?: Json | null
          recipient: string
          sent_at?: string | null
          space_id: string
          subject?: string | null
          template: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          recipient?: string
          sent_at?: string | null
          space_id?: string
          subject?: string | null
          template?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      passes: {
        Row: {
          amount_cents: number
          assigned_desk_id: string | null
          created_at: string | null
          end_date: string
          id: string
          is_guest: boolean
          pass_type: Database["public"]["Enums"]["pass_type"]
          purchased_by: string | null
          space_id: string
          start_date: string
          status: Database["public"]["Enums"]["pass_status"]
          stripe_session_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          assigned_desk_id?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          is_guest?: boolean
          pass_type: Database["public"]["Enums"]["pass_type"]
          purchased_by?: string | null
          space_id: string
          start_date: string
          status?: Database["public"]["Enums"]["pass_status"]
          stripe_session_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          assigned_desk_id?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          is_guest?: boolean
          pass_type?: Database["public"]["Enums"]["pass_type"]
          purchased_by?: string | null
          space_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["pass_status"]
          stripe_session_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passes_assigned_desk_id_fkey"
            columns: ["assigned_desk_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          space_id: string
          stripe_account_id: string | null
          stripe_customer_id: string | null
          stripe_event_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
          space_id: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_event_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          space_id?: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_event_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_credit_config: {
        Row: {
          created_at: string | null
          id: string
          is_unlimited: boolean
          monthly_minutes: number
          plan_id: string
          resource_type_id: string
          space_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_unlimited?: boolean
          monthly_minutes?: number
          plan_id: string
          resource_type_id: string
          space_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_unlimited?: boolean
          monthly_minutes?: number
          plan_id?: string
          resource_type_id?: string
          space_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_credit_config_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_credit_config_resource_type_id_fkey"
            columns: ["resource_type_id"]
            isOneToOne: false
            referencedRelation: "resource_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_credit_config_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          access_type: string
          active: boolean | null
          created_at: string | null
          currency: string
          description: string | null
          has_fixed_desk: boolean | null
          id: string
          iva_rate: number
          name: string
          price_cents: number
          slug: string
          sort_order: number | null
          space_id: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          access_type?: string
          active?: boolean | null
          created_at?: string | null
          currency?: string
          description?: string | null
          has_fixed_desk?: boolean | null
          id?: string
          iva_rate?: number
          name: string
          price_cents: number
          slug: string
          sort_order?: number | null
          space_id: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          access_type?: string
          active?: boolean | null
          created_at?: string | null
          currency?: string
          description?: string | null
          has_fixed_desk?: boolean | null
          id?: string
          iva_rate?: number
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number | null
          space_id?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          category: Database["public"]["Enums"]["product_category"]
          created_at: string | null
          credit_grant_config: Json | null
          currency: string
          description: string | null
          id: string
          iva_rate: number
          name: string
          plan_id: string | null
          price_cents: number
          purchase_flow: string
          slug: string
          sort_order: number | null
          space_id: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
          visibility_rules: Json
        }
        Insert: {
          active?: boolean | null
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string | null
          credit_grant_config?: Json | null
          currency?: string
          description?: string | null
          id?: string
          iva_rate?: number
          name: string
          plan_id?: string | null
          price_cents: number
          purchase_flow?: string
          slug: string
          sort_order?: number | null
          space_id: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          visibility_rules?: Json
        }
        Update: {
          active?: boolean | null
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string | null
          credit_grant_config?: Json | null
          currency?: string
          description?: string | null
          id?: string
          iva_rate?: number
          name?: string
          plan_id?: string | null
          price_cents?: number
          purchase_flow?: string
          slug?: string
          sort_order?: number | null
          space_id?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          visibility_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "products_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_config: {
        Row: {
          created_at: string | null
          currency: string
          id: string
          iva_rate: number
          rate_cents: number
          resource_type_id: string
          space_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          id?: string
          iva_rate?: number
          rate_cents: number
          resource_type_id: string
          space_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          id?: string
          iva_rate?: number
          rate_cents?: number
          resource_type_id?: string
          space_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_config_resource_type_id_fkey"
            columns: ["resource_type_id"]
            isOneToOne: false
            referencedRelation: "resource_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_config_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          active: boolean | null
          created_at: string | null
          day_of_week: number | null
          end_time: string
          id: string
          pattern: Database["public"]["Enums"]["recurrence_pattern"]
          resource_id: string
          space_id: string
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          pattern: Database["public"]["Enums"]["recurrence_pattern"]
          resource_id: string
          space_id: string
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          pattern?: Database["public"]["Enums"]["recurrence_pattern"]
          resource_id?: string
          space_id?: string
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_types: {
        Row: {
          billable: boolean | null
          bookable: boolean | null
          created_at: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
          space_id: string
          updated_at: string | null
        }
        Insert: {
          billable?: boolean | null
          bookable?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
          space_id: string
          updated_at?: string | null
        }
        Update: {
          billable?: boolean | null
          bookable?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          space_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_types_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          capacity: number | null
          created_at: string | null
          floor: number | null
          id: string
          metadata: Json | null
          name: string
          resource_type_id: string
          sort_order: number | null
          space_id: string
          status: Database["public"]["Enums"]["resource_status"]
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          floor?: number | null
          id?: string
          metadata?: Json | null
          name: string
          resource_type_id: string
          sort_order?: number | null
          space_id: string
          status?: Database["public"]["Enums"]["resource_status"]
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          floor?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          resource_type_id?: string
          sort_order?: number | null
          space_id?: string
          status?: Database["public"]["Enums"]["resource_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_resource_type_id_fkey"
            columns: ["resource_type_id"]
            isOneToOne: false
            referencedRelation: "resource_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_lang: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_lang?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_lang?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      space_closures: {
        Row: {
          all_day: boolean | null
          created_at: string | null
          date: string
          end_time: string | null
          id: string
          reason: string | null
          space_id: string
          start_time: string | null
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string | null
          date: string
          end_time?: string | null
          id?: string
          reason?: string | null
          space_id: string
          start_time?: string | null
        }
        Update: {
          all_day?: boolean | null
          created_at?: string | null
          date?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          space_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "space_closures_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_users: {
        Row: {
          created_at: string | null
          id: string
          role: string
          space_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          space_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          space_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_users_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          accent_color: string | null
          active: boolean | null
          address: string | null
          business_hours: Json
          city: string | null
          country_code: string
          created_at: string | null
          currency: string
          custom_domain: string | null
          default_locale: string
          favicon_url: string | null
          features: Json
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          require_fiscal_id: boolean | null
          slug: string
          supported_fiscal_id_types: Json | null
          tenant_id: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          active?: boolean | null
          address?: string | null
          business_hours?: Json
          city?: string | null
          country_code?: string
          created_at?: string | null
          currency?: string
          custom_domain?: string | null
          default_locale?: string
          favicon_url?: string | null
          features?: Json
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          require_fiscal_id?: boolean | null
          slug: string
          supported_fiscal_id_types?: Json | null
          tenant_id: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          active?: boolean | null
          address?: string | null
          business_hours?: Json
          city?: string | null
          country_code?: string
          created_at?: string | null
          currency?: string
          custom_domain?: string | null
          default_locale?: string
          favicon_url?: string | null
          features?: Json
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          require_fiscal_id?: boolean | null
          slug?: string
          supported_fiscal_id_types?: Json | null
          tenant_id?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          billing_email: string | null
          billing_name: string | null
          created_at: string | null
          id: string
          name: string
          platform_plan: string
          platform_subscription_id: string | null
          slug: string
          status: string
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          billing_email?: string | null
          billing_name?: string | null
          created_at?: string | null
          id?: string
          name: string
          platform_plan?: string
          platform_subscription_id?: string | null
          slug: string
          status?: string
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_email?: string | null
          billing_name?: string | null
          created_at?: string | null
          id?: string
          name?: string
          platform_plan?: string
          platform_subscription_id?: string | null
          slug?: string
          status?: string
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string | null
          desired_date: string
          desired_end: string | null
          desired_start: string | null
          expires_at: string | null
          id: string
          notified_at: string | null
          resource_id: string
          space_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          desired_date: string
          desired_end?: string | null
          desired_start?: string | null
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          resource_id: string
          space_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          desired_date?: string
          desired_end?: string | null
          desired_start?: string | null
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          resource_id?: string
          space_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_pass: {
        Args: {
          p_space_id: string
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      auto_assign_desk: {
        Args: { p_end_date: string; p_space_id: string; p_start_date: string }
        Returns: string
      }
      cancel_booking_refund_credits: {
        Args: { p_booking_id: string; p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      create_booking_with_credits: {
        Args: {
          p_end_time: string
          p_resource_id: string
          p_space_id: string
          p_start_time: string
          p_user_id: string
        }
        Returns: string
      }
      expire_renewable_credits: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: number
      }
      get_credit_balance: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: {
          is_unlimited: boolean
          remaining_minutes: number
          resource_type_id: string
          total_minutes: number
          used_minutes: number
        }[]
      }
      get_desk_availability: {
        Args: { p_date: string; p_space_id: string }
        Returns: {
          available_desks: number
          booked_desks: number
          total_desks: number
        }[]
      }
      get_room_availability: {
        Args: { p_date: string; p_resource_id: string; p_space_id: string }
        Returns: {
          is_available: boolean
          slot_end: string
          slot_start: string
        }[]
      }
      grant_credits: {
        Args: {
          p_amount_minutes: number
          p_metadata?: Json
          p_resource_type_id: string
          p_source: Database["public"]["Enums"]["credit_grant_source"]
          p_space_id: string
          p_stripe_invoice_id?: string
          p_stripe_line_item_id?: string
          p_user_id: string
          p_valid_from?: string
          p_valid_until?: string
        }
        Returns: string
      }
      invoke_edge_function: {
        Args: { p_body?: Json; p_function_name: string }
        Returns: number
      }
      is_platform_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_space_admin: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: boolean
      }
      verify_space_access: { Args: { p_space_id: string }; Returns: undefined }
    }
    Enums: {
      booking_status:
        | "pending_payment"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "no_show"
      credit_grant_source: "subscription" | "purchase" | "manual" | "refund"
      fiscal_id_type:
        | "nif"
        | "nie"
        | "passport"
        | "cif"
        | "eu_vat"
        | "foreign_tax_id"
        | "other"
      lead_status:
        | "new"
        | "invited"
        | "confirmed"
        | "completed"
        | "follow_up"
        | "converted"
        | "lost"
      member_status: "active" | "paused" | "past_due" | "cancelling" | "churned"
      pass_status:
        | "pending_payment"
        | "active"
        | "used"
        | "cancelled"
        | "expired"
      pass_type: "day" | "week"
      product_category:
        | "subscription"
        | "pass"
        | "hour_bundle"
        | "addon"
        | "deposit"
        | "event"
      recurrence_pattern: "daily" | "weekly" | "biweekly"
      resource_status: "available" | "occupied" | "out_of_service"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: [
        "pending_payment",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "no_show",
      ],
      credit_grant_source: ["subscription", "purchase", "manual", "refund"],
      fiscal_id_type: [
        "nif",
        "nie",
        "passport",
        "cif",
        "eu_vat",
        "foreign_tax_id",
        "other",
      ],
      lead_status: [
        "new",
        "invited",
        "confirmed",
        "completed",
        "follow_up",
        "converted",
        "lost",
      ],
      member_status: ["active", "paused", "past_due", "cancelling", "churned"],
      pass_status: [
        "pending_payment",
        "active",
        "used",
        "cancelled",
        "expired",
      ],
      pass_type: ["day", "week"],
      product_category: [
        "subscription",
        "pass",
        "hour_bundle",
        "addon",
        "deposit",
        "event",
      ],
      recurrence_pattern: ["daily", "weekly", "biweekly"],
      resource_status: ["available", "occupied", "out_of_service"],
    },
  },
} as const

