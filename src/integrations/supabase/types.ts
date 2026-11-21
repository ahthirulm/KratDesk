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
      app_errors: {
        Row: {
          created_at: string
          detail: string
          id: string
          message: string
          source: string
          url: string
          user_agent: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          message: string
          source?: string
          url?: string
          user_agent?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          message?: string
          source?: string
          url?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          branch_id: string | null
          category: string
          created_at: string
          description: string
          id: string
          record_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          branch_id?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          record_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          branch_id?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          record_id?: string | null
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          error: string | null
          id: string
          recipients: string[]
          records: number
          size_bytes: number
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          error?: string | null
          id?: string
          recipients?: string[]
          records?: number
          size_bytes?: number
          started_at?: string
          status: string
          trigger?: string
        }
        Update: {
          error?: string | null
          id?: string
          recipients?: string[]
          records?: number
          size_bytes?: number
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: []
      }
      backup_schedule: {
        Row: {
          api_key: string
          domain_status: string
          email_domain: string
          enabled: boolean
          encrypt: boolean
          encrypt_password: string
          every_days: number
          from_email: string
          from_name: string
          id: number
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          next_run_at: string | null
          recipients: string[]
          resend_domain_id: string | null
          run_hour: number
          updated_at: string
        }
        Insert: {
          api_key?: string
          domain_status?: string
          email_domain?: string
          enabled?: boolean
          encrypt?: boolean
          encrypt_password?: string
          every_days?: number
          from_email?: string
          from_name?: string
          id?: number
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          next_run_at?: string | null
          recipients?: string[]
          resend_domain_id?: string | null
          run_hour?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          domain_status?: string
          email_domain?: string
          enabled?: boolean
          encrypt?: boolean
          encrypt_password?: string
          every_days?: number
          from_email?: string
          from_name?: string
          id?: number
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          next_run_at?: string | null
          recipients?: string[]
          resend_domain_id?: string | null
          run_hour?: number
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          active: boolean
          address: string
          code: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          active?: boolean
          address?: string
          code: string
          id: string
          name: string
          phone?: string
        }
        Update: {
          active?: boolean
          address?: string
          code?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      capital_movements: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          created_by: string
          date: string
          id: string
          kind: string
          note: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          created_by: string
          date: string
          id?: string
          kind: string
          note?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          kind?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      cheque_reminders: {
        Row: {
          amount: number
          branch_id: string
          cheque_date: string
          cheque_number: string
          created_at: string
          created_by: string
          deposited_at: string | null
          deposited_by: string | null
          id: string
          payment_id: string | null
          sale_id: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          cheque_date: string
          cheque_number: string
          created_at?: string
          created_by: string
          deposited_at?: string | null
          deposited_by?: string | null
          id?: string
          payment_id?: string | null
          sale_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          cheque_date?: string
          cheque_number?: string
          created_at?: string
          created_by?: string
          deposited_at?: string | null
          deposited_by?: string | null
          id?: string
          payment_id?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cheque_reminders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheque_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "loan_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheque_reminders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      daily_rates: {
        Row: {
          date: string
          metal_id: string
          rate_per_gram: number
        }
        Insert: {
          date: string
          metal_id: string
          rate_per_gram: number
        }
        Update: {
          date?: string
          metal_id?: string
          rate_per_gram?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_rates_metal_id_fkey"
            columns: ["metal_id"]
            isOneToOne: false
            referencedRelation: "metal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_staff: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          note: string
          payee_type: string
          phone: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          note?: string
          payee_type?: string
          phone?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string
          payee_type?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_accounts: {
        Row: {
          balance: number
          branch_id: string
          cost_lkr: number
          currency: string
        }
        Insert: {
          balance?: number
          branch_id: string
          cost_lkr?: number
          currency: string
        }
        Update: {
          balance?: number
          branch_id?: string
          cost_lkr?: number
          currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_currencies: {
        Row: {
          active: boolean
          code: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      fx_entries: {
        Row: {
          amount: number
          branch_id: string
          cost_lkr: number
          counterparty: string
          created_at: string
          created_by: string
          currency: string
          date: string
          id: string
          kind: string
          lkr_total: number
          note: string
          profit_lkr: number
          rate: number
          reference: string
        }
        Insert: {
          amount: number
          branch_id: string
          cost_lkr?: number
          counterparty?: string
          created_at?: string
          created_by: string
          currency: string
          date?: string
          id?: string
          kind: string
          lkr_total: number
          note?: string
          profit_lkr?: number
          rate: number
          reference?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          cost_lkr?: number
          counterparty?: string
          created_at?: string
          created_by?: string
          currency?: string
          date?: string
          id?: string
          kind?: string
          lkr_total?: number
          note?: string
          profit_lkr?: number
          rate?: number
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      item_costs: {
        Row: {
          item_id: string
          purchase_price: number
        }
        Insert: {
          item_id: string
          purchase_price: number
        }
        Update: {
          item_id?: string
          purchase_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_costs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          branch_id: string
          category: string
          created_at: string | null
          id: string
          metal_id: string
          name: string
          photo_url: string | null
          sold_invoice: string | null
          status: string
          supplier: string | null
          system_tag: string
          tag_id: string
          weight: number
        }
        Insert: {
          branch_id?: string
          category?: string
          created_at?: string | null
          id?: string
          metal_id: string
          name: string
          photo_url?: string | null
          sold_invoice?: string | null
          status?: string
          supplier?: string | null
          system_tag?: string
          tag_id?: string
          weight: number
        }
        Update: {
          branch_id?: string
          category?: string
          created_at?: string | null
          id?: string
          metal_id?: string
          name?: string
          photo_url?: string | null
          sold_invoice?: string | null
          status?: string
          supplier?: string | null
          system_tag?: string
          tag_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_metal_id_fkey"
            columns: ["metal_id"]
            isOneToOne: false
            referencedRelation: "metal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      job_types: {
        Row: {
          name: string
          sort: number
        }
        Insert: {
          name: string
          sort?: number
        }
        Update: {
          name?: string
          sort?: number
        }
        Relationships: []
      }
      kd_account_contacts: {
        Row: {
          email: string
          invited_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          email: string
          invited_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          email?: string
          invited_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      kd_account_links: {
        Row: {
          email: string
          expires_at: string
          token_digest: string
          used: boolean
          user_id: string
        }
        Insert: {
          email: string
          expires_at: string
          token_digest: string
          used?: boolean
          user_id: string
        }
        Update: {
          email?: string
          expires_at?: string
          token_digest?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      kd_gold_fetch_history: {
        Row: {
          fetched_at: string
          id: number
          prices: Json
          source_date: string
        }
        Insert: {
          fetched_at?: string
          id?: never
          prices: Json
          source_date: string
        }
        Update: {
          fetched_at?: string
          id?: never
          prices?: Json
          source_date?: string
        }
        Relationships: []
      }
      kd_gold_settings: {
        Row: {
          enabled: boolean
          id: number
          last_error: string | null
          last_fetch: string | null
          last_success: string | null
          lease_until: string | null
          prices: Json | null
          source_date: string | null
        }
        Insert: {
          enabled?: boolean
          id?: number
          last_error?: string | null
          last_fetch?: string | null
          last_success?: string | null
          lease_until?: string | null
          prices?: Json | null
          source_date?: string | null
        }
        Update: {
          enabled?: boolean
          id?: number
          last_error?: string | null
          last_fetch?: string | null
          last_success?: string | null
          lease_until?: string | null
          prices?: Json | null
          source_date?: string | null
        }
        Relationships: []
      }
      kd_rate_history: {
        Row: {
          applied_by: string | null
          changed_at: string
          id: number
          metal_id: string
          new_pawn: number
          old_pawn: number | null
          rate_date: string
          source: string
          source_date: string | null
        }
        Insert: {
          applied_by?: string | null
          changed_at?: string
          id?: never
          metal_id: string
          new_pawn: number
          old_pawn?: number | null
          rate_date: string
          source: string
          source_date?: string | null
        }
        Update: {
          applied_by?: string | null
          changed_at?: string
          id?: never
          metal_id?: string
          new_pawn?: number
          old_pawn?: number | null
          rate_date?: string
          source?: string
          source_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kd_rate_history_metal_id_fkey"
            columns: ["metal_id"]
            isOneToOne: false
            referencedRelation: "metal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      kd_request_limits: {
        Row: {
          count: number
          expires_at: string
          key: string
        }
        Insert: {
          count: number
          expires_at: string
          key: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
        }
        Relationships: []
      }
      loan_installments: {
        Row: {
          amount: number
          due_date: string
          id: string
          installment_no: number
          loan_id: string
        }
        Insert: {
          amount: number
          due_date: string
          id?: string
          installment_no: number
          loan_id: string
        }
        Update: {
          amount?: number
          due_date?: string
          id?: string
          installment_no?: number
          loan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          amount: number
          branch_id: string
          date: string | null
          id: string
          loan_id: string
          method: string
          receipt_no: string | null
          received_by: string
        }
        Insert: {
          amount: number
          branch_id?: string
          date?: string | null
          id?: string
          loan_id: string
          method: string
          receipt_no?: string | null
          received_by: string
        }
        Update: {
          amount?: number
          branch_id?: string
          date?: string | null
          id?: string
          loan_id?: string
          method?: string
          receipt_no?: string | null
          received_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_term_revisions: {
        Row: {
          created_at: string
          created_by: string
          first_due: string
          frequency: string
          id: string
          installment_count: number
          loan_id: string
          paid_at_revision: number
          schedule: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          first_due: string
          frequency: string
          id?: string
          installment_count: number
          loan_id: string
          paid_at_revision: number
          schedule: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          first_due?: string
          frequency?: string
          id?: string
          installment_count?: number
          loan_id?: string
          paid_at_revision?: number
          schedule?: Json
        }
        Relationships: [
          {
            foreignKeyName: "loan_term_revisions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          amount: number
          branch_id: string
          created_at: string | null
          customer_id: string
          frequency: string
          id: string
          loan_no: string
          sale_id: string
          status: string | null
        }
        Insert: {
          amount: number
          branch_id?: string
          created_at?: string | null
          customer_id: string
          frequency: string
          id?: string
          loan_no?: string
          sale_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string | null
          customer_id?: string
          frequency?: string
          id?: string
          loan_no?: string
          sale_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      metal_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      old_gold_accounts: {
        Row: {
          branch_id: string
          cost_lkr: number
          purity: number
          weight: number
        }
        Insert: {
          branch_id: string
          cost_lkr?: number
          purity: number
          weight?: number
        }
        Update: {
          branch_id?: string
          cost_lkr?: number
          purity?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "old_gold_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      old_gold_entries: {
        Row: {
          branch_id: string
          cost_lkr: number
          created_at: string
          created_by: string
          customer_name: string
          customer_phone: string
          date: string
          id: string
          kind: string
          method: string
          note: string
          pricing_unit: string
          profit_lkr: number
          purity: number
          reference: string
          total_lkr: number
          unit_price: number
          weight: number
        }
        Insert: {
          branch_id: string
          cost_lkr: number
          created_at?: string
          created_by: string
          customer_name?: string
          customer_phone?: string
          date?: string
          id?: string
          kind: string
          method: string
          note?: string
          pricing_unit: string
          profit_lkr: number
          purity: number
          reference?: string
          total_lkr: number
          unit_price: number
          weight: number
        }
        Update: {
          branch_id?: string
          cost_lkr?: number
          created_at?: string
          created_by?: string
          customer_name?: string
          customer_phone?: string
          date?: string
          id?: string
          kind?: string
          method?: string
          note?: string
          pricing_unit?: string
          profit_lkr?: number
          purity?: number
          reference?: string
          total_lkr?: number
          unit_price?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "old_gold_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      old_gold_movements: {
        Row: {
          cost_lkr: number
          created_at: string
          created_by: string
          from_branch: string
          id: string
          note: string
          purity: number
          to_branch: string
          weight: number
        }
        Insert: {
          cost_lkr: number
          created_at?: string
          created_by: string
          from_branch: string
          id?: string
          note?: string
          purity: number
          to_branch: string
          weight: number
        }
        Update: {
          cost_lkr?: number
          created_at?: string
          created_by?: string
          from_branch?: string
          id?: string
          note?: string
          purity?: number
          to_branch?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "old_gold_movements_from_branch_fkey"
            columns: ["from_branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "old_gold_movements_to_branch_fkey"
            columns: ["to_branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_requests: {
        Row: {
          actor_id: string
          created_at: string
          kind: string
          payload_hash: string
          request_id: string
          result_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          kind: string
          payload_hash: string
          request_id: string
          result_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          kind?: string
          payload_hash?: string
          request_id?: string
          result_id?: string | null
        }
        Relationships: []
      }
      petty_cash_categories: {
        Row: {
          branch_id: string
          id: string
          name: string
          requires_month: boolean
          requires_staff: boolean
        }
        Insert: {
          branch_id: string
          id?: string
          name: string
          requires_month?: boolean
          requires_staff?: boolean
        }
        Update: {
          branch_id?: string
          id?: string
          name?: string
          requires_month?: boolean
          requires_staff?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_entries: {
        Row: {
          amount: number
          branch_id: string
          category: string
          category_id: string | null
          created_at: string
          created_by: string
          date: string
          description: string
          expense_month: string | null
          id: string
          kind: string
          reference: string
          staff_id: string | null
          staff_name: string | null
          staff_type: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          category: string
          category_id?: string | null
          created_at?: string
          created_by: string
          date?: string
          description: string
          expense_month?: string | null
          id?: string
          kind: string
          reference?: string
          staff_id?: string | null
          staff_name?: string | null
          staff_type?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          expense_month?: string | null
          id?: string
          kind?: string
          reference?: string
          staff_id?: string | null
          staff_name?: string | null
          staff_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "expense_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          display_name: string
          id: string
          mfa_enabled: boolean
          phone: string
          two_factor_required: boolean
          username: string | null
        }
        Insert: {
          avatar_path?: string | null
          display_name?: string
          id: string
          mfa_enabled?: boolean
          phone?: string
          two_factor_required?: boolean
          username?: string | null
        }
        Update: {
          avatar_path?: string | null
          display_name?: string
          id?: string
          mfa_enabled?: boolean
          phone?: string
          two_factor_required?: boolean
          username?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          done_at: string | null
          done_by: string | null
          id: string
          note: string
          remind_date: string
          title: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          note?: string
          remind_date: string
          title: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          note?: string
          remind_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_job_events: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          created_by: string
          date: string
          id: string
          job_id: string
          kind: string
        }
        Insert: {
          amount?: number
          branch_id: string
          created_at?: string
          created_by: string
          date?: string
          id?: string
          job_id: string
          kind: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          job_id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_job_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "repair_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_jobs: {
        Row: {
          branch_id: string
          charge: number
          collected: number
          cost_paid: number
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_date: string | null
          est_delivery: string
          id: string
          issue: string
          item: string
          job_no: string
          job_type: string
          note: string
          photo_path: string | null
          received_date: string
          repair_cost: number
          repairer_id: string | null
          repairer_name: string
          status: string
          weight: number | null
        }
        Insert: {
          branch_id: string
          charge?: number
          collected?: number
          cost_paid?: number
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string
          delivered_date?: string | null
          est_delivery: string
          id?: string
          issue?: string
          item: string
          job_no?: string
          job_type?: string
          note?: string
          photo_path?: string | null
          received_date?: string
          repair_cost?: number
          repairer_id?: string | null
          repairer_name?: string
          status?: string
          weight?: number | null
        }
        Update: {
          branch_id?: string
          charge?: number
          collected?: number
          cost_paid?: number
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_date?: string | null
          est_delivery?: string
          id?: string
          issue?: string
          item?: string
          job_no?: string
          job_type?: string
          note?: string
          photo_path?: string | null
          received_date?: string
          repair_cost?: number
          repairer_id?: string | null
          repairer_name?: string
          status?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_jobs_repairer_id_fkey"
            columns: ["repairer_id"]
            isOneToOne: false
            referencedRelation: "expense_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_costs: {
        Row: {
          purchase_cost: number
          sale_item_id: string
        }
        Insert: {
          purchase_cost: number
          sale_item_id: string
        }
        Update: {
          purchase_cost?: number
          sale_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_costs_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: true
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          calculated_price: number
          final_price: number
          id: string
          item_id: string
          metal: string
          name: string
          pricing_unit: string | null
          rate_used: number
          sale_id: string
          tag_id: string
          unit_price: number | null
          weight: number
        }
        Insert: {
          calculated_price: number
          final_price: number
          id?: string
          item_id: string
          metal: string
          name: string
          pricing_unit?: string | null
          rate_used: number
          sale_id: string
          tag_id: string
          unit_price?: number | null
          weight: number
        }
        Update: {
          calculated_price?: number
          final_price?: number
          id?: string
          item_id?: string
          metal?: string
          name?: string
          pricing_unit?: string | null
          rate_used?: number
          sale_id?: string
          tag_id?: string
          unit_price?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_reversal_items: {
        Row: {
          amount: number
          calculated_amount: number
          id: string
          item_id: string
          purchase_cost: number
          reversal_id: string
          sale_item_id: string
        }
        Insert: {
          amount: number
          calculated_amount: number
          id?: string
          item_id: string
          purchase_cost?: number
          reversal_id: string
          sale_item_id: string
        }
        Update: {
          amount?: number
          calculated_amount?: number
          id?: string
          item_id?: string
          purchase_cost?: number
          reversal_id?: string
          sale_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_reversal_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_reversal_items_reversal_id_fkey"
            columns: ["reversal_id"]
            isOneToOne: false
            referencedRelation: "sale_reversals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_reversal_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: true
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_reversals: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          credit_reduction: number
          id: string
          kind: string
          loan_reduction: number
          paid_reduction: number
          payment_refund: number
          reason: string
          refund_amount: number
          refund_method: string
          sale_id: string
          total_amount: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          credit_reduction: number
          id?: string
          kind: string
          loan_reduction: number
          paid_reduction: number
          payment_refund: number
          reason: string
          refund_amount: number
          refund_method: string
          sale_id: string
          total_amount: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          credit_reduction?: number
          id?: string
          kind?: string
          loan_reduction?: number
          paid_reduction?: number
          payment_refund?: number
          reason?: string
          refund_amount?: number
          refund_method?: string
          sale_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_reversals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_reversals_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          calculated_total: number
          created_at: string | null
          created_by: string
          customer_id: string | null
          date: string | null
          final_total: number
          id: string
          invoice_no: string
          loan_amount: number
          paid_now: number
          payment_method: string
          payment_split: Json | null
          payment_type: string
        }
        Insert: {
          branch_id?: string
          calculated_total: number
          created_at?: string | null
          created_by: string
          customer_id?: string | null
          date?: string | null
          final_total: number
          id?: string
          invoice_no?: string
          loan_amount: number
          paid_now: number
          payment_method: string
          payment_split?: Json | null
          payment_type: string
        }
        Update: {
          branch_id?: string
          calculated_total?: number
          created_at?: string | null
          created_by?: string
          customer_id?: string | null
          date?: string | null
          final_total?: number
          id?: string
          invoice_no?: string
          loan_amount?: number
          paid_now?: number
          payment_method?: string
          payment_split?: Json | null
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string | null
          country: string
          currency: string | null
          id: boolean
          inactivity_minutes: number
          phone: string | null
          pricing_unit: string
          print_footer: string
          print_header: string
          print_logo: string | null
          print_paper: string
          print_show_address: boolean
          print_show_customer_phone: boolean
          print_show_phone: boolean
          shop_name: string
        }
        Insert: {
          address?: string | null
          country?: string
          currency?: string | null
          id?: boolean
          inactivity_minutes?: number
          phone?: string | null
          pricing_unit?: string
          print_footer?: string
          print_header?: string
          print_logo?: string | null
          print_paper?: string
          print_show_address?: boolean
          print_show_customer_phone?: boolean
          print_show_phone?: boolean
          shop_name?: string
        }
        Update: {
          address?: string | null
          country?: string
          currency?: string | null
          id?: boolean
          inactivity_minutes?: number
          phone?: string | null
          pricing_unit?: string
          print_footer?: string
          print_header?: string
          print_logo?: string | null
          print_paper?: string
          print_show_address?: boolean
          print_show_customer_phone?: boolean
          print_show_phone?: boolean
          shop_name?: string
        }
        Relationships: []
      }
      staff_access: {
        Row: {
          active: boolean
          branch_ids: string[]
          role_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          branch_ids?: string[]
          role_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          branch_ids?: string[]
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          id: string
          name: string
          permissions: string[]
        }
        Insert: {
          id?: string
          name: string
          permissions?: string[]
        }
        Update: {
          id?: string
          name?: string
          permissions?: string[]
        }
        Relationships: []
      }
      stock_categories: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          from_branch: string
          id: string
          internal_tag: string
          item_id: string
          note: string
          performed_by: string
          system_tag: string
          to_branch: string
        }
        Insert: {
          created_at?: string
          from_branch: string
          id?: string
          internal_tag: string
          item_id: string
          note?: string
          performed_by: string
          system_tag: string
          to_branch: string
        }
        Update: {
          created_at?: string
          from_branch?: string
          id?: string
          internal_tag?: string
          item_id?: string
          note?: string
          performed_by?: string
          system_tag?: string
          to_branch?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_from_branch_fkey"
            columns: ["from_branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_to_branch_fkey"
            columns: ["to_branch"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string
          contact_person: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          active?: boolean
          address?: string
          contact_person?: string
          id?: string
          name: string
          phone?: string
        }
        Update: {
          active?: boolean
          address?: string
          contact_person?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_expense_staff: { Args: { p: Json }; Returns: string }
      add_reminder: { Args: { p: Json }; Returns: string }
      adjust_loan_terms: { Args: { p: Json }; Returns: string }
      branch_cash_change: {
        Args: { p_amount: number; p_branch: string }
        Returns: undefined
      }
      change_petty_expense: { Args: { p: Json }; Returns: string }
      complete_owner_setup: {
        Args: {
          p_owner_name: string
          p_shop_name: string
          p_user_id: string
          p_username: string
        }
        Returns: undefined
      }
      complete_reminder: { Args: { rid: string }; Returns: undefined }
      complete_sale: { Args: { p: Json }; Returns: string }
      delete_item: { Args: { iid: string }; Returns: undefined }
      delete_reminder: { Args: { rid: string }; Returns: undefined }
      delete_sale: { Args: { sid: string }; Returns: undefined }
      deposit_cheque: { Args: { cid: string }; Returns: undefined }
      factory_reset: { Args: { p: Json }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      internal_complete_sale: { Args: { p: Json }; Returns: string }
      internal_record_payment: { Args: { p: Json }; Returns: string }
      internal_save_item: { Args: { p: Json }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      kd_apply_gold_rates: { Args: never; Returns: boolean }
      kd_gold_fetch_failed: { Args: { p_message: string }; Returns: undefined }
      kd_preview_system_tag: { Args: never; Returns: string }
      kd_refresh_gold_rates: { Args: never; Returns: boolean }
      kd_rename_item_tag: {
        Args: { p_id: string; p_tag: string }
        Returns: undefined
      }
      kd_restore_records: {
        Args: { p_aal: string; p_actor: string; p_plans: Json }
        Returns: number
      }
      kd_store_gold_quote: {
        Args: { p_date: string; p_prices: Json }
        Returns: undefined
      }
      kd_take_limit: {
        Args: { p_key: string; p_limit: number; p_seconds: number }
        Returns: boolean
      }
      log_security_action: {
        Args: { p_action: string; p_user_id: string }
        Returns: undefined
      }
      login_access: { Args: never; Returns: boolean }
      manage_fx_currency: { Args: { p: Json }; Returns: string }
      manage_job_type: {
        Args: { new_name: string; old_name: string }
        Returns: undefined
      }
      manage_metal: { Args: { p: Json }; Returns: string }
      manage_petty_cash_category: { Args: { p: Json }; Returns: string }
      manage_stock_category: {
        Args: { new_name: string; old_name: string }
        Returns: undefined
      }
      mfa_satisfied: { Args: never; Returns: boolean }
      operation_begin: { Args: { kind: string; p: Json }; Returns: string }
      operation_finish: {
        Args: { kind: string; p: Json; result: string }
        Returns: undefined
      }
      owner_cash_allowed: { Args: { target_branch: string }; Returns: boolean }
      record_capital_movement: { Args: { p: Json }; Returns: string }
      record_fx_entry: { Args: { p: Json }; Returns: string }
      record_old_gold: { Args: { p: Json }; Returns: string }
      record_payment: { Args: { p: Json }; Returns: string }
      record_petty_cash: { Args: { p: Json }; Returns: string }
      repair_job_action: { Args: { p: Json }; Returns: string }
      reverse_sale: { Args: { p: Json }; Returns: string }
      save_branch: { Args: { p: Json }; Returns: undefined }
      save_customer: { Args: { p: Json }; Returns: string }
      save_item: { Args: { p: Json }; Returns: string }
      save_staff_access: { Args: { p: Json }; Returns: undefined }
      save_staff_role: { Args: { p: Json }; Returns: string }
      save_supplier: { Args: { p: Json }; Returns: string }
      set_administrator: {
        Args: { p_enabled: boolean; p_user_id: string }
        Returns: undefined
      }
      set_profile_mfa: { Args: { enabled: boolean }; Returns: undefined }
      set_staff_role: {
        Args: { new_role: Database["public"]["Enums"]["app_role"]; uid: string }
        Returns: undefined
      }
      set_staff_two_factor: {
        Args: { p_required: boolean; p_user_id: string }
        Returns: undefined
      }
      setup_owner: { Args: never; Returns: undefined }
      shop_public_details: { Args: never; Returns: Json }
      staff_can: {
        Args: { permission: string; target_branch?: string }
        Returns: boolean
      }
      sync_shop_sequences: { Args: never; Returns: undefined }
      system_health: { Args: never; Returns: Json }
      transfer_old_gold: { Args: { p: Json }; Returns: string }
      transfer_stock: { Args: { p: Json }; Returns: string }
      update_reminder: { Args: { p: Json }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "cashier" | "administrator"
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
      app_role: ["admin", "cashier", "administrator"],
    },
  },
} as const
