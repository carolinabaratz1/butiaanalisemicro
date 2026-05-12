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
          tipo: string
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
          tipo: string
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
          tipo?: string
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
      emissoes: {
        Row: {
          cnpj_emissor: string
          created_at: string
          id: string
          isin: string
          ticker: string | null
          updated_at: string
          val_date: string | null
        }
        Insert: {
          cnpj_emissor: string
          created_at?: string
          id?: string
          isin: string
          ticker?: string | null
          updated_at?: string
          val_date?: string | null
        }
        Update: {
          cnpj_emissor?: string
          created_at?: string
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
    },
  },
} as const
