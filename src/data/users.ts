export type UserRole = 'Gestor' | 'Coordenação/Especialista' | 'Analista' | 'Risco e Compliance' | 'Consulta';

export interface User {
  id: string;
  nome: string;
  email: string;
  funcao: UserRole;
  status: 'Ativo' | 'Inativo';
}

export const users: User[] = [
  { id: 'u1', nome: 'Vandeir Ribeiro Gontijo Filho', email: 'vandeirgontijo@butiainvestimentos.com.br', funcao: 'Gestor', status: 'Ativo' },
  { id: 'u2', nome: 'Rodrigo de Freitas Dias', email: 'rodrigodias@butiainvestimentos.com.br', funcao: 'Gestor', status: 'Ativo' },
  { id: 'u3', nome: 'Matheus Virgílio de Moura Lima e Almeida', email: 'matheusalmeida@butiainvestimentos.com.br', funcao: 'Gestor', status: 'Ativo' },
  { id: 'u4', nome: 'Luana Varotto Marques', email: 'luanamarques@butiainvestimentos.com.br', funcao: 'Risco e Compliance', status: 'Ativo' },
  { id: 'u5', nome: 'Carolina Baratz Weinberg', email: 'carolinabaratz@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u6', nome: 'Diogo Vilaça Teixeira', email: 'diogoteixeira@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u7', nome: 'Arthur Gandra de Andrade', email: 'arthurandrade@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u8', nome: 'Ennio Ferreira de Moraes Júnior', email: 'enriomoraes@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u9', nome: 'Paulo Marcelo Furlan de Melo', email: 'paulomelo@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u10', nome: 'Victor Alves do Espírito Santo', email: 'victorespirito@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u11', nome: 'Rafael Zitti', email: 'rafaelzitti@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u12', nome: 'Luca Lima', email: 'lucalima@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u13', nome: 'Laura Nogueira', email: 'lauranogueira@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
  { id: 'u14', nome: 'Ighor Fonseca', email: 'ighorfonseca@butiainvestimentos.com.br', funcao: 'Analista', status: 'Ativo' },
];

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
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline', '/pipeline-de-research', '/credito/corporativo', '/credito/estruturado', '/acoes', '/analistas', '/configuracoes'],
    canWrite: true,
    canManageUsers: true,
    canViewAllDashboards: true,
    canApproveAnalyses: true,
    canCreateAnalyses: true,
    canEditOthersAnalyses: true,
  },
  'Analista': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline', '/pipeline-de-research', '/credito/corporativo', '/credito/estruturado', '/acoes'],
    canWrite: true,
    canManageUsers: false,
    canViewAllDashboards: false,
    canApproveAnalyses: false,
    canCreateAnalyses: true,
    canEditOthersAnalyses: false,
  },
  'Risco e Compliance': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline', '/pipeline-de-research', '/credito/corporativo', '/credito/estruturado', '/acoes', '/analistas', '/configuracoes'],
    canWrite: false,
    canManageUsers: false,
    canViewAllDashboards: false,
    canApproveAnalyses: false,
    canCreateAnalyses: false,
    canEditOthersAnalyses: false,
  },
  'Consulta': {
    sections: ['/', '/posicoes', '/empresas', '/analises', '/pipeline-de-research', '/credito/corporativo', '/credito/estruturado'],
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
