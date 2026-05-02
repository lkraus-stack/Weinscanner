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
      ai_feedback: {
        Row: {
          ai_value: string | null
          created_at: string
          field: string
          id: string
          scan_id: string | null
          user_id: string
          user_value: string | null
        }
        Insert: {
          ai_value?: string | null
          created_at?: string
          field: string
          id?: string
          scan_id?: string | null
          user_id: string
          user_value?: string | null
        }
        Update: {
          ai_value?: string | null
          created_at?: string
          field?: string
          id?: string
          scan_id?: string | null
          user_id?: string
          user_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          purchase_price: number | null
          purchased_at: string | null
          quantity: number | null
          storage_location: string | null
          user_id: string
          vintage_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_price?: number | null
          purchased_at?: string | null
          quantity?: number | null
          storage_location?: string | null
          user_id?: string
          vintage_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_price?: number | null
          purchased_at?: string | null
          quantity?: number | null
          storage_location?: string | null
          user_id?: string
          vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_ai_analyses: {
        Row: {
          analysis_version: string
          confidence: string
          created_at: string
          evidence: Json
          expires_at: string
          generated_at: string
          headline: string
          id: string
          matching_inventory_item_ids: string[]
          occasion: string
          provider_place_id: string
          reason: string
          restaurant_id: string
          result_payload: Json
          review_signals: string[]
          role_label: string
          score: number
          strengths: string[]
          user_id: string
          watchouts: string[]
          wine_fit: string | null
        }
        Insert: {
          analysis_version?: string
          confidence: string
          created_at?: string
          evidence?: Json
          expires_at: string
          generated_at?: string
          headline: string
          id?: string
          matching_inventory_item_ids?: string[]
          occasion: string
          provider_place_id: string
          reason: string
          restaurant_id: string
          result_payload?: Json
          review_signals?: string[]
          role_label: string
          score: number
          strengths?: string[]
          user_id?: string
          watchouts?: string[]
          wine_fit?: string | null
        }
        Update: {
          analysis_version?: string
          confidence?: string
          created_at?: string
          evidence?: Json
          expires_at?: string
          generated_at?: string
          headline?: string
          id?: string
          matching_inventory_item_ids?: string[]
          occasion?: string
          provider_place_id?: string
          reason?: string
          restaurant_id?: string
          result_payload?: Json
          review_signals?: string[]
          role_label?: string
          score?: number
          strengths?: string[]
          user_id?: string
          watchouts?: string[]
          wine_fit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ai_analyses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_ratings: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          overall_stars: number
          restaurant_id: string
          updated_at: string
          user_id: string
          visited_at: string | null
          wine_stars: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          overall_stars: number
          restaurant_id: string
          updated_at?: string
          user_id?: string
          visited_at?: string | null
          wine_stars: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          overall_stars?: number
          restaurant_id?: string
          updated_at?: string
          user_id?: string
          visited_at?: string | null
          wine_stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_search_cache: {
        Row: {
          bounds: Json
          center_lat: number
          center_lng: number
          expires_at: string
          fetched_at: string
          filters: Json | null
          id: string
          provider: string
          query_hash: string
          restaurant_ids: string[]
        }
        Insert: {
          bounds: Json
          center_lat: number
          center_lng: number
          expires_at?: string
          fetched_at?: string
          filters?: Json | null
          id?: string
          provider: string
          query_hash: string
          restaurant_ids?: string[]
        }
        Update: {
          bounds?: Json
          center_lat?: number
          center_lng?: number
          expires_at?: string
          fetched_at?: string
          filters?: Json | null
          id?: string
          provider?: string
          query_hash?: string
          restaurant_ids?: string[]
        }
        Relationships: []
      }
      restaurant_visits: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          notes: string | null
          restaurant_id: string
          user_id: string
          visited_at: string
          vintage_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          restaurant_id: string
          user_id?: string
          visited_at?: string
          vintage_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          restaurant_id?: string
          user_id?: string
          visited_at?: string
          vintage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_visits_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_visits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_visits_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_recommendation_runs: {
        Row: {
          analysis_version: string
          candidate_restaurant_ids: string[]
          center_lat: number | null
          center_lng: number | null
          context_label: string
          created_at: string
          expires_at: string
          filters: Json
          generated_at: string
          id: string
          occasion: string
          recommendation_payload: Json
          request_hash: string
          user_id: string
        }
        Insert: {
          analysis_version?: string
          candidate_restaurant_ids?: string[]
          center_lat?: number | null
          center_lng?: number | null
          context_label: string
          created_at?: string
          expires_at: string
          filters?: Json
          generated_at?: string
          id?: string
          occasion: string
          recommendation_payload?: Json
          request_hash: string
          user_id?: string
        }
        Update: {
          analysis_version?: string
          candidate_restaurant_ids?: string[]
          center_lat?: number | null
          center_lng?: number | null
          context_label?: string
          created_at?: string
          expires_at?: string
          filters?: Json
          generated_at?: string
          id?: string
          occasion?: string
          recommendation_payload?: Json
          request_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          cuisine: string | null
          formatted_address: string | null
          google_maps_uri: string | null
          id: string
          last_fetched_at: string
          latitude: number
          longitude: number
          name: string
          opening_hours: Json | null
          phone: string | null
          photo_refs: Json | null
          place_types: string[] | null
          price_level: string | null
          provider: string
          provider_place_id: string
          rating: number | null
          rating_count: number | null
          source_payload: Json | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          cuisine?: string | null
          formatted_address?: string | null
          google_maps_uri?: string | null
          id?: string
          last_fetched_at?: string
          latitude: number
          longitude: number
          name: string
          opening_hours?: Json | null
          phone?: string | null
          photo_refs?: Json | null
          place_types?: string[] | null
          price_level?: string | null
          provider: string
          provider_place_id: string
          rating?: number | null
          rating_count?: number | null
          source_payload?: Json | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          cuisine?: string | null
          formatted_address?: string | null
          google_maps_uri?: string | null
          id?: string
          last_fetched_at?: string
          latitude?: number
          longitude?: number
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          photo_refs?: Json | null
          place_types?: string[] | null
          price_level?: string | null
          provider?: string
          provider_place_id?: string
          rating?: number | null
          rating_count?: number | null
          source_payload?: Json | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      saved_restaurants: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean | null
          preferences: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          preferences?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          preferences?: Json | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          drank_at: string | null
          id: string
          notes: string | null
          occasion: string | null
          scan_id: string | null
          stars: number | null
          user_id: string
          vintage_id: string
        }
        Insert: {
          created_at?: string
          drank_at?: string | null
          id?: string
          notes?: string | null
          occasion?: string | null
          scan_id?: string | null
          stars?: number | null
          user_id?: string
          vintage_id: string
        }
        Update: {
          created_at?: string
          drank_at?: string | null
          id?: string
          notes?: string | null
          occasion?: string | null
          scan_id?: string | null
          stars?: number | null
          user_id?: string
          vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          bottle_image_url: string | null
          id: string
          label_image_url: string | null
          scan_location_lat: number | null
          scan_location_lng: number | null
          scan_location_name: string | null
          scanned_at: string
          user_id: string
          vintage_id: string | null
        }
        Insert: {
          bottle_image_url?: string | null
          id?: string
          label_image_url?: string | null
          scan_location_lat?: number | null
          scan_location_lng?: number | null
          scan_location_name?: string | null
          scanned_at?: string
          user_id: string
          vintage_id?: string | null
        }
        Update: {
          bottle_image_url?: string | null
          id?: string
          label_image_url?: string | null
          scan_location_lat?: number | null
          scan_location_lng?: number | null
          scan_location_name?: string | null
          scanned_at?: string
          user_id?: string
          vintage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scans_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      vintages: {
        Row: {
          ai_confidence: number | null
          alcohol_percent: number | null
          aromas: Json | null
          created_at: string
          data_sources: Json | null
          description_long: string | null
          description_short: string | null
          drinking_window_end: number | null
          drinking_window_start: number | null
          food_pairing: string | null
          id: string
          price_max_eur: number | null
          price_min_eur: number | null
          serving_temperature: string | null
          vinification: string | null
          vintage_year: number
          wine_id: string
        }
        Insert: {
          ai_confidence?: number | null
          alcohol_percent?: number | null
          aromas?: Json | null
          created_at?: string
          data_sources?: Json | null
          description_long?: string | null
          description_short?: string | null
          drinking_window_end?: number | null
          drinking_window_start?: number | null
          food_pairing?: string | null
          id?: string
          price_max_eur?: number | null
          price_min_eur?: number | null
          serving_temperature?: string | null
          vinification?: string | null
          vintage_year: number
          wine_id: string
        }
        Update: {
          ai_confidence?: number | null
          alcohol_percent?: number | null
          aromas?: Json | null
          created_at?: string
          data_sources?: Json | null
          description_long?: string | null
          description_short?: string | null
          drinking_window_end?: number | null
          drinking_window_start?: number | null
          food_pairing?: string | null
          id?: string
          price_max_eur?: number | null
          price_min_eur?: number | null
          serving_temperature?: string | null
          vinification?: string | null
          vintage_year?: number
          wine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vintages_wine_id_fkey"
            columns: ["wine_id"]
            isOneToOne: false
            referencedRelation: "wines"
            referencedColumns: ["id"]
          },
        ]
      }
      wines: {
        Row: {
          appellation: string | null
          country: string | null
          created_at: string
          embedding: string | null
          grape_variety: string | null
          id: string
          producer: string
          region: string | null
          search_text: string | null
          sub_region: string | null
          taste_dryness: string | null
          updated_at: string
          wine_color: string | null
          wine_name: string
        }
        Insert: {
          appellation?: string | null
          country?: string | null
          created_at?: string
          embedding?: string | null
          grape_variety?: string | null
          id?: string
          producer: string
          region?: string | null
          search_text?: string | null
          sub_region?: string | null
          taste_dryness?: string | null
          updated_at?: string
          wine_color?: string | null
          wine_name: string
        }
        Update: {
          appellation?: string | null
          country?: string | null
          created_at?: string
          embedding?: string | null
          grape_variety?: string | null
          id?: string
          producer?: string
          region?: string | null
          search_text?: string | null
          sub_region?: string | null
          taste_dryness?: string | null
          updated_at?: string
          wine_color?: string | null
          wine_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_inventory_quantity: {
        Args: { item_id: string }
        Returns: {
          created_at: string
          id: string
          notes: string | null
          purchase_price: number | null
          purchased_at: string | null
          quantity: number | null
          storage_location: string | null
          user_id: string
          vintage_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean | null
          preferences: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_inventory_with_photos: {
        Args: {
          hide_empty_inventory?: boolean
          page_limit?: number
          page_offset?: number
          storage_location_filter?: string
        }
        Returns: {
          country: string
          created_at: string
          id: string
          image_path: string
          latest_scan_id: string
          notes: string
          producer: string
          purchase_price: number
          purchased_at: string
          quantity: number
          region: string
          storage_location: string
          vintage_id: string
          vintage_year: number
          wine_color: string
          wine_id: string
          wine_name: string
        }[]
      }
      get_user_scan_history: {
        Args: {
          page_limit?: number
          page_offset?: number
          search_query?: string
          wine_color_filter?: string
        }
        Returns: {
          country: string | null
          grape_variety: string | null
          label_image_path: string | null
          producer: string | null
          rating_id: string | null
          rating_stars: number | null
          region: string | null
          scan_id: string
          scanned_at: string
          vintage_id: string | null
          vintage_year: number | null
          wine_color: string | null
          wine_id: string | null
          wine_name: string | null
        }[]
      }
      reassign_scan_vintage: {
        Args: { scan_id: string; target_vintage_year: number }
        Returns: Json
      }
      save_scan_atomic: { Args: { payload: Json }; Returns: Json }
      search_wines: {
        Args: {
          query_grape_variety?: string | null
          query_producer: string
          query_wine_name: string
          similarity_threshold?: number
        }
        Returns: {
          country: string
          grape_similarity: number
          grape_variety: string
          id: string
          producer: string
          producer_similarity: number
          region: string
          similarity: number
          wine_name_similarity: number
          wine_name: string
        }[]
      }
      user_stats: {
        Args: { p_user_id: string }
        Returns: {
          distinct_regions: number
          rating_count: number
          scan_count: number
          top_grape_variety: string
          top_region: string
          total_bottles: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
