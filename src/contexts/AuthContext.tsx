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

interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  loading: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      });
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setCurrentUser(null);
        }
        setLoading(false);
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const permissions = currentUser
    ? rolePermissions[currentUser.funcao] ?? defaultPermissions
    : defaultPermissions;

  const hasAccess = (path: string) => {
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
  };

  return (
    <AuthContext.Provider value={{ currentUser, session, loading, permissions, hasAccess, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
