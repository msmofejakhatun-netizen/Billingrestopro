import React from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: ('owner' | 'admin' | 'captain')[];
}

export const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { profile } = useAuthStore();

  if (!profile || !allowedRoles.includes(profile.role) || !profile.active) {
    if (profile && !profile.active) {
      // Maybe show a specific "Account Disabled" state? For now just redirect.
      console.warn('Access Denied: Account is inactive');
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
