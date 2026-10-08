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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          accepted_terms_version: number
          applicant_business_id: string | null
          applicant_team_id: string | null
          applicant_type: string
          applicant_user_id: string
          created_at: string
          id: string
          kind: string
          note: string
          opportunity_id: string
          referred_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_terms_version?: number
          applicant_business_id?: string | null
          applicant_team_id?: string | null
          applicant_type?: string
          applicant_user_id: string
          created_at?: string
          id?: string
          kind?: string
          note?: string
          opportunity_id: string
          referred_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_terms_version?: number
          applicant_business_id?: string | null
          applicant_team_id?: string | null
          applicant_type?: string
          applicant_user_id?: string
          created_at?: string
          id?: string
          kind?: string
          note?: string
          opportunity_id?: string
          referred_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_business_id_fkey"
            columns: ["applicant_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_applicant_team_id_fkey"
            columns: ["applicant_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          at: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      business_districts: {
        Row: {
          business_id: string
          created_at: string
          district: string
        }
        Insert: {
          business_id: string
          created_at?: string
          district: string
        }
        Update: {
          business_id?: string
          created_at?: string
          district?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_districts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          about: string
          avatar_url: string | null
          created_at: string
          created_by: string | null
          district: string
          id: string
          is_demo: boolean
          name: string
          rating: number
          sector: string
          services: string[]
          verified: boolean
        }
        Insert: {
          about?: string
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          district: string
          id?: string
          is_demo?: boolean
          name: string
          rating?: number
          sector: string
          services?: string[]
          verified?: boolean
        }
        Update: {
          about?: string
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          district?: string
          id?: string
          is_demo?: boolean
          name?: string
          rating?: number
          sector?: string
          services?: string[]
          verified?: boolean
        }
        Relationships: []
      }
      completion_events: {
        Row: {
          actor: string | null
          at: string
          completion_id: string
          contract_id: string
          event_type: string
          from_status: Database["public"]["Enums"]["completion_status"] | null
          id: number
          note: string | null
          to_status: Database["public"]["Enums"]["completion_status"]
        }
        Insert: {
          actor?: string | null
          at?: string
          completion_id: string
          contract_id: string
          event_type: string
          from_status?: Database["public"]["Enums"]["completion_status"] | null
          id?: never
          note?: string | null
          to_status: Database["public"]["Enums"]["completion_status"]
        }
        Update: {
          actor?: string | null
          at?: string
          completion_id?: string
          contract_id?: string
          event_type?: string
          from_status?: Database["public"]["Enums"]["completion_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["completion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "completion_events_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "contract_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          addressee: string
          created_at: string
          id: string
          relation: string
          requester: string
          status: string
        }
        Insert: {
          addressee: string
          created_at?: string
          id?: string
          relation?: string
          requester: string
          status?: string
        }
        Update: {
          addressee?: string
          created_at?: string
          id?: string
          relation?: string
          requester?: string
          status?: string
        }
        Relationships: []
      }
      contract_completions: {
        Row: {
          completed_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          contract_id: string
          created_at: string
          id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_note: string | null
          request_note: string | null
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["completion_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          contract_id: string
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_note?: string | null
          request_note?: string | null
          requested_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["completion_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_note?: string | null
          request_note?: string | null
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["completion_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_completions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          actor: string | null
          at: string
          contract_id: string
          event_type: string
          from_status: Database["public"]["Enums"]["contract_status"] | null
          id: number
          note: string | null
          to_status: Database["public"]["Enums"]["contract_status"]
        }
        Insert: {
          actor?: string | null
          at?: string
          contract_id: string
          event_type: string
          from_status?: Database["public"]["Enums"]["contract_status"] | null
          id?: never
          note?: string | null
          to_status: Database["public"]["Enums"]["contract_status"]
        }
        Update: {
          actor?: string | null
          at?: string
          contract_id?: string
          event_type?: string
          from_status?: Database["public"]["Enums"]["contract_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["contract_status"]
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          accepted_at: string | null
          activated_at: string | null
          amount_rwf: number
          application_id: string
          business_id: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          declined_at: string | null
          end_date: string | null
          id: string
          is_demo: boolean
          opportunity_id: string
          proposed_at: string
          proposed_by: string
          scope: string
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          team_id: string | null
          terms: string | null
          title: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          activated_at?: string | null
          amount_rwf: number
          application_id: string
          business_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          end_date?: string | null
          id?: string
          is_demo?: boolean
          opportunity_id: string
          proposed_at?: string
          proposed_by: string
          scope: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          team_id?: string | null
          terms?: string | null
          title: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          activated_at?: string | null
          amount_rwf?: number
          application_id?: string
          business_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          declined_at?: string | null
          end_date?: string | null
          id?: string
          is_demo?: boolean
          opportunity_id?: string
          proposed_at?: string
          proposed_by?: string
          scope?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          team_id?: string | null
          terms?: string | null
          title?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          opportunity_id: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          opportunity_id?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          opportunity_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_events: {
        Row: {
          actor: string | null
          at: string
          contract_id: string
          event_type: string
          from_status: Database["public"]["Enums"]["milestone_status"] | null
          id: number
          milestone_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["milestone_status"]
        }
        Insert: {
          actor?: string | null
          at?: string
          contract_id: string
          event_type: string
          from_status?: Database["public"]["Enums"]["milestone_status"] | null
          id?: never
          milestone_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["milestone_status"]
        }
        Update: {
          actor?: string | null
          at?: string
          contract_id?: string
          event_type?: string
          from_status?: Database["public"]["Enums"]["milestone_status"] | null
          id?: never
          milestone_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["milestone_status"]
        }
        Relationships: [
          {
            foreignKeyName: "milestone_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_events_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          amount_rwf: number
          approved_at: string | null
          contract_id: string
          created_at: string
          description: string
          disputed_at: string | null
          due_date: string
          id: string
          sequence: number
          status: Database["public"]["Enums"]["milestone_status"]
          submission_note: string | null
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount_rwf: number
          approved_at?: string | null
          contract_id: string
          created_at?: string
          description: string
          disputed_at?: string | null
          due_date: string
          id?: string
          sequence: number
          status?: Database["public"]["Enums"]["milestone_status"]
          submission_note?: string | null
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount_rwf?: number
          approved_at?: string | null
          contract_id?: string
          created_at?: string
          description?: string
          disputed_at?: string | null
          due_date?: string
          id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          submission_note?: string | null
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read?: boolean
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          author_type: string
          business_id: string | null
          change_note: string | null
          created_at: string
          created_by: string | null
          deadline: string
          district: string
          duration: string
          eligible_actor_types: string[]
          featured: boolean
          id: string
          is_demo: boolean
          mode: string
          pay_rwf: number
          pay_unit: string
          requirements: string[]
          responsibilities: string[]
          sector: string
          skills: string[]
          status: string
          summary: string
          team_allowed: boolean
          team_size: number | null
          terms_version: number
          title: string
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          author_type?: string
          business_id?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          deadline: string
          district: string
          duration?: string
          eligible_actor_types?: string[]
          featured?: boolean
          id?: string
          is_demo?: boolean
          mode: string
          pay_rwf: number
          pay_unit: string
          requirements?: string[]
          responsibilities?: string[]
          sector: string
          skills?: string[]
          status?: string
          summary?: string
          team_allowed?: boolean
          team_size?: number | null
          terms_version?: number
          title: string
          type: string
          updated_at?: string
          version?: number
        }
        Update: {
          author_type?: string
          business_id?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string
          district?: string
          duration?: string
          eligible_actor_types?: string[]
          featured?: boolean
          id?: string
          is_demo?: boolean
          mode?: string
          pay_rwf?: number
          pay_unit?: string
          requirements?: string[]
          responsibilities?: string[]
          sector?: string
          skills?: string[]
          status?: string
          summary?: string
          team_allowed?: boolean
          team_size?: number | null
          terms_version?: number
          title?: string
          type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          opportunity_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          opportunity_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          opportunity_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_attachments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_change_acknowledgements: {
        Row: {
          application_id: string
          created_at: string
          decision: string
          id: string
          opportunity_id: string
          responded_at: string | null
          user_id: string
          version: number
        }
        Insert: {
          application_id: string
          created_at?: string
          decision: string
          id?: string
          opportunity_id: string
          responded_at?: string | null
          user_id: string
          version: number
        }
        Update: {
          application_id?: string
          created_at?: string
          decision?: string
          id?: string
          opportunity_id?: string
          responded_at?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_change_acknowledgements_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_change_acknowledgements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          district: string | null
          id: string
          locale: string
          phone: string | null
          phone_verified: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          district?: string | null
          id: string
          locale?: string
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          district?: string | null
          id?: string
          locale?: string
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          body: string
          created_at: string
          from_user: string
          id: string
          skill: string
          to_user: string
        }
        Insert: {
          body: string
          created_at?: string
          from_user: string
          id?: string
          skill: string
          to_user: string
        }
        Update: {
          body?: string
          created_at?: string
          from_user?: string
          id?: string
          skill?: string
          to_user?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          note: string
          opportunity_id: string
          referee_worker_id: string
          referrer: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string
          opportunity_id: string
          referee_worker_id: string
          referrer: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          opportunity_id?: string
          referee_worker_id?: string
          referrer?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_worker_id_fkey"
            columns: ["referee_worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_evidence: {
        Row: {
          created_at: string
          evidence_type: string
          id: string
          metadata: Json
          occurred_at: string
          source_contract_id: string | null
          source_event_id: number | null
          source_experience_id: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          created_at?: string
          evidence_type: string
          id?: string
          metadata?: Json
          occurred_at: string
          source_contract_id?: string | null
          source_event_id?: number | null
          source_experience_id?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          created_at?: string
          evidence_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source_contract_id?: string | null
          source_event_id?: number | null
          source_experience_id?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reputation_evidence_source_contract_id_fkey"
            columns: ["source_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_evidence_source_experience_id_fkey"
            columns: ["source_experience_id"]
            isOneToOne: false
            referencedRelation: "verified_experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_opportunities: {
        Row: {
          created_at: string
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      team_districts: {
        Row: {
          created_at: string
          district: string
          team_id: string
        }
        Insert: {
          created_at?: string
          district: string
          team_id: string
        }
        Update: {
          created_at?: string
          district?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_districts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          role: string
          status: string
          team_id: string
          worker_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          status?: string
          team_id: string
          worker_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          status?: string
          team_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_removal_events: {
        Row: {
          created_at: string
          id: string
          reason: string
          removed_by: string
          team_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          removed_by: string
          team_id: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          removed_by?: string
          team_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_removal_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_removal_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          areas: string[]
          available: boolean
          avatar_url: string | null
          created_at: string
          id: string
          is_demo: boolean
          lead_user_id: string | null
          lead_worker_id: string | null
          name: string
          projects: number
          rating: number
          sector: string
          skills: string[]
          summary: string
        }
        Insert: {
          areas?: string[]
          available?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          lead_user_id?: string | null
          lead_worker_id?: string | null
          name: string
          projects?: number
          rating?: number
          sector: string
          skills?: string[]
          summary?: string
        }
        Update: {
          areas?: string[]
          available?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          lead_user_id?: string | null
          lead_worker_id?: string | null
          name?: string
          projects?: number
          rating?: number
          sector?: string
          skills?: string[]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_lead_worker_id_fkey"
            columns: ["lead_worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          created_at: string
          created_by: string
          description: string
          district: string
          id: string
          is_demo: boolean
          provider_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          district: string
          id?: string
          is_demo?: boolean
          provider_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          district?: string
          id?: string
          is_demo?: boolean
          provider_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verified_experiences: {
        Row: {
          amount_rwf: number
          approved_milestone_count: number
          business_id: string
          completed_at: string
          completion_id: string
          contract_id: string
          created_at: string
          currency: string
          end_date: string | null
          id: string
          milestone_count: number
          opportunity_id: string
          scope: string
          start_date: string | null
          team_id: string | null
          title: string
          verified_at: string
          worker_id: string | null
        }
        Insert: {
          amount_rwf: number
          approved_milestone_count?: number
          business_id: string
          completed_at: string
          completion_id: string
          contract_id: string
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          milestone_count?: number
          opportunity_id: string
          scope: string
          start_date?: string | null
          team_id?: string | null
          title: string
          verified_at?: string
          worker_id?: string | null
        }
        Update: {
          amount_rwf?: number
          approved_milestone_count?: number
          business_id?: string
          completed_at?: string
          completion_id?: string
          contract_id?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          milestone_count?: number
          opportunity_id?: string
          scope?: string
          start_date?: string | null
          team_id?: string | null
          title?: string
          verified_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verified_experiences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_experiences_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: true
            referencedRelation: "contract_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_experiences_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_experiences_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_experiences_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_experiences_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_districts: {
        Row: {
          created_at: string
          district: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          district: string
          worker_id: string
        }
        Update: {
          created_at?: string
          district?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_districts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_profiles: {
        Row: {
          available: boolean
          avatar_url: string | null
          bio: string
          created_at: string
          district: string
          id: string
          initials: string
          is_demo: boolean
          name: string
          rate_rwf: number
          rate_unit: string
          rating: number
          rep: Json
          reviews: number
          sector: string
          title: string
          user_id: string | null
          verified: boolean
          visibility: string
          years: number
        }
        Insert: {
          available?: boolean
          avatar_url?: string | null
          bio?: string
          created_at?: string
          district: string
          id?: string
          initials?: string
          is_demo?: boolean
          name: string
          rate_rwf?: number
          rate_unit?: string
          rating?: number
          rep?: Json
          reviews?: number
          sector: string
          title?: string
          user_id?: string | null
          verified?: boolean
          visibility?: string
          years?: number
        }
        Update: {
          available?: boolean
          avatar_url?: string | null
          bio?: string
          created_at?: string
          district?: string
          id?: string
          initials?: string
          is_demo?: boolean
          name?: string
          rate_rwf?: number
          rate_unit?: string
          rating?: number
          rep?: Json
          reviews?: number
          sector?: string
          title?: string
          user_id?: string | null
          verified?: boolean
          visibility?: string
          years?: number
        }
        Relationships: []
      }
      worker_skills: {
        Row: {
          id: string
          level: string
          name: string
          verification: string
          worker_id: string
        }
        Insert: {
          id?: string
          level?: string
          name: string
          verification?: string
          worker_id: string
        }
        Update: {
          id?: string
          level?: string
          name?: string
          verification?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_skills_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invitation: {
        Args: { _team_id: string; _worker_id: string }
        Returns: undefined
      }
      apply_as_actor: {
        Args: {
          _applicant_type: string
          _business_id?: string
          _note?: string
          _opportunity_id: string
          _team_id?: string
        }
        Returns: string
      }
      approve_milestone: {
        Args: { _milestone_id: string }
        Returns: Database["public"]["Enums"]["milestone_status"]
      }
      are_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      cancel_contract: {
        Args: { _contract_id: string; _note?: string }
        Returns: Database["public"]["Enums"]["contract_status"]
      }
      complete_onboarding:
        | {
            Args: {
              _business_name?: string
              _display_name: string
              _district: string
              _phone: string
              _rate_rwf?: number
              _roles: Database["public"]["Enums"]["app_role"][]
              _sector?: string
              _skills?: string[]
              _team_name?: string
              _title?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _business_name?: string
              _create_new_business?: boolean
              _create_new_team?: boolean
              _display_name: string
              _district: string
              _phone: string
              _rate_rwf?: number
              _roles: Database["public"]["Enums"]["app_role"][]
              _sector?: string
              _skills?: string[]
              _team_name?: string
              _title?: string
            }
            Returns: Json
          }
      confirm_completion: {
        Args: { _contract_id: string; _note?: string }
        Returns: Database["public"]["Enums"]["completion_status"]
      }
      confirm_opportunity_change: {
        Args: { _application_id: string; _decision: string }
        Returns: undefined
      }
      contract_counterparty_user: { Args: { _cid: string }; Returns: string }
      create_contract: {
        Args: {
          _amount_rwf: number
          _application_id: string
          _end_date?: string
          _scope: string
          _start_date?: string
          _terms?: string
          _title: string
        }
        Returns: string
      }
      create_milestone: {
        Args: {
          _amount_rwf: number
          _contract_id: string
          _description: string
          _due_date: string
          _sequence: number
          _title: string
        }
        Returns: string
      }
      delete_pending_milestone: {
        Args: { _milestone_id: string }
        Returns: undefined
      }
      dispute_milestone: {
        Args: { _milestone_id: string; _note?: string }
        Returns: Database["public"]["Enums"]["milestone_status"]
      }
      get_or_create_direct_conversation: {
        Args: {
          _opportunity_id?: string
          _other_user: string
          _subject?: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_member: {
        Args: { _bid: string; _roles?: string[] }
        Returns: boolean
      }
      is_contract_party: { Args: { _cid: string }; Returns: boolean }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id?: string }
        Returns: boolean
      }
      is_team_lead:
        | { Args: { _team_id: string; _user_id?: string }; Returns: boolean }
        | { Args: { _tid: string }; Returns: boolean }
      is_team_member: {
        Args: { _team_id: string; _user_id?: string }
        Returns: boolean
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { _notification_id: string }
        Returns: boolean
      }
      my_worker_id: { Args: never; Returns: string }
      reject_completion: {
        Args: { _contract_id: string; _note?: string }
        Returns: Database["public"]["Enums"]["completion_status"]
      }
      remove_team_member: {
        Args: { _reason: string; _team_id: string; _worker_id: string }
        Returns: undefined
      }
      request_completion: {
        Args: { _contract_id: string; _request_note?: string }
        Returns: string
      }
      respond_contract: {
        Args: { _accept: boolean; _contract_id: string; _note?: string }
        Returns: Database["public"]["Enums"]["contract_status"]
      }
      respond_to_opportunity_change: {
        Args: { _accept: boolean; _application_id: string }
        Returns: boolean
      }
      submit_milestone: {
        Args: { _milestone_id: string; _submission_note?: string }
        Returns: Database["public"]["Enums"]["milestone_status"]
      }
      update_pending_milestone: {
        Args: {
          _amount_rwf: number
          _description: string
          _due_date: string
          _milestone_id: string
          _sequence: number
          _title: string
        }
        Returns: undefined
      }
      withdraw_completion_request: {
        Args: { _contract_id: string; _note?: string }
        Returns: Database["public"]["Enums"]["completion_status"]
      }
      worker_network_count: { Args: { _worker_id: string }; Returns: number }
    }
    Enums: {
      app_role:
        | "worker"
        | "team_lead"
        | "business"
        | "learner"
        | "admin"
        | "institution"
      application_status:
        | "submitted"
        | "viewed"
        | "shortlisted"
        | "rejected"
        | "accepted"
        | "withdrawn"
      completion_status: "requested" | "rejected" | "confirmed" | "withdrawn"
      contract_status:
        | "proposed"
        | "active"
        | "declined"
        | "cancelled"
        | "completed"
      milestone_status: "pending" | "submitted" | "disputed" | "approved"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "worker",
        "team_lead",
        "business",
        "learner",
        "admin",
        "institution",
      ],
      application_status: [
        "submitted",
        "viewed",
        "shortlisted",
        "rejected",
        "accepted",
        "withdrawn",
      ],
      completion_status: ["requested", "rejected", "confirmed", "withdrawn"],
      contract_status: [
        "proposed",
        "active",
        "declined",
        "cancelled",
        "completed",
      ],
      milestone_status: ["pending", "submitted", "disputed", "approved"],
    },
  },
} as const
