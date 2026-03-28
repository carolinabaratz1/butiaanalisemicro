import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole, RolePermissions, users, rolePermissions } from '@/data/users';

interface AuthContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  permissions: RolePermissions;
  hasAccess: (path: string) => boolean;
  allUsers: User[];
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(users[1]); // Default to Rodrigo (Gestor)

  const permissions = rolePermissions[currentUser.funcao];

  const hasAccess = (path: string) => {
    // Check exact match or prefix match for nested routes
    return permissions.sections.some(s => {
      if (path === s) return true;
      if (s !== '/' && path.startsWith(s)) return true;
      return false;
    });
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, permissions, hasAccess, allUsers: users }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
