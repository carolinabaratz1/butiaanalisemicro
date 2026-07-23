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
          oferta_cvm_id: number | null
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
          oferta_cvm_id?: number | null
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
          oferta_cvm_id?: number | null
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
        Relationships: [
          {
            foreignKeyName: "analises_oferta_cvm_id_fkey"
            columns: ["oferta_cvm_id"]
            isOneToOne: false
            referencedRelation: "ofertas_publicas_cvm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_oferta_cvm_id_fkey"
            columns: ["oferta_cvm_id"]
            isOneToOne: false
            referencedRelation: "v_ofertas_publicas_cvm_enriquecida"
            referencedColumns: ["id"]
          },
        ]
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
      cvm_data_dictionary: {
        Row: {
          column_name: string
          created_at: string
          description: string | null
          expected_type: string | null
          id: string
          loaded_at: string
          source_meta_file: string | null
          table_name: string
          updated_at: string
        }
        Insert: {
          column_name: string
          created_at?: string
          description?: string | null
          expected_type?: string | null
          id?: string
          loaded_at?: string
          source_meta_file?: string | null
          table_name: string
          updated_at?: string
        }
        Update: {
          column_name?: string
          created_at?: string
          description?: string | null
          expected_type?: string | null
          id?: string
          loaded_at?: string
          source_meta_file?: string | null
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cvm_fidc_field_mapping: {
        Row: {
          composite_rule: string | null
          created_at: string
          fallback_rule: string | null
          id: string
          is_required: boolean
          metric_name: string
          notes: string | null
          source_column: string | null
          source_file_pattern: string
          transformation: string | null
          updated_at: string
        }
        Insert: {
          composite_rule?: string | null
          created_at?: string
          fallback_rule?: string | null
          id?: string
          is_required?: boolean
          metric_name: string
          notes?: string | null
          source_column?: string | null
          source_file_pattern: string
          transformation?: string | null
          updated_at?: string
        }
        Update: {
          composite_rule?: string | null
          created_at?: string
          fallback_rule?: string | null
          id?: string
          is_required?: boolean
          metric_name?: string
          notes?: string | null
          source_column?: string | null
          source_file_pattern?: string
          transformation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cvm_monthly_import_staging: {
        Row: {
          cnpj: string
          created_at: string
          extracted_metrics: Json
          extraction_status: string
          fidc_id: string | null
          id: string
          imported_at: string
          missing_metrics: string[]
          raw_rows_by_file: Json
          reference_month: string
          source_url: string | null
          updated_at: string
          validation_summary: Json
        }
        Insert: {
          cnpj: string
          created_at?: string
          extracted_metrics?: Json
          extraction_status?: string
          fidc_id?: string | null
          id?: string
          imported_at?: string
          missing_metrics?: string[]
          raw_rows_by_file?: Json
          reference_month: string
          source_url?: string | null
          updated_at?: string
          validation_summary?: Json
        }
        Update: {
          cnpj?: string
          created_at?: string
          extracted_metrics?: Json
          extraction_status?: string
          fidc_id?: string | null
          id?: string
          imported_at?: string
          missing_metrics?: string[]
          raw_rows_by_file?: Json
          reference_month?: string
          source_url?: string | null
          updated_at?: string
          validation_summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cvm_monthly_import_staging_fidc_id_fkey"
            columns: ["fidc_id"]
            isOneToOne: false
            referencedRelation: "fidcs"
            referencedColumns: ["id"]
          },
        ]
      }
      cvm_ofertas_sync_log: {
        Row: {
          dataset_url: string | null
          erro_msg: string | null
          finished_at: string | null
          id: number
          linhas_atualizadas: number | null
          linhas_novas: number | null
          mensagem_erro: string | null
          started_at: string
          status: string
          total_atualizadas: number | null
          total_inseridas: number | null
          total_linhas_processadas: number | null
        }
        Insert: {
          dataset_url?: string | null
          erro_msg?: string | null
          finished_at?: string | null
          id?: number
          linhas_atualizadas?: number | null
          linhas_novas?: number | null
          mensagem_erro?: string | null
          started_at?: string
          status?: string
          total_atualizadas?: number | null
          total_inseridas?: number | null
          total_linhas_processadas?: number | null
        }
        Update: {
          dataset_url?: string | null
          erro_msg?: string | null
          finished_at?: string | null
          id?: number
          linhas_atualizadas?: number | null
          linhas_novas?: number | null
          mensagem_erro?: string | null
          started_at?: string
          status?: string
          total_atualizadas?: number | null
          total_inseridas?: number | null
          total_linhas_processadas?: number | null
        }
        Relationships: []
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
      fidc_alert_events: {
        Row: {
          class_code: string | null
          created_at: string
          id: string
          isin: string | null
          message: string | null
          payload: Json
          rule_id: string | null
          severity: string
          triggered_at: string
        }
        Insert: {
          class_code?: string | null
          created_at?: string
          id?: string
          isin?: string | null
          message?: string | null
          payload?: Json
          rule_id?: string | null
          severity?: string
          triggered_at?: string
        }
        Update: {
          class_code?: string | null
          created_at?: string
          id?: string
          isin?: string | null
          message?: string | null
          payload?: Json
          rule_id?: string | null
          severity?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidc_alert_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "fidc_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      fidc_alert_rules: {
        Row: {
          action: Json
          active: boolean
          class_code: string | null
          condition: Json
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          isin: string | null
          last_triggered_at: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          action?: Json
          active?: boolean
          class_code?: string | null
          condition?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          isin?: string | null
          last_triggered_at?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          action?: Json
          active?: boolean
          class_code?: string | null
          condition?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          isin?: string | null
          last_triggered_at?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
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
          amortization_quota_quantity: number | null
          amortization_value: number | null
          class_name: string | null
          class_series_name: string | null
          cnpj_fundo_classe: string | null
          created_at: string
          fidc_monthly_report_id: string
          fidc_quota_class_id: string | null
          gross_quota_flow_value: number | null
          id: string
          id_subclasse: string | null
          investors_count: number | null
          investors_source_file: string | null
          isin: string | null
          matching_status: string | null
          monthly_return_decimal: number | null
          monthly_return_pct: number | null
          monthly_yield_pct: number | null
          nav_pct: number | null
          nav_value: number | null
          net_quota_flow_value: number | null
          number_of_quotas: number | null
          parse_status: string | null
          quota_flow_source_file: string | null
          quota_nav_value: number | null
          quota_type: string | null
          quota_value: number | null
          rating: string | null
          raw_monthly_return: string | null
          raw_quota_quantity: string | null
          raw_quota_value: string | null
          redemption_quota_quantity: number | null
          redemption_value: number | null
          reference_month: string | null
          requested_redemption_quota_quantity: number | null
          requested_redemption_value: number | null
          return_source_file: string | null
          seniority_level: number | null
          source: string
          subscription_quota_quantity: number | null
          subscription_value: number | null
        }
        Insert: {
          amortization_quota_quantity?: number | null
          amortization_value?: number | null
          class_name?: string | null
          class_series_name?: string | null
          cnpj_fundo_classe?: string | null
          created_at?: string
          fidc_monthly_report_id: string
          fidc_quota_class_id?: string | null
          gross_quota_flow_value?: number | null
          id?: string
          id_subclasse?: string | null
          investors_count?: number | null
          investors_source_file?: string | null
          isin?: string | null
          matching_status?: string | null
          monthly_return_decimal?: number | null
          monthly_return_pct?: number | null
          monthly_yield_pct?: number | null
          nav_pct?: number | null
          nav_value?: number | null
          net_quota_flow_value?: number | null
          number_of_quotas?: number | null
          parse_status?: string | null
          quota_flow_source_file?: string | null
          quota_nav_value?: number | null
          quota_type?: string | null
          quota_value?: number | null
          rating?: string | null
          raw_monthly_return?: string | null
          raw_quota_quantity?: string | null
          raw_quota_value?: string | null
          redemption_quota_quantity?: number | null
          redemption_value?: number | null
          reference_month?: string | null
          requested_redemption_quota_quantity?: number | null
          requested_redemption_value?: number | null
          return_source_file?: string | null
          seniority_level?: number | null
          source?: string
          subscription_quota_quantity?: number | null
          subscription_value?: number | null
        }
        Update: {
          amortization_quota_quantity?: number | null
          amortization_value?: number | null
          class_name?: string | null
          class_series_name?: string | null
          cnpj_fundo_classe?: string | null
          created_at?: string
          fidc_monthly_report_id?: string
          fidc_quota_class_id?: string | null
          gross_quota_flow_value?: number | null
          id?: string
          id_subclasse?: string | null
          investors_count?: number | null
          investors_source_file?: string | null
          isin?: string | null
          matching_status?: string | null
          monthly_return_decimal?: number | null
          monthly_return_pct?: number | null
          monthly_yield_pct?: number | null
          nav_pct?: number | null
          nav_value?: number | null
          net_quota_flow_value?: number | null
          number_of_quotas?: number | null
          parse_status?: string | null
          quota_flow_source_file?: string | null
          quota_nav_value?: number | null
          quota_type?: string | null
          quota_value?: number | null
          rating?: string | null
          raw_monthly_return?: string | null
          raw_quota_quantity?: string | null
          raw_quota_value?: string | null
          redemption_quota_quantity?: number | null
          redemption_value?: number | null
          reference_month?: string | null
          requested_redemption_quota_quantity?: number | null
          requested_redemption_value?: number | null
          return_source_file?: string | null
          seniority_level?: number | null
          source?: string
          subscription_quota_quantity?: number | null
          subscription_value?: number | null
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
          acquisition_value: number | null
          acquisition_with_risk_value: number | null
          acquisition_without_risk_value: number | null
          acquisitions_value: number | null
          assignors_breakdown: Json | null
          avg_nav_value: number | null
          cash_strict_value: number | null
          cash_value: number | null
          created_at: string
          credit_rights_gross_value: number | null
          credit_rights_value: number | null
          credit_rights_with_risk_transfer: number | null
          credit_rights_without_risk_transfer: number | null
          defaulted_credit_rights_value: number | null
          delinquency_0_30_value: number | null
          delinquency_120_plus_value: number | null
          delinquency_121_150_value: number | null
          delinquency_151_180_value: number | null
          delinquency_181_360_value: number | null
          delinquency_30_plus_value: number | null
          delinquency_31_60_value: number | null
          delinquency_361_720_value: number | null
          delinquency_60_plus_value: number | null
          delinquency_61_90_value: number | null
          delinquency_721_1080_value: number | null
          delinquency_90_plus_value: number | null
          delinquency_91_120_value: number | null
          delinquency_over_1080_value: number | null
          delinquency_unbucketed_value: number | null
          disposals_value: number | null
          fidc_id: string
          file_hash: string | null
          gross_investor_flow_value: number | null
          guarantees_pct_dc: number | null
          guarantees_value: number | null
          id: string
          imported_at: string
          imported_by: string | null
          investors_count: number | null
          is_current_version: boolean
          main_segment: string | null
          main_segment_pct: number | null
          main_segment_value: number | null
          maturity_0_30_value: number | null
          maturity_121_150_value: number | null
          maturity_151_180_value: number | null
          maturity_181_360_value: number | null
          maturity_31_60_value: number | null
          maturity_361_720_value: number | null
          maturity_61_90_value: number | null
          maturity_721_1080_value: number | null
          maturity_91_120_value: number | null
          maturity_breakdown: Json | null
          maturity_over_1080_value: number | null
          mezzanine_nav_pct: number | null
          mezzanine_nav_value: number | null
          mezzanine_subordination_excess: number | null
          mezzanine_subordination_limit: number | null
          mezzanine_subordination_ratio: number | null
          mezzanine_subordination_status: string | null
          nav_value: number | null
          net_investor_flow_value: number | null
          overdue_120d_value: number | null
          overdue_30d_value: number | null
          overdue_60d_value: number | null
          overdue_90d_value: number | null
          overdue_breakdown: Json | null
          overdue_bucket_coverage_status: string | null
          overdue_existing_credit_rights_value: number | null
          overdue_installments_value: number | null
          overdue_source: string | null
          overdue_to_credit_rights_ratio: number | null
          overdue_value: number | null
          overdue_value_tab_i: number | null
          overdue_value_tab_v_vi: number | null
          payables_value: number | null
          pdd_to_overdue_ratio: number | null
          pdd_value: number | null
          portfolio_book_value: number | null
          prepaid_value: number | null
          quota_classes_found_count: number | null
          quota_classes_nav_diff: number | null
          quota_classes_nav_diff_pct: number | null
          quota_classes_nav_sum: number | null
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
          sale_value: number | null
          scr_status: string | null
          scr_value: number | null
          segment_breakdown: Json | null
          segment_portfolio_value: number | null
          segment_validation_status: string | null
          senior_nav_pct: number | null
          senior_nav_value: number | null
          senior_subordination_excess: number | null
          senior_subordination_limit: number | null
          senior_subordination_ratio: number | null
          senior_subordination_status: string | null
          senior_subordination_status_quality: string | null
          source: string
          source_file_name: string | null
          source_url: string | null
          subordinated_calculation_notes: string | null
          subordinated_calculation_status: string | null
          subordinated_nav_pct: number | null
          subordinated_nav_value: number | null
          subordinated_value: number | null
          substitution_value: number | null
          substitutions_value: number | null
          total_amortization_value: number | null
          total_assets: number | null
          total_liabilities: number | null
          total_redemption_value: number | null
          total_requested_redemption_value: number | null
          total_subscription_value: number | null
          unique_nav_value: number | null
          unknown_quota_nav_value: number | null
          updated_at: string
          version: number
        }
        Insert: {
          acquisition_value?: number | null
          acquisition_with_risk_value?: number | null
          acquisition_without_risk_value?: number | null
          acquisitions_value?: number | null
          assignors_breakdown?: Json | null
          avg_nav_value?: number | null
          cash_strict_value?: number | null
          cash_value?: number | null
          created_at?: string
          credit_rights_gross_value?: number | null
          credit_rights_value?: number | null
          credit_rights_with_risk_transfer?: number | null
          credit_rights_without_risk_transfer?: number | null
          defaulted_credit_rights_value?: number | null
          delinquency_0_30_value?: number | null
          delinquency_120_plus_value?: number | null
          delinquency_121_150_value?: number | null
          delinquency_151_180_value?: number | null
          delinquency_181_360_value?: number | null
          delinquency_30_plus_value?: number | null
          delinquency_31_60_value?: number | null
          delinquency_361_720_value?: number | null
          delinquency_60_plus_value?: number | null
          delinquency_61_90_value?: number | null
          delinquency_721_1080_value?: number | null
          delinquency_90_plus_value?: number | null
          delinquency_91_120_value?: number | null
          delinquency_over_1080_value?: number | null
          delinquency_unbucketed_value?: number | null
          disposals_value?: number | null
          fidc_id: string
          file_hash?: string | null
          gross_investor_flow_value?: number | null
          guarantees_pct_dc?: number | null
          guarantees_value?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          investors_count?: number | null
          is_current_version?: boolean
          main_segment?: string | null
          main_segment_pct?: number | null
          main_segment_value?: number | null
          maturity_0_30_value?: number | null
          maturity_121_150_value?: number | null
          maturity_151_180_value?: number | null
          maturity_181_360_value?: number | null
          maturity_31_60_value?: number | null
          maturity_361_720_value?: number | null
          maturity_61_90_value?: number | null
          maturity_721_1080_value?: number | null
          maturity_91_120_value?: number | null
          maturity_breakdown?: Json | null
          maturity_over_1080_value?: number | null
          mezzanine_nav_pct?: number | null
          mezzanine_nav_value?: number | null
          mezzanine_subordination_excess?: number | null
          mezzanine_subordination_limit?: number | null
          mezzanine_subordination_ratio?: number | null
          mezzanine_subordination_status?: string | null
          nav_value?: number | null
          net_investor_flow_value?: number | null
          overdue_120d_value?: number | null
          overdue_30d_value?: number | null
          overdue_60d_value?: number | null
          overdue_90d_value?: number | null
          overdue_breakdown?: Json | null
          overdue_bucket_coverage_status?: string | null
          overdue_existing_credit_rights_value?: number | null
          overdue_installments_value?: number | null
          overdue_source?: string | null
          overdue_to_credit_rights_ratio?: number | null
          overdue_value?: number | null
          overdue_value_tab_i?: number | null
          overdue_value_tab_v_vi?: number | null
          payables_value?: number | null
          pdd_to_overdue_ratio?: number | null
          pdd_value?: number | null
          portfolio_book_value?: number | null
          prepaid_value?: number | null
          quota_classes_found_count?: number | null
          quota_classes_nav_diff?: number | null
          quota_classes_nav_diff_pct?: number | null
          quota_classes_nav_sum?: number | null
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
          sale_value?: number | null
          scr_status?: string | null
          scr_value?: number | null
          segment_breakdown?: Json | null
          segment_portfolio_value?: number | null
          segment_validation_status?: string | null
          senior_nav_pct?: number | null
          senior_nav_value?: number | null
          senior_subordination_excess?: number | null
          senior_subordination_limit?: number | null
          senior_subordination_ratio?: number | null
          senior_subordination_status?: string | null
          senior_subordination_status_quality?: string | null
          source?: string
          source_file_name?: string | null
          source_url?: string | null
          subordinated_calculation_notes?: string | null
          subordinated_calculation_status?: string | null
          subordinated_nav_pct?: number | null
          subordinated_nav_value?: number | null
          subordinated_value?: number | null
          substitution_value?: number | null
          substitutions_value?: number | null
          total_amortization_value?: number | null
          total_assets?: number | null
          total_liabilities?: number | null
          total_redemption_value?: number | null
          total_requested_redemption_value?: number | null
          total_subscription_value?: number | null
          unique_nav_value?: number | null
          unknown_quota_nav_value?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          acquisition_value?: number | null
          acquisition_with_risk_value?: number | null
          acquisition_without_risk_value?: number | null
          acquisitions_value?: number | null
          assignors_breakdown?: Json | null
          avg_nav_value?: number | null
          cash_strict_value?: number | null
          cash_value?: number | null
          created_at?: string
          credit_rights_gross_value?: number | null
          credit_rights_value?: number | null
          credit_rights_with_risk_transfer?: number | null
          credit_rights_without_risk_transfer?: number | null
          defaulted_credit_rights_value?: number | null
          delinquency_0_30_value?: number | null
          delinquency_120_plus_value?: number | null
          delinquency_121_150_value?: number | null
          delinquency_151_180_value?: number | null
          delinquency_181_360_value?: number | null
          delinquency_30_plus_value?: number | null
          delinquency_31_60_value?: number | null
          delinquency_361_720_value?: number | null
          delinquency_60_plus_value?: number | null
          delinquency_61_90_value?: number | null
          delinquency_721_1080_value?: number | null
          delinquency_90_plus_value?: number | null
          delinquency_91_120_value?: number | null
          delinquency_over_1080_value?: number | null
          delinquency_unbucketed_value?: number | null
          disposals_value?: number | null
          fidc_id?: string
          file_hash?: string | null
          gross_investor_flow_value?: number | null
          guarantees_pct_dc?: number | null
          guarantees_value?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          investors_count?: number | null
          is_current_version?: boolean
          main_segment?: string | null
          main_segment_pct?: number | null
          main_segment_value?: number | null
          maturity_0_30_value?: number | null
          maturity_121_150_value?: number | null
          maturity_151_180_value?: number | null
          maturity_181_360_value?: number | null
          maturity_31_60_value?: number | null
          maturity_361_720_value?: number | null
          maturity_61_90_value?: number | null
          maturity_721_1080_value?: number | null
          maturity_91_120_value?: number | null
          maturity_breakdown?: Json | null
          maturity_over_1080_value?: number | null
          mezzanine_nav_pct?: number | null
          mezzanine_nav_value?: number | null
          mezzanine_subordination_excess?: number | null
          mezzanine_subordination_limit?: number | null
          mezzanine_subordination_ratio?: number | null
          mezzanine_subordination_status?: string | null
          nav_value?: number | null
          net_investor_flow_value?: number | null
          overdue_120d_value?: number | null
          overdue_30d_value?: number | null
          overdue_60d_value?: number | null
          overdue_90d_value?: number | null
          overdue_breakdown?: Json | null
          overdue_bucket_coverage_status?: string | null
          overdue_existing_credit_rights_value?: number | null
          overdue_installments_value?: number | null
          overdue_source?: string | null
          overdue_to_credit_rights_ratio?: number | null
          overdue_value?: number | null
          overdue_value_tab_i?: number | null
          overdue_value_tab_v_vi?: number | null
          payables_value?: number | null
          pdd_to_overdue_ratio?: number | null
          pdd_value?: number | null
          portfolio_book_value?: number | null
          prepaid_value?: number | null
          quota_classes_found_count?: number | null
          quota_classes_nav_diff?: number | null
          quota_classes_nav_diff_pct?: number | null
          quota_classes_nav_sum?: number | null
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
          sale_value?: number | null
          scr_status?: string | null
          scr_value?: number | null
          segment_breakdown?: Json | null
          segment_portfolio_value?: number | null
          segment_validation_status?: string | null
          senior_nav_pct?: number | null
          senior_nav_value?: number | null
          senior_subordination_excess?: number | null
          senior_subordination_limit?: number | null
          senior_subordination_ratio?: number | null
          senior_subordination_status?: string | null
          senior_subordination_status_quality?: string | null
          source?: string
          source_file_name?: string | null
          source_url?: string | null
          subordinated_calculation_notes?: string | null
          subordinated_calculation_status?: string | null
          subordinated_nav_pct?: number | null
          subordinated_nav_value?: number | null
          subordinated_value?: number | null
          substitution_value?: number | null
          substitutions_value?: number | null
          total_amortization_value?: number | null
          total_assets?: number | null
          total_liabilities?: number | null
          total_redemption_value?: number | null
          total_requested_redemption_value?: number | null
          total_subscription_value?: number | null
          unique_nav_value?: number | null
          unknown_quota_nav_value?: number | null
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
      fidc_monthly_segments: {
        Row: {
          cnpj_fundo_classe: string
          created_at: string
          fidc_id: string | null
          id: string
          parent_segment: string | null
          pct_of_segment_portfolio: number | null
          reference_month: string
          segment_code: string | null
          segment_group: string
          segment_level: number
          segment_name: string
          source: string
          source_file: string | null
          value: number | null
        }
        Insert: {
          cnpj_fundo_classe: string
          created_at?: string
          fidc_id?: string | null
          id?: string
          parent_segment?: string | null
          pct_of_segment_portfolio?: number | null
          reference_month: string
          segment_code?: string | null
          segment_group: string
          segment_level?: number
          segment_name: string
          source?: string
          source_file?: string | null
          value?: number | null
        }
        Update: {
          cnpj_fundo_classe?: string
          created_at?: string
          fidc_id?: string | null
          id?: string
          parent_segment?: string | null
          pct_of_segment_portfolio?: number | null
          reference_month?: string
          segment_code?: string | null
          segment_group?: string
          segment_level?: number
          segment_name?: string
          source?: string
          source_file?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fidc_monthly_segments_fidc_id_fkey"
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
      fidc_subordination_limits: {
        Row: {
          cnpj_fundo_classe: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          fidc_id: string
          id: string
          mezzanine_min_subordination_pct: number | null
          notes: string | null
          regulation_reference: string | null
          senior_min_subordination_pct: number | null
          source: string
          updated_at: string
        }
        Insert: {
          cnpj_fundo_classe?: string | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          fidc_id: string
          id?: string
          mezzanine_min_subordination_pct?: number | null
          notes?: string | null
          regulation_reference?: string | null
          senior_min_subordination_pct?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          cnpj_fundo_classe?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          fidc_id?: string
          id?: string
          mezzanine_min_subordination_pct?: number | null
          notes?: string | null
          regulation_reference?: string | null
          senior_min_subordination_pct?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidc_subordination_limits_fidc_id_fkey"
            columns: ["fidc_id"]
            isOneToOne: false
            referencedRelation: "fidcs"
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
      issuer_limits: {
        Row: {
          approved_by: string | null
          cnpj_emissor: string
          committee_date: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          grupo_economico: string | null
          id: string
          limit_pct_nav: number | null
          limit_type: string
          limit_value: number | null
          notes: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          cnpj_emissor: string
          committee_date?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          grupo_economico?: string | null
          id?: string
          limit_pct_nav?: number | null
          limit_type?: string
          limit_value?: number | null
          notes?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          cnpj_emissor?: string
          committee_date?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          grupo_economico?: string | null
          id?: string
          limit_pct_nav?: number | null
          limit_type?: string
          limit_value?: number | null
          notes?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      issuer_ratings: {
        Row: {
          cnpj: string
          created_at: string
          created_by: string | null
          data_rating: string | null
          id: string
          observacao: string | null
          outlook: string | null
          rating: string
          rating_agency: string | null
          report_url: string | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          created_by?: string | null
          data_rating?: string | null
          id?: string
          observacao?: string | null
          outlook?: string | null
          rating: string
          rating_agency?: string | null
          report_url?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          created_by?: string | null
          data_rating?: string | null
          id?: string
          observacao?: string | null
          outlook?: string | null
          rating?: string
          rating_agency?: string | null
          report_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mfa_reset_log: {
        Row: {
          created_at: string
          factors_removed: number
          id: string
          note: string | null
          performed_by: string
          performed_by_email: string | null
          performed_by_nome: string | null
          target_user_email: string | null
          target_user_id: string
          target_user_nome: string | null
        }
        Insert: {
          created_at?: string
          factors_removed?: number
          id?: string
          note?: string | null
          performed_by: string
          performed_by_email?: string | null
          performed_by_nome?: string | null
          target_user_email?: string | null
          target_user_id: string
          target_user_nome?: string | null
        }
        Update: {
          created_at?: string
          factors_removed?: number
          id?: string
          note?: string | null
          performed_by?: string
          performed_by_email?: string | null
          performed_by_nome?: string | null
          target_user_email?: string | null
          target_user_id?: string
          target_user_nome?: string | null
        }
        Relationships: []
      }
      ofertas_publicas_cvm: {
        Row: {
          cnpj_emissor: string | null
          coordenador_lider: string | null
          data_encerramento: string | null
          data_referencia: string | null
          first_seen_at: string
          hash_linha: string
          id: number
          last_seen_at: string
          modalidade: string | null
          nome_emissor: string | null
          numero_emissao: string | null
          numero_registro_cvm: string | null
          numero_serie: string | null
          raw_data: Json
          situacao: string | null
          source_dataset: string
          taxa_emissao: string | null
          tipo_ativo: string | null
          valor_total: number | null
        }
        Insert: {
          cnpj_emissor?: string | null
          coordenador_lider?: string | null
          data_encerramento?: string | null
          data_referencia?: string | null
          first_seen_at?: string
          hash_linha: string
          id?: number
          last_seen_at?: string
          modalidade?: string | null
          nome_emissor?: string | null
          numero_emissao?: string | null
          numero_registro_cvm?: string | null
          numero_serie?: string | null
          raw_data?: Json
          situacao?: string | null
          source_dataset: string
          taxa_emissao?: string | null
          tipo_ativo?: string | null
          valor_total?: number | null
        }
        Update: {
          cnpj_emissor?: string | null
          coordenador_lider?: string | null
          data_encerramento?: string | null
          data_referencia?: string | null
          first_seen_at?: string
          hash_linha?: string
          id?: number
          last_seen_at?: string
          modalidade?: string | null
          nome_emissor?: string | null
          numero_emissao?: string | null
          numero_registro_cvm?: string | null
          numero_serie?: string | null
          raw_data?: Json
          situacao?: string | null
          source_dataset?: string
          taxa_emissao?: string | null
          tipo_ativo?: string | null
          valor_total?: number | null
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
      rating_emission_history: {
        Row: {
          cnpj_emissor: string | null
          created_at: string
          created_by: string | null
          id: string
          isin: string
          observacao: string | null
          outlook: string | null
          rating_date: string | null
          rating_value: string
          report_url: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          cnpj_emissor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          isin: string
          observacao?: string | null
          outlook?: string | null
          rating_date?: string | null
          rating_value: string
          report_url?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          cnpj_emissor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          isin?: string
          observacao?: string | null
          outlook?: string | null
          rating_date?: string | null
          rating_value?: string
          report_url?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rating_fidc_class_history: {
        Row: {
          class_code: string
          created_at: string
          created_by: string | null
          id: string
          isin: string
          observacao: string | null
          outlook: string | null
          rating_date: string | null
          rating_value: string
          report_url: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          class_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          isin: string
          observacao?: string | null
          outlook?: string | null
          rating_date?: string | null
          rating_value: string
          report_url?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          class_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          isin?: string
          observacao?: string | null
          outlook?: string | null
          rating_date?: string | null
          rating_value?: string
          report_url?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rating_issuer_history: {
        Row: {
          cnpj: string
          created_at: string
          created_by: string | null
          id: string
          observacao: string | null
          outlook: string | null
          rating_date: string | null
          rating_value: string
          report_url: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          outlook?: string | null
          rating_date?: string | null
          rating_value: string
          report_url?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          outlook?: string | null
          rating_date?: string | null
          rating_value?: string
          report_url?: string | null
          source?: string | null
          updated_at?: string
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
      sync_external_log: {
        Row: {
          created_at: string
          details: Json
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          tables_failed: number | null
          tables_ok: number | null
          tables_total: number | null
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tables_failed?: number | null
          tables_ok?: number | null
          tables_total?: number | null
          trigger_source: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tables_failed?: number | null
          tables_ok?: number | null
          tables_total?: number | null
          trigger_source?: string
          triggered_by?: string | null
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
      v_empresa_rating_resolved: {
        Row: {
          cnpj: string | null
          data_rating: string | null
          grupo_economico: string | null
          nome: string | null
          rating: string | null
          rating_agency: string | null
          source_level: string | null
        }
        Relationships: []
      }
      v_issuer_rating_current: {
        Row: {
          agencia: string | null
          cnpj: string | null
          data_rating: string | null
          outlook: string | null
          rating: string | null
          source_id: string | null
        }
        Relationships: []
      }
      v_ofertas_publicas_cvm_enriquecida: {
        Row: {
          cnpj_emissor: string | null
          coordenador_lider: string | null
          data_encerramento: string | null
          data_referencia: string | null
          emissor_conhecido_nome: string | null
          emissor_ja_conhecido: boolean | null
          first_seen_at: string | null
          hash_linha: string | null
          id: number | null
          last_seen_at: string | null
          modalidade: string | null
          nome_emissor: string | null
          numero_emissao: string | null
          numero_registro_cvm: string | null
          numero_serie: string | null
          raw_data: Json | null
          situacao: string | null
          source_dataset: string | null
          taxa_emissao: string | null
          tipo_ativo: string | null
          valor_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_forward_fill: { Args: never; Returns: number }
      bulk_upsert_ofertas_cvm: {
        Args: { p_rows: Json }
        Returns: {
          atualizadas: number
          inseridas: number
        }[]
      }
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
      get_emissores_gestao: {
        Args: never
        Returns: {
          alerts: Json
          analise_data_conclusao: string
          analise_data_validade: string
          analise_id: string
          analise_recomendacao: string
          analise_status: string
          analise_vencida: boolean
          analista_id: string
          cnpj: string
          cnpj_norm: string
          consolidated_pct: number
          exposure_total: number
          funds_count: number
          funds_list: Json
          grupo_economico: string
          largest_fund: string
          largest_fund_pct: number
          largest_fund_value: number
          limit_pct_nav: number
          limit_status: string
          limit_type: string
          limit_value: number
          nome: string
          rating: string
          rating_agencia: string
          rating_data: string
          rating_source: string
          setor: string
          tipo: string
          usage_ratio: number
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
      get_posicoes_dashboard_fundo: {
        Args: { p_fundo: string }
        Returns: {
          amount: number
          cnpj_emissor: string
          codigo_emissor: string
          duration_du: number
          fidc_classe: string
          fidc_tipo: string
          financial_price: number
          fundo: string
          grupo_economico: string
          indexador: string
          isin: string
          nome_emissor: string
          product: string
          product_class: string
          rating: string
          setor: string
          sub_indexador: string
          ticker: string
          vencimento: string
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
      get_resolved_rating: {
        Args: { p_cnpj: string; p_isin?: string; p_ticker?: string }
        Returns: {
          agencia: string
          data_rating: string
          rating: string
          source: string
        }[]
      }
      get_resolved_rating_v2: {
        Args: { p_class_code?: string; p_cnpj: string; p_isin?: string }
        Returns: {
          rating_date: string
          rating_id: string
          rating_value: string
          source: string
          source_level: string
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
      rating_bucket_severity: { Args: { p_rating: string }; Returns: number }
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
      fidc_validation_status: "valid" | "warning" | "invalid" | "cotas_ausentes"
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
      fidc_validation_status: ["valid", "warning", "invalid", "cotas_ausentes"],
    },
  },
} as const
