export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      applications: {
        Row: {
          applicant_user_id: string;
          created_at: string;
          id: string;
          kind: string;
          note: string;
          opportunity_id: string;
          referred_by: string | null;
          status: Database["public"]["Enums"]["application_status"];
          team_id: string | null;
          updated_at: string;
        };
        Insert: {
          applicant_user_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          note?: string;
          opportunity_id: string;
          referred_by?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          team_id?: string | null;
          updated_at?: string;
        };
        Update: {
          applicant_user_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          note?: string;
          opportunity_id?: string;
          referred_by?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          team_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string | null;
          at: string;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        Insert: {
          action: string;
          actor?: string | null;
          at?: string;
          entity: string;
          entity_id?: string | null;
          id?: number;
        };
        Update: {
          action?: string;
          actor?: string | null;
          at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: number;
        };
        Relationships: [];
      };
      business_members: {
        Row: {
          business_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          business_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          business_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          about: string;
          created_at: string;
          created_by: string | null;
          district: string;
          id: string;
          is_demo: boolean;
          name: string;
          rating: number;
          sector: string;
          services: string[];
          verified: boolean;
        };
        Insert: {
          about?: string;
          created_at?: string;
          created_by?: string | null;
          district: string;
          id?: string;
          is_demo?: boolean;
          name: string;
          rating?: number;
          sector: string;
          services?: string[];
          verified?: boolean;
        };
        Update: {
          about?: string;
          created_at?: string;
          created_by?: string | null;
          district?: string;
          id?: string;
          is_demo?: boolean;
          name?: string;
          rating?: number;
          sector?: string;
          services?: string[];
          verified?: boolean;
        };
        Relationships: [];
      };
      connections: {
        Row: {
          addressee: string;
          created_at: string;
          id: string;
          relation: string;
          requester: string;
          status: string;
        };
        Insert: {
          addressee: string;
          created_at?: string;
          id?: string;
          relation?: string;
          requester: string;
          status?: string;
        };
        Update: {
          addressee?: string;
          created_at?: string;
          id?: string;
          relation?: string;
          requester?: string;
          status?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string | null;
          deadline: string;
          district: string;
          duration: string;
          featured: boolean;
          id: string;
          is_demo: boolean;
          mode: string;
          pay_rwf: number;
          pay_unit: string;
          requirements: string[];
          responsibilities: string[];
          sector: string;
          skills: string[];
          status: string;
          summary: string;
          team_allowed: boolean;
          team_size: number | null;
          title: string;
          type: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          deadline: string;
          district: string;
          duration?: string;
          featured?: boolean;
          id?: string;
          is_demo?: boolean;
          mode: string;
          pay_rwf: number;
          pay_unit: string;
          requirements?: string[];
          responsibilities?: string[];
          sector: string;
          skills?: string[];
          status?: string;
          summary?: string;
          team_allowed?: boolean;
          team_size?: number | null;
          title: string;
          type: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          deadline?: string;
          district?: string;
          duration?: string;
          featured?: boolean;
          id?: string;
          is_demo?: boolean;
          mode?: string;
          pay_rwf?: number;
          pay_unit?: string;
          requirements?: string[];
          responsibilities?: string[];
          sector?: string;
          skills?: string[];
          status?: string;
          summary?: string;
          team_allowed?: boolean;
          team_size?: number | null;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          district: string | null;
          id: string;
          locale: string;
          phone: string | null;
          phone_verified: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          district?: string | null;
          id: string;
          locale?: string;
          phone?: string | null;
          phone_verified?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          district?: string | null;
          id?: string;
          locale?: string;
          phone?: string | null;
          phone_verified?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          body: string;
          created_at: string;
          from_user: string;
          id: string;
          skill: string;
          to_user: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          from_user: string;
          id?: string;
          skill: string;
          to_user: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          from_user?: string;
          id?: string;
          skill?: string;
          to_user?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          created_at: string;
          id: string;
          note: string;
          opportunity_id: string;
          referee_worker_id: string;
          referrer: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string;
          opportunity_id: string;
          referee_worker_id: string;
          referrer: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string;
          opportunity_id?: string;
          referee_worker_id?: string;
          referrer?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referee_worker_id_fkey";
            columns: ["referee_worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_opportunities: {
        Row: {
          created_at: string;
          opportunity_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          opportunity_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          opportunity_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_opportunities_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          joined_at: string;
          role: string;
          status: string;
          team_id: string;
          worker_id: string;
        };
        Insert: {
          joined_at?: string;
          role?: string;
          status?: string;
          team_id: string;
          worker_id: string;
        };
        Update: {
          joined_at?: string;
          role?: string;
          status?: string;
          team_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          areas: string[];
          available: boolean;
          created_at: string;
          id: string;
          is_demo: boolean;
          lead_user_id: string | null;
          lead_worker_id: string | null;
          name: string;
          projects: number;
          rating: number;
          sector: string;
          skills: string[];
          summary: string;
        };
        Insert: {
          areas?: string[];
          available?: boolean;
          created_at?: string;
          id?: string;
          is_demo?: boolean;
          lead_user_id?: string | null;
          lead_worker_id?: string | null;
          name: string;
          projects?: number;
          rating?: number;
          sector: string;
          skills?: string[];
          summary?: string;
        };
        Update: {
          areas?: string[];
          available?: boolean;
          created_at?: string;
          id?: string;
          is_demo?: boolean;
          lead_user_id?: string | null;
          lead_worker_id?: string | null;
          name?: string;
          projects?: number;
          rating?: number;
          sector?: string;
          skills?: string[];
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_lead_worker_id_fkey";
            columns: ["lead_worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      worker_profiles: {
        Row: {
          available: boolean;
          bio: string;
          created_at: string;
          district: string;
          id: string;
          initials: string;
          is_demo: boolean;
          name: string;
          rate_rwf: number;
          rate_unit: string;
          rating: number;
          rep: Json;
          reviews: number;
          sector: string;
          title: string;
          user_id: string | null;
          verified: boolean;
          visibility: string;
          years: number;
        };
        Insert: {
          available?: boolean;
          bio?: string;
          created_at?: string;
          district: string;
          id?: string;
          initials?: string;
          is_demo?: boolean;
          name: string;
          rate_rwf?: number;
          rate_unit?: string;
          rating?: number;
          rep?: Json;
          reviews?: number;
          sector: string;
          title?: string;
          user_id?: string | null;
          verified?: boolean;
          visibility?: string;
          years?: number;
        };
        Update: {
          available?: boolean;
          bio?: string;
          created_at?: string;
          district?: string;
          id?: string;
          initials?: string;
          is_demo?: boolean;
          name?: string;
          rate_rwf?: number;
          rate_unit?: string;
          rating?: number;
          rep?: Json;
          reviews?: number;
          sector?: string;
          title?: string;
          user_id?: string | null;
          verified?: boolean;
          visibility?: string;
          years?: number;
        };
        Relationships: [];
      };
      worker_skills: {
        Row: {
          id: string;
          level: string;
          name: string;
          verification: string;
          worker_id: string;
        };
        Insert: {
          id?: string;
          level?: string;
          name: string;
          verification?: string;
          worker_id: string;
        };
        Update: {
          id?: string;
          level?: string;
          name?: string;
          verification?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_skills_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      are_connected: { Args: { _a: string; _b: string }; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_business_member: {
        Args: { _bid: string; _roles?: string[] };
        Returns: boolean;
      };
      is_team_lead: { Args: { _tid: string }; Returns: boolean };
      my_worker_id: { Args: never; Returns: string };
      worker_network_count: { Args: { _worker_id: string }; Returns: number };
    };
    Enums: {
      app_role: "worker" | "team_lead" | "business" | "learner" | "admin" | "institution";
      application_status:
        "submitted" | "viewed" | "shortlisted" | "rejected" | "accepted" | "withdrawn";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["worker", "team_lead", "business", "learner", "admin", "institution"],
      application_status: [
        "submitted",
        "viewed",
        "shortlisted",
        "rejected",
        "accepted",
        "withdrawn",
      ],
    },
  },
} as const;
