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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          created_at: string
          created_by: string | null
          critical_threshold: number | null
          direction: Database["public"]["Enums"]["fidc_threshold_direction"]
          display_name: string
          fidc_id: string | null
          id: string
          is_active: boolean
          metric_name: string
          portfolio_source: string | null
          scope: Database["public"]["Enums"]["fidc_threshold_scope"]
          updated_at: string
          warning_threshold: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          critical_threshold?: number | null
          direction: Database["public"]["Enums"]["fidc_threshold_direction"]
          display_name: string
          fidc_id?: string | null
          id?: string
          is_active?: boolean
          metric_name: string
          portfolio_source?: string | null
          scope?: Database["public"]["Enums"]["fidc_threshold_scope"]
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          critical_threshold?: number | null
          direction?: Database["public"]["Enums"]["fidc_threshold_direction"]
          display_name?: string
          fidc_id?: string | null
          id?: string
          is_active?: boolean
          metric_name?: string
          portfolio_source?: string | null
          scope?: Database["public"]["Enums"]["fidc_threshold_scope"]
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_fidc_id_fkey"
            columns: ["fidc_id"]
            isOneToOne: false
            referencedRelation: "fidcs"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          comment: string | null
          created_at: string
          current_value: number | null
          fidc_id: string
          id: string
          metric_name: string
          portfolio_source: string | null
          reference_month: string | null
          severity: Database["public"]["Enums"]["fidc_alert_severity"]
          status: Database["public"]["Enums"]["fidc_alert_status"]
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          current_value?: number | null
          fidc_id: string
          id?: string
          metric_name: string
          portfolio_source?: string | null
          reference_month?: string | null
          severity: Database["public"]["Enums"]["fidc_alert_severity"]
          status?: Database["public"]["Enums"]["fidc_alert_status"]
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          current_value?: number | null
          fidc_id?: string
          id?: string
          metric_name?: string
          portfolio_source?: string | null
          reference_month?: string | null
          severity?: Database["public"]["Enums"]["fidc_alert_severity"]
          status?: Database["public"]["Enums"]["fidc_alert_status"]
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_fidc_id_fkey"
            columns: ["fidc_id"]
            isOneToOne: false
            referencedRelation: "fidcs"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_limits: {
        Row: {
          categoria: string
          created_at: string
          fundo: string
          id: string
          limite_pct: number | null
          subcategoria: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          fundo: string
          id?: string
          limite_pct?: number | null
          subcategoria: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          fundo?: string
          id?: string
          limite_pct?: number | null
          subcategoria?: string
          updated_at?: string
        }
        Relationships: []
      }
      allocation_target_periods: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          fundo: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          fundo: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          fundo?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      allocation_targets: {
        Row: {
          created_at: string
          fundo: string
          id: string
          limite_pct: number | null
          period_id: string | null
          target_pct: number | null
          tipo_ativo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          fundo: string
          id?: string
          limite_pct?: number | null
          period_id?: string | null
          target_pct?: number | null
          tipo_ativo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          fundo?: string
          id?: string
          limite_pct?: number | null
          period_id?: string | null
          target_pct?: number | null
          tipo_ativo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_targets_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "allocation_target_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_targets_emissor: {
        Row: {
          cnpj_emissor: string
          created_at: string
          fundo: string
          id: string
          period_id: string
          target_pct: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cnpj_emissor: string
          created_at?: string
          fundo: string
          id?: string
          period_id: string
          target_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cnpj_emissor?: string
          created_at?: string
          fundo?: string
          id?: string
          period_id?: string
          target_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_targets_emissor_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "allocation_target_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_targets_setor: {
        Row: {
          created_at: string
          fundo: string
          id: string
          limite_pct: number | null
          period_id: string
          setor: string
          target_pct: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          fundo: string
          id?: string
          limite_pct?: number | null
          period_id: string
          setor: string
          target_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          fundo?: string
          id?: string
          limite_pct?: number | null
          period_id?: string
          setor?: string
          target_pct?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_targets_setor_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "allocation_target_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      analises: {
        Row: {
          analista_responsavel: string
          analista_secundario: string | null
          aprovado_por: string | null
          conviccao: string | null
          created_at: string
          data_alvo: string | null
          data_aprovacao: string | null
          data_comite: string | null
          data_conclusao: string | null
          data_inicio: string
          decisao: string | null
          empresa_id: string
          gatilhos: string | null
          id: string
          isin: string | null
          justificativa: string | null
          justificativa_rejeicao: string | null
          link_analise: string | null
          observacoes: string | null
          prazo: string | null
          preco_maximo: number | null
          preco_medio: number | null
          preco_min: number | null
          recomendacao: string | null
          recomendacao_rf: string | null
          relatorio: string | null
          riscos: string | null
          solicitante_id: string | null
          status: string
          tipo: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          analista_responsavel: string
          analista_secundario?: string | null
          aprovado_por?: string | null
          conviccao?: string | null
          created_at?: string
          data_alvo?: string | null
          data_aprovacao?: string | null
          data_comite?: string | null
          data_conclusao?: string | null
          data_inicio: string
          decisao?: string | null
          empresa_id: string
          gatilhos?: string | null
          id?: string
          isin?: string | null
          justificativa?: string | null
          justificativa_rejeicao?: string | null
          link_analise?: string | null
          observacoes?: string | null
          prazo?: string | null
          preco_maximo?: number | null
          preco_medio?: number | null
          preco_min?: number | null
          recomendacao?: string | null
          recomendacao_rf?: string | null
          relatorio?: string | null
          riscos?: string | null
          solicitante_id?: string | null
          status: string
          tipo?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          analista_responsavel?: string
          analista_secundario?: string | null
          aprovado_por?: string | null
          conviccao?: string | null
          created_at?: string
          data_alvo?: string | null
          data_aprovacao?: string | null
          data_comite?: string | null
          data_conclusao?: string | null
          data_inicio?: string
          decisao?: string | null
          empresa_id?: string
          gatilhos?: string | null
          id?: string
          isin?: string | null
          justificativa?: string | null
          justificativa_rejeicao?: string | null
          link_analise?: string | null
          observacoes?: string | null
          prazo?: string | null
          preco_maximo?: number | null
          preco_medio?: number | null
          preco_min?: number | null
          recomendacao?: string | null
          recomendacao_rf?: string | null
          relatorio?: string | null
          riscos?: string | null
          solicitante_id?: string | null
          status?: string
          tipo?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      assembleia_participacoes: {
        Row: {
          assembleia_id: string
          created_at: string
          created_by: string | null
          fundo: string
          id: string
          isin: string | null
          observacoes: string | null
          representante: string | null
          voto: string | null
        }
        Insert: {
          assembleia_id: string
          created_at?: string
          created_by?: string | null
          fundo: string
          id?: string
          isin?: string | null
          observacoes?: string | null
          representante?: string | null
          voto?: string | null
        }
        Update: {
          assembleia_id?: string
          created_at?: string
          created_by?: string | null
          fundo?: string
          id?: string
          isin?: string | null
          observacoes?: string | null
          representante?: string | null
          voto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_participacoes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_upload_log: {
        Row: {
          com_posicao: number | null
          duplicadas: number | null
          filename: string | null
          id: string
          novas: number | null
          pendente_vinculo: number | null
          sem_posicao: number | null
          total_linhas: number | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          com_posicao?: number | null
          duplicadas?: number | null
          filename?: string | null
          id?: string
          novas?: number | null
          pendente_vinculo?: number | null
          sem_posicao?: number | null
          total_linhas?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          com_posicao?: number | null
          duplicadas?: number | null
          filename?: string | null
          id?: string
          novas?: number | null
          pendente_vinculo?: number | null
          sem_posicao?: number | null
          total_linhas?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      assembleias: {
        Row: {
          cnpj_emissor: string | null
          cnpj_empresa: string | null
          created_at: string
          data_assembleia: string | null
          data_evento: string
          data_limite_voto: string | null
          descricao: string | null
          documentos: Json
          hora_evento: string | null
          id: string
          isin: string | null
          isins_vinculados: string[] | null
          justificativa_voto: string | null
          local_link: string | null
          modalidade: string | null
          observacoes: string | null
          origem: string | null
          quorum_atingido: boolean | null
          responsavel_id: string | null
          resultado: string | null
          status: string
          ticker: string | null
          tipo: string
          titulo: string
          triagem: string | null
          updated_at: string
          url_b3: string | null
          voto_butia: string | null
        }
        Insert: {
          cnpj_emissor?: string | null
          cnpj_empresa?: string | null
          created_at?: string
          data_assembleia?: string | null
          data_evento: string
          data_limite_voto?: string | null
          descricao?: string | null
          documentos?: Json
          hora_evento?: string | null
          id?: string
          isin?: string | null
          isins_vinculados?: string[] | null
          justificativa_voto?: string | null
          local_link?: string | null
          modalidade?: string | null
          observacoes?: string | null
          origem?: string | null
          quorum_atingido?: boolean | null
          responsavel_id?: string | null
          resultado?: string | null
          status?: string
          ticker?: string | null
          tipo: string
          titulo: string
          triagem?: string | null
          updated_at?: string
          url_b3?: string | null
          voto_butia?: string | null
        }
        Update: {
          cnpj_emissor?: string | null
          cnpj_empresa?: string | null
          created_at?: string
          data_assembleia?: string | null
          data_evento?: string
          data_limite_voto?: string | null
          descricao?: string | null
          documentos?: Json
          hora_evento?: string | null
          id?: string
          isin?: string | null
          isins_vinculados?: string[] | null
          justificativa_voto?: string | null
          local_link?: string | null
          modalidade?: string | null
          observacoes?: string | null
          origem?: string | null
          quorum_atingido?: boolean | null
          responsavel_id?: string | null
          resultado?: string | null
          status?: string
          ticker?: string | null
          tipo?: string
          titulo?: string
          triagem?: string | null
          updated_at?: string
          url_b3?: string | null
          voto_butia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleias_cnpj_empresa_fkey"
            columns: ["cnpj_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["cnpj"]
          },
          {
            foreignKeyName: "assembleias_isin_fkey"
            columns: ["isin"]
            isOneToOne: false
            referencedRelation: "emissoes"
            referencedColumns: ["isin"]
          },
        ]
      }
      credit_opinions: {
        Row: {
          attention_points: string | null
          author_id: string | null
          created_at: string
          fidc_id: string
          id: string
          main_risks: string | null
          positive_points: string | null
          recent_evolution: string | null
          recommendation: Database["public"]["Enums"]["fidc_recommendation"]
          recommendation_reason: string | null
          reference_month: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          attention_points?: string | null
          author_id?: string | null
          created_at?: string
          fidc_id: string
          id?: string
          main_risks?: string | null
          positive_points?: string | null
          recent_evolution?: string | null
          recommendation: Database["public"]["Enums"]["fidc_recommendation"]
          recommendation_reason?: string | null
          reference_month: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          attention_points?: string | null
          author_id?: string | null
          created_at?: string
          fidc_id?: string
          id?: string
          main_risks?: string | null
          positive_points?: string | null
          recent_evolution?: string | null
          recommendation?: Database["public"]["Enums"]["fidc_recommendation"]
          recommendation_reason?: string | null
          reference_month?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_opinions_fidc_id_fkey"
            columns: ["fidc_id"]
            isOneToOne: false
            referencedRelation: "fidcs"
            referencedColumns: ["id"]
          },
        ]
      }
      emissoes: {
        Row: {
          cnpj_emissor: string
          created_at: string
          fidc_classe: string | null
          fidc_tipo: string | null
          id: string
          isin: string
          ticker: string | null
          updated_at: string
          val_date: string | null
        }
        Insert: {
          cnpj_emissor: string
          created_at?: string
          fidc_classe?: string | null
          fidc_tipo?: string | null
          id?: string
          isin: string
          ticker?: string | null
          updated_at?: string
          val_date?: string | null
        }
        Update: {
          cnpj_emissor?: string
          created_at?: string
          fidc_classe?: string | null
          fidc_tipo?: string | null
          id?: string
          isin?: string
          ticker?: string | null
          updated_at?: string
          val_date?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cnpj: string
          codigo_emissor: string | null
          created_at: string
          grupo_economico: string | null
          id: string
          nome: string
          rating: string | null
          setor: string | null
          status: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          codigo_emissor?: string | null
          created_at?: string
          grupo_economico?: string | null
          id?: string
          nome: string
          rating?: string | null
          setor?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          codigo_emissor?: string | null
          created_at?: string
          grupo_economico?: string | null
          id?: string
          nome?: string
          rating?: string | null
          setor?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_setor_fkey"
            columns: ["setor"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["nome"]
          },
        ]
      }
      fidc_classes: {
        Row: {
          classe: string
          created_at: string
          isin: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          classe: string
          created_at?: string
          isin: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          classe?: string
          created_at?: string
          isin?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fidc_monthly_quota_classes: {
        Row: {
          class_name: string | null
          created_at: string
          fidc_monthly_report_id: string
          fidc_quota_class_id: string | null
          id: string
          isin: string | null
          matching_status: string | null
          nav_value: number | null
          number_of_quotas: number | null
          quota_type: string | null
          quota_value: number | null
          rating: string | null
          seniority_level: number | null
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          fidc_monthly_report_id: string
          fidc_quota_class_id?: string | null
          id?: string
          isin?: string | null
          matching_status?: string | null
          nav_value?: number | null
          number_of_quotas?: number | null
          quota_type?: string | null
          quota_value?: number | null
          rating?: string | null
          seniority_level?: number | null
        }
        Update: {
          class_name?: string | null
          created_at?: string
          fidc_monthly_report_id?: string
          fidc_quota_class_id?: string | null
          id?: string
          isin?: string | null
          matching_status?: string | null
          nav_value?: number | null
          number_of_quotas?: number | null
          quota_type?: string | null
          quota_value?: number | null
          rating?: string | null
          seniority_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fidc_monthly_quota_classes_fidc_monthly_report_id_fkey"
            columns: ["fidc_monthly_report_id"]
            isOneToOne: false
            referencedRelation: "fidc_monthly_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidc_monthly_quota_classes_fidc_quota_class_id_fkey"
            columns: ["fidc_quota_class_id"]
            isOneToOne: false
            referencedRelation: "fidc_quota_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      fidc_monthly_reports: {
        Row: {
          cash_value: number | null
          created_at: string
          credit_rights_value: number | null
          fidc_id: string
          id: string
          investors_count: number | null
          is_current_version: boolean
          nav_value: number | null
          overdue_value: number | null
          pdd_value: number | null
          quota_total_nav_value: number | null
          quota_validation_difference: number | null
          quota_validation_difference_percentage: number | null
          quota_validation_status:
            | Database["public"]["Enums"]["fidc_validation_status"]
            | null
          quota_value: number | null
          raw_data: Json | null
          reference_month: string
          repurchase_value: number | null
          subordinated_value: number | null
          updated_at: string
          version: number
        }
        Insert: {
          cash_value?: number | null
          created_at?: string
          credit_rights_value?: number | null
          fidc_id: string
          id?: string
          investors_count?: number | null
          is_current_version?: boolean
          nav_value?: number | null
          overdue_value?: number | null
          pdd_value?: number | null
          quota_total_nav_value?: number | null
          quota_validation_difference?: number | null
          quota_validation_difference_percentage?: number | null
          quota_validation_status?:
            | Database["public"]["Enums"]["fidc_validation_status"]
            | null
          quota_value?: number | null
          raw_data?: Json | null
          reference_month: string
          repurchase_value?: number | null
          subordinated_value?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          cash_value?: number | null
          created_at?: string
          credit_rights_value?: number | null
          fidc_id?: string
          id?: string
          investors_count?: number | null
          is_current_version?: boolean
          nav_value?: number | null
          overdue_value?: number | null
          pdd_value?: number | null
          quota_total_nav_value?: number | null
          quota_validation_difference?: number | null
          quota_validation_difference_percentage?: number | null
          quota_validation_status?:
            | Database["public"]["Enums"]["fidc_validation_status"]
            | null
          quota_value?: number | null
          raw_data?: Json | null
          reference_month?: string
          repurchase_value?: number | null
          subordinated_value?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fidc_monthly_reports_fidc_id_fkey"
            columns: ["fidc_id"]
            isOneToOne: false
            referencedRelation: "fidcs"
            referencedColumns: ["id"]
          },
        ]
      }
      fidc_quota_classes: {
        Row: {
          amortization_type: string | null
          benchmark: string | null
          class_name: string | null
          created_at: string
          current_rating: string | null
          current_rating_agency: string | null
          current_rating_date: string | null
          cvm_quota_name: string | null
          fidc_id: string
          id: string
          internal_quota_name: string | null
          is_active: boolean
          isin: string
          notes: string | null
          quota_type: string | null
          remuneration_description: string | null
          seniority_level: number | null
          series_name: string | null
          target_spread: string | null
          updated_at: string
        }
        Insert: {
          amortization_type?: string | null
          benchmark?: string | null
          class_name?: string | null
          created_at?: string
          current_rating?: string | null
          current_rating_agency?: string | null
          current_rating_date?: string | null
          cvm_quota_name?: string | null
          fidc_id: string
          id?: string
          internal_quota_name?: string | null
          is_active?: boolean
          isin: string
          notes?: string | null
          quota_type?: string | null
          remuneration_description?: string | null
          seniority_level?: number | null
          series_name?: string | null
          target_spread?: string | null
          updated_at?: string
        }
        Update: {
          amortization_type?: string | null
          benchmark?: string | null
          class_name?: string | null
          created_at?: string
          current_rating?: string | null
          current_rating_agency?: string | null
          current_rating_date?: string | null
          cvm_quota_name?: string | null
          fidc_id?: string
          id?: string
          internal_quota_name?: string | null
          is_active?: boolean
          isin?: string
          notes?: string | null
          quota_type?: string | null
          remuneration_description?: string | null
          seniority_level?: number | null
          series_name?: string | null
          target_spread?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidc_quota_classes_fidc_id_fkey"
            columns: ["fidc_id"]
            isOneToOne: false
            referencedRelation: "fidcs"
            referencedColumns: ["id"]
          },
        ]
      }
      fidc_rating_history: {
        Row: {
          created_at: string
          fidc_id: string
          fidc_quota_class_id: string | null
          id: string
          notes: string | null
          rating: string | null
          rating_agency: string | null
          rating_date: string | null
          rating_outlook: string | null
          report_date: string | null
          report_url: string | null
        }
        Insert: {
          created_at?: string
          fidc_id: string
          fidc_quota_class_id?: string | null
          id?: string
          notes?: string | null
          rating?: string | null
          rating_agency?: string | null
          rating_date?: string | null
          rating_outlook?: string | null
          report_date?: string | null
          report_url?: string | null
        }
        Update: {
          created_at?: string
          fidc_id?: string
          fidc_quota_class_id?: string | null
          id?: string
          notes?: string | null
          rating?: string | null
          rating_agency?: string | null
          rating_date?: string | null
          rating_outlook?: string | null
          report_date?: string | null
          report_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fidc_rating_history_fidc_id_fkey"
            columns: ["fidc_id"]
            isOneToOne: false
            referencedRelation: "fidcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidc_rating_history_fidc_quota_class_id_fkey"
            columns: ["fidc_quota_class_id"]
            isOneToOne: false
            referencedRelation: "fidc_quota_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      fidcs: {
        Row: {
          administrator: string | null
          auditor: string | null
          cnpj: string
          collection_agent: string | null
          condominium_type: string | null
          created_at: string
          custodian: string | null
          fidc_type: string | null
          id: string
          legal_name: string | null
          main_assignor: string | null
          main_originator: string | null
          manager: string | null
          maturity_date: string | null
          name: string
          notes: string | null
          sector: string | null
          specialized_consultant: string | null
          start_date: string | null
          status: string
          strategy: string | null
          updated_at: string
        }
        Insert: {
          administrator?: string | null
          auditor?: string | null
          cnpj: string
          collection_agent?: string | null
          condominium_type?: string | null
          created_at?: string
          custodian?: string | null
          fidc_type?: string | null
          id?: string
          legal_name?: string | null
          main_assignor?: string | null
          main_originator?: string | null
          manager?: string | null
          maturity_date?: string | null
          name: string
          notes?: string | null
          sector?: string | null
          specialized_consultant?: string | null
          start_date?: string | null
          status?: string
          strategy?: string | null
          updated_at?: string
        }
        Update: {
          administrator?: string | null
          auditor?: string | null
          cnpj?: string
          collection_agent?: string | null
          condominium_type?: string | null
          created_at?: string
          custodian?: string | null
          fidc_type?: string | null
          id?: string
          legal_name?: string | null
          main_assignor?: string | null
          main_originator?: string | null
          manager?: string | null
          maturity_date?: string | null
          name?: string
          notes?: string | null
          sector?: string | null
          specialized_consultant?: string | null
          start_date?: string | null
          status?: string
          strategy?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_eventos: {
        Row: {
          acao: string
          analise_id: string
          comentario: string | null
          created_at: string | null
          data_comite: string | null
          etapa_anterior: string | null
          etapa_nova: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          analise_id: string
          comentario?: string | null
          created_at?: string | null
          data_comite?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          analise_id?: string
          comentario?: string | null
          created_at?: string | null
          data_comite?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_eventos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_eventos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      posicoes: {
        Row: {
          amount: number
          created_at: string
          duration_du: number | null
          dv01: number | null
          financial_price: number | null
          id: string
          implied_spread: number | null
          isin: string | null
          product: string
          product_class: string
          trading_desk_share_source: string
          val_date: string
          yield: number | null
        }
        Insert: {
          amount?: number
          created_at?: string
          duration_du?: number | null
          dv01?: number | null
          financial_price?: number | null
          id?: string
          implied_spread?: number | null
          isin?: string | null
          product: string
          product_class: string
          trading_desk_share_source: string
          val_date: string
          yield?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          duration_du?: number | null
          dv01?: number | null
          financial_price?: number | null
          id?: string
          implied_spread?: number | null
          isin?: string | null
          product?: string
          product_class?: string
          trading_desk_share_source?: string
          val_date?: string
          yield?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          funcao: string
          id: string
          must_change_password: boolean
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          funcao?: string
          id: string
          must_change_password?: boolean
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          funcao?: string
          id?: string
          must_change_password?: boolean
          nome?: string
          status?: string
        }
        Relationships: []
      }
      setores: {
        Row: {
          ativo: boolean
          created_at: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_ativos: {
        Row: {
          anos_venc: number | null
          data_rating: string | null
          emissor_cnpj: string | null
          emissor_nome: string | null
          indexador: string | null
          nome_completo: string | null
          rating: string | null
          spread_emissao: number | null
          sub_indexador: string | null
          taxa_emissao: string | null
          ticker: string
          updated_at: string | null
          venc_date: string | null
        }
        Insert: {
          anos_venc?: number | null
          data_rating?: string | null
          emissor_cnpj?: string | null
          emissor_nome?: string | null
          indexador?: string | null
          nome_completo?: string | null
          rating?: string | null
          spread_emissao?: number | null
          sub_indexador?: string | null
          taxa_emissao?: string | null
          ticker: string
          updated_at?: string | null
          venc_date?: string | null
        }
        Update: {
          anos_venc?: number | null
          data_rating?: string | null
          emissor_cnpj?: string | null
          emissor_nome?: string | null
          indexador?: string | null
          nome_completo?: string | null
          rating?: string | null
          spread_emissao?: number | null
          sub_indexador?: string | null
          taxa_emissao?: string | null
          ticker?: string
          updated_at?: string | null
          venc_date?: string | null
        }
        Relationships: []
      }
      trade_ipca_ref: {
        Row: {
          emissao: string | null
          ntnb_ref: string
          ticker: string
          updated_at: string | null
        }
        Insert: {
          emissao?: string | null
          ntnb_ref: string
          ticker: string
          updated_at?: string | null
        }
        Update: {
          emissao?: string | null
          ntnb_ref?: string
          ticker?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      trade_metricas: {
        Row: {
          avg_10d: number | null
          avg_21d: number | null
          avg_30d: number | null
          avg_5d: number | null
          avg_90d: number | null
          change_bps: number | null
          indexador: string | null
          last_date: string | null
          last_qtd: number | null
          last_val: number | null
          last_vol_fin: number | null
          ntnb_ref: string | null
          ntnb_taxa: number | null
          pu_curva: number | null
          pu_indicativo: number | null
          pu_ratio: number | null
          std_90d: number | null
          ticker: string
          total_qtd: number | null
          total_vol_fin: number | null
          updated_at: string | null
          z_score: number | null
          z_score_10d: number | null
          z_score_21d: number | null
          z_score_5d: number | null
        }
        Insert: {
          avg_10d?: number | null
          avg_21d?: number | null
          avg_30d?: number | null
          avg_5d?: number | null
          avg_90d?: number | null
          change_bps?: number | null
          indexador?: string | null
          last_date?: string | null
          last_qtd?: number | null
          last_val?: number | null
          last_vol_fin?: number | null
          ntnb_ref?: string | null
          ntnb_taxa?: number | null
          pu_curva?: number | null
          pu_indicativo?: number | null
          pu_ratio?: number | null
          std_90d?: number | null
          ticker: string
          total_qtd?: number | null
          total_vol_fin?: number | null
          updated_at?: string | null
          z_score?: number | null
          z_score_10d?: number | null
          z_score_21d?: number | null
          z_score_5d?: number | null
        }
        Update: {
          avg_10d?: number | null
          avg_21d?: number | null
          avg_30d?: number | null
          avg_5d?: number | null
          avg_90d?: number | null
          change_bps?: number | null
          indexador?: string | null
          last_date?: string | null
          last_qtd?: number | null
          last_val?: number | null
          last_vol_fin?: number | null
          ntnb_ref?: string | null
          ntnb_taxa?: number | null
          pu_curva?: number | null
          pu_indicativo?: number | null
          pu_ratio?: number | null
          std_90d?: number | null
          ticker?: string
          total_qtd?: number | null
          total_vol_fin?: number | null
          updated_at?: string | null
          z_score?: number | null
          z_score_10d?: number | null
          z_score_21d?: number | null
          z_score_5d?: number | null
        }
        Relationships: []
      }
      trade_ntnb: {
        Row: {
          bond_name: string
          created_at: string | null
          data: string
          id: number
          pu_indicativo: number | null
          taxa_indicativa: number | null
        }
        Insert: {
          bond_name: string
          created_at?: string | null
          data: string
          id?: number
          pu_indicativo?: number | null
          taxa_indicativa?: number | null
        }
        Update: {
          bond_name?: string
          created_at?: string | null
          data?: string
          id?: number
          pu_indicativo?: number | null
          taxa_indicativa?: number | null
        }
        Relationships: []
      }
      trade_spread_agg_diario: {
        Row: {
          data: string
          grupo: string
          n_ativos: number | null
          spread_mediano: number | null
          spread_p25: number | null
          spread_p75: number | null
        }
        Insert: {
          data: string
          grupo: string
          n_ativos?: number | null
          spread_mediano?: number | null
          spread_p25?: number | null
          spread_p75?: number | null
        }
        Update: {
          data?: string
          grupo?: string
          n_ativos?: number | null
          spread_mediano?: number | null
          spread_p25?: number | null
          spread_p75?: number | null
        }
        Relationships: []
      }
      trade_spread_historico: {
        Row: {
          data: string
          indexador: string | null
          pu_curva: number | null
          pu_indicativo: number | null
          rating: string | null
          spread: number | null
          ticker: string
        }
        Insert: {
          data: string
          indexador?: string | null
          pu_curva?: number | null
          pu_indicativo?: number | null
          rating?: string | null
          spread?: number | null
          ticker: string
        }
        Update: {
          data?: string
          indexador?: string | null
          pu_curva?: number | null
          pu_indicativo?: number | null
          rating?: string | null
          spread?: number | null
          ticker?: string
        }
        Relationships: []
      }
      trade_taxas: {
        Row: {
          created_at: string | null
          data: string
          duration_du: number | null
          id: number
          pu_curva: number | null
          pu_indicativo: number | null
          qtd_negociada: number | null
          taxa_indicativa: number | null
          ticker: string
          vol_financeiro: number | null
        }
        Insert: {
          created_at?: string | null
          data: string
          duration_du?: number | null
          id?: number
          pu_curva?: number | null
          pu_indicativo?: number | null
          qtd_negociada?: number | null
          taxa_indicativa?: number | null
          ticker: string
          vol_financeiro?: number | null
        }
        Update: {
          created_at?: string | null
          data?: string
          duration_du?: number | null
          id?: number
          pu_curva?: number | null
          pu_indicativo?: number | null
          qtd_negociada?: number | null
          taxa_indicativa?: number | null
          ticker?: string
          vol_financeiro?: number | null
        }
        Relationships: []
      }
      trade_ticker_snapshot: {
        Row: {
          payload: Json
          ticker: string
          updated_at: string
        }
        Insert: {
          payload: Json
          ticker: string
          updated_at?: string
        }
        Update: {
          payload?: Json
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_upload_log: {
        Row: {
          ativos_di: number | null
          ativos_ipca: number | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          erro_msg: string | null
          filename: string
          id: number
          linhas_atualizadas: number | null
          linhas_inseridas: number | null
          status: string | null
          uploaded_by: string | null
        }
        Insert: {
          ativos_di?: number | null
          ativos_ipca?: number | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          erro_msg?: string | null
          filename: string
          id?: number
          linhas_atualizadas?: number | null
          linhas_inseridas?: number | null
          status?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ativos_di?: number | null
          ativos_ipca?: number | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          erro_msg?: string | null
          filename?: string
          id?: number
          linhas_atualizadas?: number | null
          linhas_inseridas?: number | null
          status?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
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
    }
    Views: {
      profiles_public: {
        Row: {
          funcao: string | null
          id: string | null
          nome: string | null
          status: string | null
        }
        Insert: {
          funcao?: string | null
          id?: string | null
          nome?: string | null
          status?: string | null
        }
        Update: {
          funcao?: string | null
          id?: string | null
          nome?: string | null
          status?: string | null
        }
        Relationships: []
      }
      trade_monitor_view: {
        Row: {
          anos_venc: number | null
          avg_10d: number | null
          avg_21d: number | null
          avg_30d: number | null
          avg_5d: number | null
          avg_90d: number | null
          change_bps: number | null
          data_rating: string | null
          emissor_cnpj: string | null
          emissor_nome: string | null
          indexador: string | null
          indexador_ativo: string | null
          last_date: string | null
          last_qtd: number | null
          last_val: number | null
          last_vol_fin: number | null
          nome_completo: string | null
          ntnb_ref: string | null
          ntnb_taxa: number | null
          pu_curva: number | null
          pu_indicativo: number | null
          pu_ratio: number | null
          rating: string | null
          spread_emissao: number | null
          std_90d: number | null
          sub_indexador: string | null
          taxa_emissao: string | null
          ticker: string | null
          total_qtd: number | null
          total_vol_fin: number | null
          updated_at: string | null
          venc_date: string | null
          z_score: number | null
          z_score_10d: number | null
          z_score_21d: number | null
          z_score_5d: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_forward_fill: { Args: never; Returns: number }
      derive_sub_indexador: {
        Args: { p_indexador: string; p_taxa_emissao: string }
        Returns: string
      }
      fidc_can_write: { Args: { _user_id: string }; Returns: boolean }
      fidc_can_write_opinion: { Args: { _user_id: string }; Returns: boolean }
      get_active_analysts: {
        Args: never
        Returns: {
          funcao: string
          id: string
          nome: string
          status: string
        }[]
      }
      get_ipca_history:
        | {
            Args: { p_cutoff?: string; p_ticker?: string }
            Returns: {
              data: string
              pu_curva: number
              pu_indicativo: number
              spread: number
              ticker: string
            }[]
          }
        | {
            Args: {
              p_cutoff?: string
              p_limit?: number
              p_offset?: number
              p_ticker?: string
            }
            Returns: {
              data: string
              pu_curva: number
              pu_indicativo: number
              spread: number
              ticker: string
            }[]
          }
      get_posicoes_val_dates: {
        Args: never
        Returns: {
          val_date_parsed: string
          val_date_text: string
        }[]
      }
      get_posicoes_val_dates_by_source: {
        Args: { p_source: string }
        Returns: {
          val_date_parsed: string
          val_date_text: string
        }[]
      }
      get_profile_names: {
        Args: never
        Returns: {
          funcao: string
          id: string
          nome: string
          status: string
        }[]
      }
      get_trade_summary: {
        Args: { p_indexador: string; p_sub_indexador?: string }
        Returns: {
          hot_count: number
          median_avg_10d: number
          median_avg_21d: number
          median_avg_30d: number
          median_avg_5d: number
          median_avg_90d: number
          median_last_val: number
          total_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_trade_metricas: { Args: never; Returns: undefined }
      recalc_trade_metricas_di: { Args: never; Returns: undefined }
      recalc_trade_metricas_ipca: { Args: never; Returns: undefined }
      recalc_trade_metricas_ipca_batch: {
        Args: { p_after_ticker?: string; p_limit?: number }
        Returns: {
          has_more: boolean
          next_after_ticker: string
          processed_count: number
        }[]
      }
      refresh_spread_agg_diario: { Args: never; Returns: number }
      refresh_spread_historico: { Args: never; Returns: number }
      refresh_ticker_snapshots: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "Gestor"
        | "Analista"
        | "Risco e Compliance"
        | "Consulta"
        | "Coordenação/Especialista"
      fidc_alert_severity: "normal" | "warning" | "critical"
      fidc_alert_status: "new" | "in_analysis" | "resolved"
      fidc_recommendation: "manter" | "acompanhar" | "reduzir" | "zerar"
      fidc_threshold_direction: "above_is_worse" | "below_is_worse"
      fidc_threshold_scope: "global" | "per_fidc" | "per_portfolio"
      fidc_validation_status: "valid" | "warning" | "invalid"
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
      app_role: [
        "Gestor",
        "Analista",
        "Risco e Compliance",
        "Consulta",
        "Coordenação/Especialista",
      ],
      fidc_alert_severity: ["normal", "warning", "critical"],
      fidc_alert_status: ["new", "in_analysis", "resolved"],
      fidc_recommendation: ["manter", "acompanhar", "reduzir", "zerar"],
      fidc_threshold_direction: ["above_is_worse", "below_is_worse"],
      fidc_threshold_scope: ["global", "per_fidc", "per_portfolio"],
      fidc_validation_status: ["valid", "warning", "invalid"],
    },
  },
} as const
