export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          category: Database["public"]["Enums"]["category_type"]
          client_ref: string | null
          created_by: string | null
          direction: string
          entry_gate: string
          host_id: string | null
          id: string
          id_document_text: string | null
          id_document_url: string | null
          invite_id: string | null
          notes: string | null
          photo_captured: string | null
          property_id: string
          status: Database["public"]["Enums"]["access_status"]
          synced_from_offline: boolean
          timestamp: string
          user_id: string | null
          vehicle_plate: string | null
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["category_type"]
          client_ref?: string | null
          created_by?: string | null
          direction?: string
          entry_gate?: string
          host_id?: string | null
          id?: string
          id_document_text?: string | null
          id_document_url?: string | null
          invite_id?: string | null
          notes?: string | null
          photo_captured?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["access_status"]
          synced_from_offline?: boolean
          timestamp?: string
          user_id?: string | null
          vehicle_plate?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["category_type"]
          client_ref?: string | null
          created_by?: string | null
          direction?: string
          entry_gate?: string
          host_id?: string | null
          id?: string
          id_document_text?: string | null
          id_document_url?: string | null
          invite_id?: string | null
          notes?: string | null
          photo_captured?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["access_status"]
          synced_from_offline?: boolean
          timestamp?: string
          user_id?: string | null
          vehicle_plate?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "guest_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          app_version: string | null
          battery_percent: number | null
          created_at: string
          device_key: string
          gate: string | null
          id: string
          kind: string
          last_error: string | null
          last_seen_at: string
          last_synced_at: string | null
          name: string
          online: boolean
          property_id: string
          queue_depth: number
          user_agent: string | null
        }
        Insert: {
          app_version?: string | null
          battery_percent?: number | null
          created_at?: string
          device_key: string
          gate?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_seen_at?: string
          last_synced_at?: string | null
          name?: string
          online?: boolean
          property_id: string
          queue_depth?: number
          user_agent?: string | null
        }
        Update: {
          app_version?: string | null
          battery_percent?: number | null
          created_at?: string
          device_key?: string
          gate?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_seen_at?: string
          last_synced_at?: string | null
          name?: string
          online?: boolean
          property_id?: string
          queue_depth?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_invites: {
        Row: {
          access_code: string
          created_at: string
          guest_name: string
          guest_phone: string | null
          host_id: string
          id: string
          is_used: boolean
          property_id: string
          purpose: string | null
          valid_from: string
          valid_until: string
          vehicle_plate: string | null
        }
        Insert: {
          access_code: string
          created_at?: string
          guest_name: string
          guest_phone?: string | null
          host_id: string
          id?: string
          is_used?: boolean
          property_id: string
          purpose?: string | null
          valid_from?: string
          valid_until?: string
          vehicle_plate?: string | null
        }
        Update: {
          access_code?: string
          created_at?: string
          guest_name?: string
          guest_phone?: string | null
          host_id?: string
          id?: string
          is_used?: boolean
          property_id?: string
          purpose?: string | null
          valid_from?: string
          valid_until?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_invites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          claim_code: string
          claimed_at: string | null
          courier_name: string
          created_at: string
          id: string
          photo_url: string | null
          property_id: string
          recipient_id: string | null
          status: string
          tracking_no: string | null
          unit_id: string | null
        }
        Insert: {
          claim_code: string
          claimed_at?: string | null
          courier_name: string
          created_at?: string
          id?: string
          photo_url?: string | null
          property_id: string
          recipient_id?: string | null
          status?: string
          tracking_no?: string | null
          unit_id?: string | null
        }
        Update: {
          claim_code?: string
          claimed_at?: string | null
          courier_name?: string
          created_at?: string
          id?: string
          photo_url?: string | null
          property_id?: string
          recipient_id?: string | null
          status?: string
          tracking_no?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcels_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          category: Database["public"]["Enums"]["category_type"]
          created_at: string
          email: string | null
          full_name: string
          id: string
          id_photo_url: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          property_id: string | null
          unit_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["category_type"]
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          id_photo_url?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          property_id?: string | null
          unit_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["category_type"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          id_photo_url?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          property_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          created_at: string
          gates: string[]
          id: string
          mask_contacts_in_logs: boolean
          name: string
          require_host_approval: boolean
          type: Database["public"]["Enums"]["property_type"]
          unit_label: string
          zone_label: string
        }
        Insert: {
          address?: string
          created_at?: string
          gates?: string[]
          id?: string
          mask_contacts_in_logs?: boolean
          name: string
          require_host_approval?: boolean
          type?: Database["public"]["Enums"]["property_type"]
          unit_label?: string
          zone_label?: string
        }
        Update: {
          address?: string
          created_at?: string
          gates?: string[]
          id?: string
          mask_contacts_in_logs?: boolean
          name?: string
          require_host_approval?: boolean
          type?: Database["public"]["Enums"]["property_type"]
          unit_label?: string
          zone_label?: string
        }
        Relationships: []
      }
      qr_credentials: {
        Row: {
          id: string
          is_active: boolean
          qr_token: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean
          qr_token: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean
          qr_token?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          property_id: string
          unit_number: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          unit_number: string
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          unit_number?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          created_at: string
          id: string
          name: string
          property_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          property_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_property_id: { Args: never; Returns: string }
    }
    Enums: {
      access_status: "GRANTED" | "DENIED" | "PENDING_HOST_APPROVAL" | "EXPIRED"
      app_role:
        | "super_admin"
        | "property_admin"
        | "security_guard"
        | "host_resident"
        | "visitor"
      category_type:
        | "RESIDENT"
        | "EMPLOYEE"
        | "WORKER"
        | "GUEST"
        | "TRANSIENT"
        | "STAFF"
      property_type:
        | "RESIDENTIAL_CONDO"
        | "SUBDIVISION"
        | "OFFICE_TOWER"
        | "MALL"
        | "HOSPITAL"
        | "SCHOOL"
        | "FACTORY"
        | "RESORT_HOTEL"
        | "SPORTS_CLUB"
        | "OTHER"
        | "MIXED_USE"
        | "DORMITORY"
        | "WAREHOUSE"
        | "EMBASSY"
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
  public: {
    Enums: {
      access_status: ["GRANTED", "DENIED", "PENDING_HOST_APPROVAL", "EXPIRED"],
      app_role: [
        "super_admin",
        "property_admin",
        "security_guard",
        "host_resident",
        "visitor",
      ],
      category_type: [
        "RESIDENT",
        "EMPLOYEE",
        "WORKER",
        "GUEST",
        "TRANSIENT",
        "STAFF",
      ],
      property_type: [
        "RESIDENTIAL_CONDO",
        "SUBDIVISION",
        "OFFICE_TOWER",
        "MALL",
        "HOSPITAL",
        "SCHOOL",
        "FACTORY",
        "RESORT_HOTEL",
        "SPORTS_CLUB",
        "OTHER",
        "MIXED_USE",
        "DORMITORY",
        "WAREHOUSE",
        "EMBASSY",
      ],
    },
  },
} as const
