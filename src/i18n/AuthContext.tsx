import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
}

const IGNORE_SIGNUP_KEY = 'ignore-signup-session';
let ignoreSignupSession = false;

/** After signUp, drop the instant session so the person is not dumped into the app. */
export function ignoreNextSignupSession() {
  ignoreSignupSession = true;
  try {
    sessionStorage.setItem(IGNORE_SIGNUP_KEY, '1');
  } catch {
    /* private mode */
  }
}

function consumeIgnoreSignupSession() {
  if (ignoreSignupSession) {
    ignoreSignupSession = false;
    try {
      sessionStorage.removeItem(IGNORE_SIGNUP_KEY);
    } catch {
      /* private mode */
    }
    return true;
  }
  try {
    if (sessionStorage.getItem(IGNORE_SIGNUP_KEY)) {
      sessionStorage.removeItem(IGNORE_SIGNUP_KEY);
      return true;
    }
  } catch {
    /* private mode */
  }
  return false;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        if (newSession && consumeIgnoreSignupSession()) {
          await supabase.auth.signOut();
          setSession(null);
          setLoading(false);
          return;
        }
        setSession(newSession);
        setLoading(false);
      })();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
