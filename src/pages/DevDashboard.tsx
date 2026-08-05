import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { callAdmin, formatCurrency, formatDate } from "@/lib/api";
import type { Company, Profile } from "@/lib/types";
import { Badge, Button, EmptyState, Input, Label, Modal } from "@/components/ui";
import {
  Building2, Plus, Power, KeyRound, FileText, TrendingUp, LogOut, RefreshCw, Trash2, HardHat, ChevronRight,
} from "lucide-react";

type CompanyWithStats = Company & {
  profile?: Profile;
  budget_count?: number;
  total_value?: number;
};

type TechnicianRow = {
  id: string;
  email: string;
  name: string | null;
  company_id: string;
  company_name: string;
  active: boolean;
  created_at: string;
};

export default function DevDashboard() {
  const { profile, signOut } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<CompanyWithStats | null>(null);
  const [resetTechTarget, setResetTechTarget] = useState<TechnicianRow | null>(null);
  const [techCompany, setTechCompany] = useState<CompanyWithStats | null>(null);
  const [companyTechs, setCompanyTechs] = useState<TechnicianRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CompanyWithStats | null>(null);

  async function load() {
    setLoading(true);
    const { data: comps } = await supabase
      .from("companies")
      .select("id, name, active, primary_color, logo_url, created_at")
      .order("created_at", { ascending: false });
    if (!comps) {
      setLoading(false);
      return;
    }
    const ids = comps.map((c) => c.id);
    const [{ data: profs }, { data: budgets }] = await Promise.all([
      supabase.from("profiles").select("id, email, role, company_id, name, active, created_at").in("company_id", ids),
      supabase.from("budgets").select("id, company_id").in("company_id", ids),
    ]);
    const stats: Record<string, { count: number; total: number }> = {};
    for (const b of budgets || []) {
      if (!stats[b.company_id]) stats[b.company_id] = { count: 0, total: 0 };
      stats[b.company_id].count += 1;
    }
    const companyNameById = new Map((comps as Company[]).map((c) => [c.id, c.name]));
    const techRows: TechnicianRow[] = ((profs as Profile[] | null) || [])
      .filter((p) => p.role === "tecnico")
      .map((p) => ({
        id: p.id, email: p.email, name: p.name, company_id: p.company_id!,
        company_name: companyNameById.get(p.company_id!) || "—", active: p.active !== false, created_at: p.created_at,
      }));
    setTechnicians(techRows);
    const result: CompanyWithStats[] = (comps as Company[]).map((c) => ({
      ...c,
      profile: (profs as Profile[] | null)?.find((p) => p.company_id === c.id && p.role === "empresa") || undefined,
      budget_count: stats[c.id]?.count || 0,
    }));
    setCompanies(result);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(company: CompanyWithStats) {
    const { error } = await callAdmin("toggle-company", {
      company_id: company.id,
      active: !company.active,
    });
    if (error) {
      alert(error);
      return;
    }
    load();
  }

  async function deleteCompany(company: CompanyWithStats) {
    const { error } = await callAdmin("delete-company", { company_id: company.id });
    if (error) {
      alert(error);
      return;
    }
    load();
  }

  function openTechs(company: CompanyWithStats) {
    setTechCompany(company);
    setCompanyTechs(technicians.filter((t) => t.company_id === company.id));
  }

  async function toggleTechActive(tech: TechnicianRow) {
    const { error } = await callAdmin("toggle-technician", {
      user_id: tech.id,
      active: !tech.active,
    });
    if (error) {
      alert(error);
      return;
    }
    const updated = companyTechs.map((t) =>
      t.id === tech.id ? { ...t, active: !t.active } : t
    );
    setCompanyTechs(updated);
    load();
  }

  const activeCount = companies.filter((c) => c.active).length;
  const totalBudgets = companies.reduce((sum, c) => sum + (c.budget_count || 0), 0);
  const totalTechs = technicians.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">Painel DEV</h1>
              <p className="text-xs text-slate-500">{profile?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Empresas</h2>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> Nova empresa
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-7 h-7" />}
            title="Nenhuma empresa cadastrada"
            description="Crie a primeira empresa para liberar o acesso dela ao sistema."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((c) => {
              const techCount = technicians.filter((t) => t.company_id === c.id).length;
              return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => openTechs(c)}
                    className="flex items-center gap-3 text-left group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold shrink-0"
                      style={{ backgroundColor: c.primary_color }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition flex items-center gap-1">
                        {c.name}
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" />
                      </h3>
                      <p className="text-xs text-slate-500">{c.profile?.email || "—"}</p>
                    </div>
                  </button>
                  <Badge className={c.active ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}>
                    {c.active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><HardHat className="w-3.5 h-3.5" /> {techCount} técnico{techCount !== 1 ? "s" : ""}</span>
                  <span>{c.budget_count || 0} orçamentos</span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" onClick={() => setResetTarget(c)}>
                    <KeyRound className="w-3.5 h-3.5" /> Senha empresa
                  </Button>
                  <Button
                    variant={c.active ? "ghost" : "secondary"}
                    size="sm"
                    onClick={() => toggleActive(c)}
                    className={c.active ? "text-rose-600 hover:bg-rose-50" : ""}
                  >
                    <Power className="w-3.5 h-3.5" /> {c.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </Button>
                </div>
              </div>
            );
            })}
          </div>
        )}

      </main>

      {showCreate && <CreateCompanyModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {resetTarget && <ResetPasswordModal company={resetTarget} onClose={() => setResetTarget(null)} />}
      {techCompany && (
        <CompanyTechsModal
          company={techCompany}
          technicians={companyTechs}
          onClose={() => setTechCompany(null)}
          onResetTech={(t) => setResetTechTarget(t)}
          onToggleTech={toggleTechActive}
          onResetCompany={(c) => setResetTarget(c)}
        />
      )}
      {resetTechTarget && (
        <ResetTechPasswordModal
          technician={resetTechTarget}
          onClose={() => setResetTechTarget(null)}
          onDone={load}
        />
      )}
      {deleteTarget && (
        <DeleteCompanyModal
          company={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            const c = deleteTarget;
            setDeleteTarget(null);
            if (c) deleteCompany(c);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

function CreateCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await callAdmin("create-company", { name, email, password, primary_color: color });
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Modal title="Nova empresa" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Nome da empresa</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Construtora Alfa" />
        </div>
        <div>
          <Label>E-mail de acesso</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="empresa@email.com" />
        </div>
        <div>
          <Label>Senha inicial</Label>
          <Input type="text" preserveCase required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </div>
        <div>
          <Label>Cor da marca</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
          </div>
        </div>
        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar empresa"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CompanyTechsModal({
  company, technicians, onClose, onResetTech, onToggleTech, onResetCompany,
}: {
  company: CompanyWithStats;
  technicians: TechnicianRow[];
  onClose: () => void;
  onResetTech: (t: TechnicianRow) => void;
  onToggleTech: (t: TechnicianRow) => void;
  onResetCompany: (c: CompanyWithStats) => void;
}) {
  return (
    <Modal title={`Gerenciar — ${company.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3 text-sm">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold shrink-0"
            style={{ backgroundColor: company.primary_color }}
          >
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{company.name}</div>
            <div className="text-xs text-slate-500 truncate">Login: {company.profile?.email || "—"}</div>
          </div>
          <Badge className={company.active ? "bg-emerald-100 text-emerald-700 border-emerald-200 ml-auto" : "bg-slate-100 text-slate-500 border-slate-200 ml-auto"}>
            {company.active ? "Ativa" : "Inativa"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onResetCompany(company)}>
            <KeyRound className="w-3.5 h-3.5" /> Recuperar senha da empresa
          </Button>
        </div>

        <div className="border-t border-slate-200 pt-3">
          <h4 className="font-medium text-slate-700 text-sm mb-2">
            {technicians.length} técnico{technicians.length !== 1 ? "s" : ""} cadastrado{technicians.length !== 1 ? "s" : ""}
          </h4>
        </div>

        {technicians.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            <HardHat className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            Nenhum técnico cadastrado por esta empresa.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {technicians.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <HardHat className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 text-sm truncate">{t.name || "Sem nome"}</div>
                  <div className="text-xs text-slate-500 truncate">Login: {t.email}</div>
                  <Badge className={t.active ? "bg-emerald-100 text-emerald-700 border-emerald-200 mt-1" : "bg-slate-100 text-slate-500 border-slate-200 mt-1"}>
                    {t.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => onResetTech(t)}>
                    <KeyRound className="w-3.5 h-3.5" /> Recuperar senha
                  </Button>
                  <Button
                    variant={t.active ? "ghost" : "secondary"}
                    size="sm"
                    onClick={() => onToggleTech(t)}
                    className={t.active ? "text-rose-600 hover:bg-rose-50" : ""}
                  >
                    <Power className="w-3.5 h-3.5" /> {t.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          As senhas dos técnicos são armazenadas de forma criptografada e não podem ser visualizadas. Use "Recuperar senha" para definir uma nova.
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ company, onClose }: { company: CompanyWithStats; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.profile) {
      setError("Usuário da empresa não encontrado.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error } = await callAdmin("reset-password", {
      user_id: company.profile.id,
      new_password: password,
    });
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
  }

  return (
    <Modal title={`Alterar senha — ${company.name}`} onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="font-medium text-slate-900">Senha alterada com sucesso.</p>
          <p className="text-sm text-slate-500 mt-1">A empresa já pode usar a nova senha para entrar.</p>
          <Button className="mt-4" onClick={onClose}>Fechar</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">
            Defina uma nova senha para o acesso de <span className="font-medium text-slate-700">{company.profile?.email}</span>.
          </p>
          <div>
            <Label>Nova senha</Label>
            <Input type="text" preserveCase required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar senha"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ResetTechPasswordModal({ technician, onClose, onDone }: { technician: TechnicianRow; onClose: () => void; onDone?: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await callAdmin("reset-password", {
      user_id: technician.id,
      new_password: password,
    });
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
    onDone?.();
  }

  return (
    <Modal title={`Alterar senha — ${technician.name || technician.email}`} onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="font-medium text-slate-900">Senha alterada com sucesso.</p>
          <p className="text-sm text-slate-500 mt-1">O técnico já pode usar a nova senha para entrar.</p>
          <Button className="mt-4" onClick={onClose}>Fechar</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">
            Recuperação de acesso para o técnico <span className="font-medium text-slate-700">{technician.email}</span>
            {" "}
            da empresa <span className="font-medium text-slate-700">{technician.company_name}</span>.
          </p>
          <div>
            <Label>Nova senha</Label>
            <Input type="text" preserveCase required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar senha"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function DeleteCompanyModal({
  company, onClose, onConfirm,
}: {
  company: CompanyWithStats;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Modal title={`Excluir empresa — ${company.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-rose-600" />
          </div>
        </div>
        <p className="text-sm text-slate-600 text-center">
          Esta ação vai excluir a empresa <span className="font-semibold text-slate-900">{company.name}</span>,
          seu login ({company.profile?.email || "—"}), e todos os orçamentos cadastrados.
          <br /><br />
          <span className="font-medium text-rose-600">Não é possível desfazer.</span>
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" disabled={confirming} onClick={() => { setConfirming(true); onConfirm(); }}>
            {confirming ? "Excluindo..." : "Sim, excluir empresa"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
