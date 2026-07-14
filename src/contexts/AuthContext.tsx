import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, RolePermissions, rolePermissions } from '@/data/users';
import type { Session } from '@supabase/supabase-js';

export interface User {
  id: string;
  nome: string;
  email: string;
  funcao: UserRole;
  status: string;
  must_change_password: boolean;
}

export type MfaStatus = 'loading' | 'no_session' | 'needs_enroll' | 'needs_verify' | 'verified';

interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  loading: boolean;
  mfaStatus: MfaStatus;
  permissions: RolePermissions;
  hasAccess: (path: string) => boolean;
  signOut: () => Promise<void>;
}

const defaultPermissions: RolePermissions = {
  sections: [],
  canWrite: false,
  canManageUsers: false,
  canViewAllDashboards: false,
  canApproveAnalyses: false,
  canCreateAnalyses: false,
  canEditOthersAnalyses: false,
};

const AuthContext = createContext<AuthContextType | null>(null);

async function getMfaStatus(): Promise<MfaStatus> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return 'no_session';

    const { currentLevel, nextLevel } = data as any;

    // No factors enrolled yet
    if (currentLevel === 'aal1' && nextLevel === 'aal1') {
      return 'needs_enroll';
    }

    // Has factor but hasn't verified yet in this session
    if (currentLevel === 'aal1' && nextLevel === 'aal2') {
      return 'needs_verify';
    }

    // Fully verified
    if (currentLevel === 'aal2') {
      return 'verified';
    }

    return 'needs_enroll';
  } catch {
    return 'no_session';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>('loading');

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setCurrentUser({
        id: data.id,
        nome: data.nome,
        email: data.email,
        funcao: data.funcao as UserRole,
        status: data.status,
        must_change_password: (data as any).must_change_password ?? false,
      });
    }
  };

  const refreshMfaStatus = async () => {
    const status = await getMfaStatus();
    setMfaStatus(status);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
          setTimeout(() => refreshMfaStatus(), 0);
        } else {
          setCurrentUser(null);
          setMfaStatus('no_session');
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        refreshMfaStatus();
      } else {
        setMfaStatus('no_session');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const permissions = currentUser
    ? rolePermissions[currentUser.funcao] ?? defaultPermissions
    : defaultPermissions;

  // Paths that require an explicit grant (no prefix-match shortcut).
  // Without this, granting '/trade' (read access) would also grant '/trade/upload' (write).
  const EXACT_MATCH_PATHS = new Set(["/trade/upload"]);

  const hasAccess = (path: string) => {
    if (EXACT_MATCH_PATHS.has(path)) {
      return permissions.sections.includes(path);
    }
    // Alias: "/emissores" consolida as antigas seções "/empresas" e "/analises".
    // Se o perfil tinha acesso a qualquer uma delas, tem acesso a /emissores.
    if (path === '/emissores' || path.startsWith('/emissores/')) {
      if (permissions.sections.includes('/empresas') || permissions.sections.includes('/analises')) {
        return true;
      }
    }
    // Alias: "/ratings/*" (ex.: Rating Resolver) segue permissão de /emissores.
    if (path === '/ratings' || path.startsWith('/ratings/')) {
      if (
        permissions.sections.includes('/emissores') ||
        permissions.sections.includes('/empresas') ||
        permissions.sections.includes('/analises')
      ) {
        return true;
      }
    }
    return permissions.sections.some(s => {
      if (path === s) return true;
      if (s !== '/' && path.startsWith(s)) return true;
      return false;
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
    setMfaStatus('no_session');
  };

  return (
    <AuthContext.Provider value={{ currentUser, session, loading, mfaStatus, permissions, hasAccess, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
