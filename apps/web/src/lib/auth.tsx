import { createContext, useState, type ReactNode } from 'react';
import { queryClient } from './query-client';
import { clearStoredSession, readStoredSession, storeSession, type Session } from './session';

export type AuthValue = {
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession);

  const signIn = (next: Session) => {
    storeSession(next);
    setSession(next);
  };
  
  const signOut = () => {
    clearStoredSession();
    queryClient.clear();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}
