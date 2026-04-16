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
          observacoes: string | null
          prazo: string | null
          preco_maximo: number | null
          preco_medio: number | null
          preco_min: number | null
          recomendacao: string | null
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
          observacoes?: string | null
          prazo?: string | null
          preco_maximo?: number | null
          preco_medio?: number | null
          preco_min?: number | null
          recomendacao?: string | null
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
          observacoes?: string | null
          prazo?: string | null
          preco_maximo?: number | null
          preco_medio?: number | null
          preco_min?: number | null
          recomendacao?: string | null
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
      assembleias: {
        Row: {
          cnpj_empresa: string | null
          created_at: string
          data_evento: string
          data_limite_voto: string | null
          descricao: string | null
          documentos: Json
          hora_evento: string | null
          id: string
          isin: string | null
          justificativa_voto: string | null
          local_link: string | null
          modalidade: string | null
          observacoes: string | null
          quorum_atingido: boolean | null
          responsavel_id: string | null
          resultado: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          voto_butia: string | null
        }
        Insert: {
          cnpj_empresa?: string | null
          created_at?: string
          data_evento: string
          data_limite_voto?: string | null
          descricao?: string | null
          documentos?: Json
          hora_evento?: string | null
          id?: string
          isin?: string | null
          justificativa_voto?: string | null
          local_link?: string | null
          modalidade?: string | null
          observacoes?: string | null
          quorum_atingido?: boolean | null
          responsavel_id?: string | null
          resultado?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
          voto_butia?: string | null
        }
        Update: {
          cnpj_empresa?: string | null
          created_at?: string
          data_evento?: string
          data_limite_voto?: string | null
          descricao?: string | null
          documentos?: Json
          hora_evento?: string | null
          id?: string
          isin?: string | null
          justificativa_voto?: string | null
          local_link?: string | null
          modalidade?: string | null
          observacoes?: string | null
          quorum_atingido?: boolean | null
          responsavel_id?: string | null
          resultado?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
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
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
