import React from 'react';
import { useAuthStore, UserRole } from '../stores/useAuthStore';
import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { profile } = useAuthStore();

  if (!profile || !profile.role || !allowedRoles.includes(profile.role) || !profile.active) {
    if (profile && !profile.active) {
      console.warn('Access Denied: Account is inactive');
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
