import { useContext } from 'react';
import { AuthContext, type AuthValue } from '@/lib/auth';

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value !== null) return value;
  throw new Error('useAuth must be called inside an AuthProvider');
}
