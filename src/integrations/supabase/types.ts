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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          meta: Json
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      event_metrics: {
        Row: {
          event_id: string
          id: string
          metric_key: string
          metric_unit: string | null
          metric_value_numeric: number | null
          metric_value_text: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          metric_key: string
          metric_unit?: string | null
          metric_value_numeric?: number | null
          metric_value_text?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          metric_key?: string
          metric_unit?: string | null
          metric_value_numeric?: number | null
          metric_value_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_metrics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          external_id: string | null
          id: string
          integration_id: string | null
          is_high_signal: boolean
          occurred_at: string
          payload: Json
          provider: Database["public"]["Enums"]["integration_provider"] | null
          signal_score: number
          source_url: string | null
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["event_type"]
          external_id?: string | null
          id?: string
          integration_id?: string | null
          is_high_signal?: boolean
          occurred_at: string
          payload?: Json
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          signal_score?: number
          source_url?: string | null
          summary?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          external_id?: string | null
          id?: string
          integration_id?: string | null
          is_high_signal?: boolean
          occurred_at?: string
          payload?: Json
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          signal_score?: number
          source_url?: string | null
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          external_account_id: string | null
          external_account_label: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_encrypted: string | null
          scopes: string[] | null
          status: Database["public"]["Enums"]["integration_status"]
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          external_account_id?: string | null
          external_account_label?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["integration_status"]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          external_account_id?: string | null
          external_account_label?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["integration_status"]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link_url: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link_url?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_url?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      evidence_items: {
        Row: {
          id: string
          map_id: string
          waypoint_id: string | null
          user_id: string
          body: string
          source_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          map_id: string
          waypoint_id?: string | null
          user_id: string
          body: string
          source_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          map_id?: string
          waypoint_id?: string | null
          user_id?: string
          body?: string
          source_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      maps: {
        Row: {
          id: string
          user_id: string
          name: string
          goal_statement: string
          confidence: Database["public"]["Enums"]["map_confidence"]
          is_published: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          goal_statement: string
          confidence?: Database["public"]["Enums"]["map_confidence"]
          is_published?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          goal_statement?: string
          confidence?: Database["public"]["Enums"]["map_confidence"]
          is_published?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          handle: string | null
          id: string
          onboarded_at: string | null
          page_visibility: Database["public"]["Enums"]["page_visibility"]
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id: string
          onboarded_at?: string | null
          page_visibility?: Database["public"]["Enums"]["page_visibility"]
          plan?: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id?: string
          onboarded_at?: string | null
          page_visibility?: Database["public"]["Enums"]["page_visibility"]
          plan?: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          id: string
          map_id: string
          user_id: string
          event_id: string | null
          title: string
          score: number
          payload: Json
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          map_id: string
          user_id: string
          event_id?: string | null
          title: string
          score?: number
          payload?: Json
          occurred_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          map_id?: string
          user_id?: string
          event_id?: string | null
          title?: string
          score?: number
          payload?: Json
          occurred_at?: string
          created_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          id: string
          map_id: string
          user_id: string
          integration_id: string | null
          provider: Database["public"]["Enums"]["integration_provider"] | null
          label: string
          created_at: string
        }
        Insert: {
          id?: string
          map_id: string
          user_id: string
          integration_id?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          label: string
          created_at?: string
        }
        Update: {
          id?: string
          map_id?: string
          user_id?: string
          integration_id?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"] | null
          label?: string
          created_at?: string
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          id: string
          map_id: string
          user_id: string
          title: string
          body: string | null
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          map_id: string
          user_id: string
          title: string
          body?: string | null
          occurred_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          map_id?: string
          user_id?: string
          title?: string
          body?: string | null
          occurred_at?: string
          created_at?: string
        }
        Relationships: []
      }
      waypoints: {
        Row: {
          id: string
          map_id: string
          user_id: string
          kind: Database["public"]["Enums"]["waypoint_kind"]
          title: string
          confidence: Database["public"]["Enums"]["map_confidence"]
          position: number
          milestone_id: string | null
          predicted_signal: string | null
          predicted_direction: Database["public"]["Enums"]["predicted_direction"] | null
          predicted_baseline_value: string | null
          check_back_date: string | null
          result_status: Database["public"]["Enums"]["prediction_status"] | null
          result_summary: string | null
          metadata: Json | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          map_id: string
          user_id: string
          kind: Database["public"]["Enums"]["waypoint_kind"]
          title: string
          confidence?: Database["public"]["Enums"]["map_confidence"]
          position?: number
          milestone_id?: string | null
          predicted_signal?: string | null
          predicted_direction?: Database["public"]["Enums"]["predicted_direction"] | null
          predicted_baseline_value?: string | null
          check_back_date?: string | null
          result_status?: Database["public"]["Enums"]["prediction_status"] | null
          result_summary?: string | null
          metadata?: Json | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          map_id?: string
          user_id?: string
          kind?: Database["public"]["Enums"]["waypoint_kind"]
          title?: string
          confidence?: Database["public"]["Enums"]["map_confidence"]
          position?: number
          milestone_id?: string | null
          predicted_signal?: string | null
          predicted_direction?: Database["public"]["Enums"]["predicted_direction"] | null
          predicted_baseline_value?: string | null
          check_back_date?: string | null
          result_status?: Database["public"]["Enums"]["prediction_status"] | null
          result_summary?: string | null
          metadata?: Json | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waypoints_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          }
        ]
      }
      public_snapshots: {
        Row: {
          generated_at: string
          handle: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          generated_at?: string
          handle: string
          snapshot: Json
          user_id: string
        }
        Update: {
          generated_at?: string
          handle?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: []
      }
      report_event_links: {
        Row: {
          citation_order: number
          event_id: string
          report_id: string
        }
        Insert: {
          citation_order?: number
          event_id: string
          report_id: string
        }
        Update: {
          citation_order?: number
          event_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_event_links_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          llm_output_md: string | null
          og_image_url: string | null
          period_end: string
          period_start: string
          published: boolean
          published_at: string | null
          template_output_md: string
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
          user_id: string
          validator_passed: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          llm_output_md?: string | null
          og_image_url?: string | null
          period_end: string
          period_start: string
          published?: boolean
          published_at?: string | null
          template_output_md: string
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at?: string
          user_id: string
          validator_passed?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          llm_output_md?: string | null
          og_image_url?: string | null
          period_end?: string
          period_start?: string
          published?: boolean
          published_at?: string | null
          template_output_md?: string
          title?: string
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
          user_id?: string
          validator_passed?: boolean
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          error: string | null
          events_ingested: number
          finished_at: string | null
          id: string
          integration_id: string
          kind: string
          started_at: string
          user_id: string
        }
        Insert: {
          error?: string | null
          events_ingested?: number
          finished_at?: string | null
          id?: string
          integration_id: string
          kind?: string
          started_at?: string
          user_id: string
        }
        Update: {
          error?: string | null
          events_ingested?: number
          finished_at?: string | null
          id?: string
          integration_id?: string
          kind?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
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
      milestones: {
        Row: {
          id: string
          map_id: string
          title: string
          description: string | null
          sequence: number
          status: Database["public"]["Enums"]["milestone_status"]
          estimated_start: string | null
          estimated_complete: string | null
          actual_complete_at: string | null
          is_reforecast: boolean
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          map_id: string
          title: string
          description?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          estimated_start?: string | null
          estimated_complete?: string | null
          actual_complete_at?: string | null
          is_reforecast?: boolean
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          map_id?: string
          title?: string
          description?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          estimated_start?: string | null
          estimated_complete?: string | null
          actual_complete_at?: string | null
          is_reforecast?: boolean
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          }
        ]
      }
      commitments: {
        Row: {
          id: string
          map_id: string
          waypoint_id: string
          user_id: string
          date: string
          status: Database["public"]["Enums"]["commitment_status"]
          note: string | null
          timezone: string
          reminder_sent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          map_id: string
          waypoint_id: string
          user_id: string
          date: string
          status?: Database["public"]["Enums"]["commitment_status"]
          note?: string | null
          timezone?: string
          reminder_sent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          map_id?: string
          waypoint_id?: string
          user_id?: string
          date?: string
          status?: Database["public"]["Enums"]["commitment_status"]
          note?: string | null
          timezone?: string
          reminder_sent?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_waypoint_id_fkey"
            columns: ["waypoint_id"]
            isOneToOne: false
            referencedRelation: "waypoints"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          map_id: string
          user_id: string
          role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          map_id: string
          user_id: string
          role: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          map_id?: string
          user_id?: string
          role?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          }
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
      active_map_count: {
        Args: { _user_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
      commitment_status: "committed" | "done" | "not_done"
      event_type:
        | "gh_pr_merged"
        | "gh_release"
        | "gh_deploy"
        | "gh_repo_created"
        | "gh_readme_milestone"
        | "stripe_new_customer"
        | "stripe_first_dollar"
        | "stripe_mrr_milestone"
        | "stripe_churn_saved"
        | "stripe_refund"
        | "linear_cycle_completed"
        | "linear_issue_closed"
        | "linear_project_shipped"
        | "linear_milestone"
        | "posthog_wau_milestone"
        | "posthog_feature_adoption"
        | "posthog_retention_milestone"
        | "posthog_funnel_improvement"
        | "manual_note"
      integration_provider: "github" | "stripe" | "linear" | "posthog"
      integration_status: "active" | "error" | "disconnected" | "syncing"
      map_confidence: "starter" | "emerging" | "established"
      milestone_status: "pending" | "active" | "complete" | "skipped"
      page_visibility: "public" | "unlisted" | "private"
      predicted_direction: "up" | "down" | "flat"
      prediction_status: "pending" | "held" | "missed" | "unclear"
      report_type: "weekly" | "investor" | "launch_post"
      user_plan: "free" | "atlas"
      waypoint_kind: "goal" | "constraint" | "evidence" | "move"
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
      app_role: ["admin", "user"],
      commitment_status: ["committed", "done", "not_done"],
      event_type: [
        "gh_pr_merged",
        "gh_release",
        "gh_deploy",
        "gh_repo_created",
        "gh_readme_milestone",
        "stripe_new_customer",
        "stripe_first_dollar",
        "stripe_mrr_milestone",
        "stripe_churn_saved",
        "stripe_refund",
        "linear_cycle_completed",
        "linear_issue_closed",
        "linear_project_shipped",
        "linear_milestone",
        "posthog_wau_milestone",
        "posthog_feature_adoption",
        "posthog_retention_milestone",
        "posthog_funnel_improvement",
        "manual_note",
      ],
      integration_provider: ["github", "stripe", "linear", "posthog"],
      integration_status: ["active", "error", "disconnected", "syncing"],
      milestone_status: ["pending", "active", "complete", "skipped"],
      page_visibility: ["public", "unlisted", "private"],
      predicted_direction: ["up", "down", "flat"],
      prediction_status: ["pending", "held", "missed", "unclear"],
      report_type: ["weekly", "investor", "launch_post"],
    },
  },
} as const
