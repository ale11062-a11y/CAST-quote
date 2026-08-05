import { AuthProvider, useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Login from "@/pages/Login";
import DevDashboard from "@/pages/DevDashboard";
import EmpresaDashboard from "@/pages/EmpresaDashboard";
import TecnicoDashboard from "@/pages/TecnicoDashboard";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

function Routes() {
  const { session, profile, loading, inactiveReason } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 animate-pulse" />
          <p className="text-sm text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Login notice={inactiveReason} />;
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="font-semibold text-slate-900">Conta sem perfil</h2>
          <p className="text-sm text-slate-500 mt-1">
            Seu login existe, mas ainda não foi vinculado a uma empresa. Contate o administrador para liberar o acesso.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => { supabase.auth.signOut(); }}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  if (profile.role === "dev") return <DevDashboard />;
  if (profile.role === "tecnico") return <TecnicoDashboard />;
  return <EmpresaDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
