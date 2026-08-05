import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchProfile, isCompanyActive } from "@/lib/api";
import type { Profile } from "@/lib/types";

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  inactiveReason: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [inactiveReason, setInactiveReason] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).then(async (p) => {
          if (!mounted) return;
          if (p && p.role !== "dev" && p.company_id) {
            const active = await isCompanyActive(p.company_id);
            if (!active) {
              setInactiveReason("Sua empresa está inativa. Contate o administrador do sistema.");
              await supabase.auth.signOut();
              setSession(null);
              setProfile(null);
              setLoading(false);
              return;
            }
          }
          if (p && p.role === "tecnico" && p.active === false) {
            setInactiveReason("Seu acesso foi desativado. Contate o administrador do sistema.");
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        if (newSession?.user) {
          const p = await fetchProfile(newSession.user.id);
          if (!mounted) return;
          if (p && p.role !== "dev" && p.company_id) {
            const active = await isCompanyActive(p.company_id);
            if (!active) {
              setInactiveReason("Sua empresa está inativa. Contate o administrador do sistema.");
              await supabase.auth.signOut();
              setSession(null);
              setProfile(null);
              setLoading(false);
              return;
            }
          }
          if (p && p.role === "tecnico" && p.active === false) {
            setInactiveReason("Seu acesso foi desativado. Contate o administrador do sistema.");
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          setInactiveReason(null);
          setProfile(p);
        } else {
          if (mounted) setProfile(null);
        }
        if (mounted) setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setInactiveReason(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, inactiveReason, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
