export type UserRole = 'Gestor' | 'Coordenação/Especialista' | 'Analista' | 'Risco e Compliance' | 'Consulta';

export interface RolePermissions {
  sections: string[];
  canWrite: boolean;
  canManageUsers: boolean;
  canViewAllDashboards: boolean;
  canApproveAnalyses: boolean;
  canCreateAnalyses: boolean;
  canEditOthersAnalyses: boolean;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  'Gestor': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline', '/pipeline-de-research', '/configuracoes', '/assembleias', '/trade', '/trade/upload', '/desempenho'],
    canWrite: true,
    canManageUsers: true,
    canViewAllDashboards: true,
    canApproveAnalyses: true,
    canCreateAnalyses: true,
    canEditOthersAnalyses: true,
  },
  'Coordenação/Especialista': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline-de-research', '/assembleias', '/trade', '/trade/upload', '/desempenho'],
    canWrite: true,
    canManageUsers: false,
    canViewAllDashboards: true,
    canApproveAnalyses: true,
    canCreateAnalyses: true,
    canEditOthersAnalyses: true,
  },
  'Analista': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline-de-research', '/assembleias', '/trade', '/trade/upload'],
    canWrite: true,
    canManageUsers: false,
    canViewAllDashboards: false,
    canApproveAnalyses: false,
    canCreateAnalyses: true,
    canEditOthersAnalyses: false,
  },
  'Risco e Compliance': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline', '/pipeline-de-research', '/configuracoes', '/assembleias', '/trade'],
    canWrite: false,
    canManageUsers: false,
    canViewAllDashboards: false,
    canApproveAnalyses: false,
    canCreateAnalyses: false,
    canEditOthersAnalyses: false,
  },
  'Consulta': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline-de-research', '/assembleias', '/trade'],
    canWrite: false,
    canManageUsers: false,
    canViewAllDashboards: false,
    canApproveAnalyses: false,
    canCreateAnalyses: false,
    canEditOthersAnalyses: false,
  },
};

export function getUserNome(id: string): string {
  return users.find(u => u.id === id)?.nome ?? 'N/A';
}
