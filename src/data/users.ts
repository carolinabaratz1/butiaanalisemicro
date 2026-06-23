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

const FIDC_PATHS = [
  '/fidc-monitor',
  '/fidc-monitor/fidcs',
  '/fidc-monitor/cadastro',
  '/fidc-monitor/pareceres',
  '/fidc-monitor/alertas',
];

export const rolePermissions: Record<UserRole, RolePermissions> = {
  'Gestor': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline', '/pipeline-de-research', '/configuracoes', '/assembleias', '/trade', '/trade/upload', '/desempenho', ...FIDC_PATHS],
    canWrite: true,
    canManageUsers: true,
    canViewAllDashboards: true,
    canApproveAnalyses: true,
    canCreateAnalyses: true,
    canEditOthersAnalyses: true,
  },
  'Coordenação/Especialista': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline-de-research', '/assembleias', '/trade', '/trade/upload', '/desempenho', ...FIDC_PATHS],
    canWrite: true,
    canManageUsers: false,
    canViewAllDashboards: true,
    canApproveAnalyses: true,
    canCreateAnalyses: true,
    canEditOthersAnalyses: true,
  },
  'Analista': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline-de-research', '/assembleias', '/trade', '/trade/upload', ...FIDC_PATHS],
    canWrite: true,
    canManageUsers: false,
    canViewAllDashboards: false,
    canApproveAnalyses: false,
    canCreateAnalyses: true,
    canEditOthersAnalyses: false,
  },
  'Risco e Compliance': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline', '/pipeline-de-research', '/configuracoes', '/assembleias', '/trade', ...FIDC_PATHS],
    canWrite: false,
    canManageUsers: false,
    canViewAllDashboards: false,
    canApproveAnalyses: false,
    canCreateAnalyses: false,
    canEditOthersAnalyses: false,
  },
  'Consulta': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline-de-research', '/assembleias', '/trade', ...FIDC_PATHS],
    canWrite: false,
    canManageUsers: false,
    canViewAllDashboards: false,
    canApproveAnalyses: false,
    canCreateAnalyses: false,
    canEditOthersAnalyses: false,
  },
};
