'use client';

import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/lib/api';

export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  return {
    user: data?.user ?? null,
    organization: data?.organization ?? null,
    role: data?.role ?? null,
    permissions: data?.permissions ?? [],
    isLoading,
    isAuthenticated: !!data?.user && !error,
  };
}

export function usePermission(permission: string) {
  const { permissions } = useAuth();
  return permissions.includes(permission);
}
