import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  fetchCompany, formatCurrency, formatDate, uploadCompanyLogo,
  uploadBudgetPhoto, uploadServiceOrderPhoto, publicBudgetPhotoUrl,
  publicServiceOrderPhotoUrl, deleteStorageObject, buildMaterialLines, callAdmin,
} from "@/lib/api";
import type {
  Budget, BudgetItem, BudgetPhoto, BudgetWithItems, Company,
  ServiceOrder, ServiceOrderItem, ServiceOrderPhoto, ServiceOrderStatus, ServiceOrderWithItems,
  ServiceOrderWithPhotos, Technician,
} from "@/lib/types";
import { UNIT_OPTIONS, SERVICE_ORDER_STATUS, serviceOrderStatusLabel } from "@/lib/types";
import { generateBudgetPdf, generateServiceOrderPdf } from "@/lib/pdf";
import { Button, EmptyState, Input, Label, Modal, Badge, Textarea, LongTextField, formatPhone, MoneyInput } from "@/components/ui";
import {
  FileText, Plus, Pencil, Trash2, Palette, LogOut, Building2, Eye, X, Copy, Check,
  FileDown, Upload, Image as ImageIcon, Camera, Wrench, ClipboardList, CheckCircle2,
  HardHat, KeyRound, UserPlus,
} from "lucide-react";

type Tab = "budgets" | "orders" | "technicians";

export default function EmpresaDashboard() {
  const { profile, signOut } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [tab, setTab] = useState<Tab>("budgets");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BudgetWithItems | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [viewing, setViewing] = useState<BudgetWithItems | null>(null);
  const [creatingOrderFromBudget, setCreatingOrderFromBudget] = useState<BudgetWithItems | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrderWithItems | null>(null);
  const [viewingOrder, setViewingOrder] = useState<ServiceOrderWithItems | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [showTechnicianForm, setShowTechnicianForm] = useState(false);
  const [resetTech, setResetTech] = useState<Technician | null>(null);

  async function load() {
    if (!profile?.company_id) return;
    const [comp, { data: buds }, { data: ords }, { data: techs }] = await Promise.all([
      fetchCompany(profile.company_id),
      supabase
        .from("budgets")
        .select("id, company_id, user_id, client_name, client_email, client_phone, title, description, valid_until, labor_cost, created_at, updated_at")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_orders")
        .select("id, company_id, budget_id, user_id, technician_id, client_name, client_email, client_phone, title, service_to_execute, materials_used, technician, status, notes, created_at, updated_at")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, email, name, created_at")
        .eq("company_id", profile.company_id)
        .eq("role", "tecnico")
        .order("created_at", { ascending: false }),
    ]);
    setCompany(comp);
    setBudgets((buds as Budget[]) || []);
    setOrders((ords as ServiceOrder[]) || []);
    setTechnicians((techs as Technician[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [profile?.company_id]);

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-sm text-center">
          {!loading ? (
            <>
              <h2 className="font-semibold text-slate-900">Não foi possível carregar os dados da empresa.</h2>
              <p className="text-sm text-slate-500 mt-1">
                Verifique sua conexão e tente novamente. Se o problema persistir, contate o administrador.
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="secondary" onClick={load}>Tentar novamente</Button>
                <Button variant="ghost" onClick={signOut}>Sair</Button>
              </div>
            </>
          ) : (
            <p className="text-slate-500">Carregando...</p>
          )}
        </div>
      </div>
    );
  }

  if (!company.active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="font-semibold text-slate-900">Conta desativada</h2>
          <p className="text-sm text-slate-500 mt-1">
            O acesso da sua empresa foi desativado pelo administrador. Entre em contato para reativar.
          </p>
          <Button variant="secondary" className="mt-4" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden"
              style={{ backgroundColor: company.primary_color }}
            >
              {company.logo_url ? (
                <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                company.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 leading-tight truncate">{company.name}</h1>
              <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowCustomize(true)}>
              <Palette className="w-4 h-4" /> <span className="hidden sm:inline">Personalizar</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1">
            <TabButton active={tab === "budgets"} onClick={() => setTab("budgets")} icon={<FileText className="w-4 h-4" />} label="Orçamentos" />
            <TabButton active={tab === "orders"} onClick={() => setTab("orders")} icon={<ClipboardList className="w-4 h-4" />} label="Ordens de Serviço" />
            <TabButton active={tab === "technicians"} onClick={() => setTab("technicians")} icon={<HardHat className="w-4 h-4" />} label="Técnicos" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {tab === "budgets" ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Orçamentos</h2>
              <Button size="sm" onClick={() => setEditing({ ...emptyBudget(profile!.company_id!, profile!.id), items: [] })}>
                <Plus className="w-4 h-4" /> Novo orçamento
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
            ) : budgets.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-7 h-7" />}
                title="Nenhum orçamento ainda"
                description="Crie seu primeiro orçamento para enviar aos seus clientes."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {budgets.map((b) => (
                  <BudgetCard
                    key={b.id}
                    budget={b}
                    onEdit={() => loadBudgetForEdit(b.id, setEditing)}
                    onView={() => loadBudgetForView(b.id, setViewing)}
                    onDelete={async () => {
                      if (confirm("Excluir este orçamento?")) {
                        await supabase.from("budgets").delete().eq("id", b.id);
                        load();
                      }
                    }}
                    onCreateOrder={() => loadBudgetForView(b.id, setCreatingOrderFromBudget)}
                  />
                ))}
              </div>
            )}
          </>
        ) : tab === "orders" ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Ordens de Serviço</h2>
              <Button size="sm" onClick={() => setEditingOrder({ ...emptyOrder(profile!.company_id!, profile!.id), photos: [], items: [] })}>
                <Plus className="w-4 h-4" /> Nova O.S.
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="w-7 h-7" />}
                title="Nenhuma ordem de serviço"
                description="Crie uma O.S. a partir de um orçamento aprovado, ou inicie uma nova do zero."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onView={() => loadOrderForView(o.id, setViewingOrder)}
                    onEdit={() => loadOrderForEdit(o.id, setEditingOrder)}
                    onDelete={async () => {
                      if (confirm("Excluir esta ordem de serviço?")) {
                        await supabase.from("service_orders").delete().eq("id", o.id);
                        load();
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Técnicos</h2>
              <Button size="sm" onClick={() => setShowTechnicianForm(true)}>
                <UserPlus className="w-4 h-4" /> Novo técnico
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
            ) : technicians.length === 0 ? (
              <EmptyState
                icon={<HardHat className="w-7 h-7" />}
                title="Nenhum técnico cadastrado"
                description="Cadastre técnicos para designá-los às ordens de serviço."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {technicians.map((t) => {
                  const displayName = t.name || t.email;
                  return (
                  <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                          <HardHat className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 leading-tight truncate">{displayName}</h3>
                          {t.name && <p className="text-xs text-slate-500 mt-0.5 truncate">{t.email}</p>}
                          <p className="text-xs text-slate-400 mt-0.5">Cadastrado em {formatDate(t.created_at)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="secondary" size="sm" onClick={() => setResetTech(t)}>
                        <KeyRound className="w-3.5 h-3.5" /> Alterar senha
                      </Button>
                      <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={async () => {
                        if (confirm(`Excluir o técnico ${displayName}?`)) {
                          const { error } = await callAdmin("delete-technician", { user_id: t.id });
                          if (error) { alert(error); return; }
                          load();
                        }
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {editing && (
        <BudgetEditor
          budget={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {viewing && <BudgetPreview budget={viewing} company={company} onClose={() => setViewing(null)} />}
      {creatingOrderFromBudget && (
        <CreateOrderFromBudgetModal
          budget={creatingOrderFromBudget}
          company={company}
          technicians={technicians}
          onClose={() => setCreatingOrderFromBudget(null)}
          onCreated={() => { setCreatingOrderFromBudget(null); setTab("orders"); load(); }}
        />
      )}
      {editingOrder && (
        <ServiceOrderEditor
          order={editingOrder}
          technicians={technicians}
          onClose={() => setEditingOrder(null)}
          onSaved={() => { setEditingOrder(null); load(); }}
        />
      )}
      {viewingOrder && (
        <ServiceOrderPreview
          order={viewingOrder}
          company={company}
          onClose={() => setViewingOrder(null)}
        />
      )}
      {showCustomize && (
        <CustomizePanel
          company={company}
          onClose={() => setShowCustomize(false)}
          onSaved={(c) => { setCompany(c); setShowCustomize(false); }}
        />
      )}
      {showTechnicianForm && (
        <TechnicianFormModal
          onClose={() => setShowTechnicianForm(false)}
          onCreated={() => { setShowTechnicianForm(false); load(); }}
        />
      )}
      {resetTech && (
        <ResetTechnicianPasswordModal
          technician={resetTech}
          onClose={() => setResetTech(null)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
        active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function emptyBudget(companyId: string, userId: string): Budget {
  return {
    id: "", company_id: companyId, user_id: userId,
    client_name: "", client_email: null, client_phone: null,
    title: "", description: null, valid_until: null, labor_cost: 0,
    created_at: "", updated_at: "",
  };
}

function emptyOrder(companyId: string, userId: string): ServiceOrder {
  return {
    id: "", company_id: companyId, budget_id: null, user_id: userId, technician_id: null,
    client_name: "", client_email: null, client_phone: null,
    title: "", service_to_execute: null, materials_used: [],
    technician: null, status: "draft", notes: null,
    created_at: "", updated_at: "",
  };
}

async function loadBudgetForEdit(id: string, setEditing: (b: BudgetWithItems) => void) {
  const { data: bud } = await supabase
    .from("budgets")
    .select("id, company_id, user_id, client_name, client_email, client_phone, title, description, valid_until, labor_cost, created_at, updated_at")
    .eq("id", id).maybeSingle();
  if (!bud) return;
  const [{ data: items }, { data: photos }] = await Promise.all([
    supabase.from("budget_items").select("id, budget_id, description, quantity, unit, unit_price, created_at").eq("budget_id", id).order("created_at", { ascending: true }),
    supabase.from("budget_photos").select("id, budget_id, storage_path, position, created_at").eq("budget_id", id).order("position", { ascending: true }),
  ]);
  setEditing({ ...(bud as Budget), items: (items as BudgetItem[]) || [], photos: (photos as BudgetPhoto[]) || [] });
}

async function loadBudgetForView(id: string, setViewing: (b: BudgetWithItems) => void) {
  await loadBudgetForEdit(id, setViewing);
}

async function loadOrderForEdit(id: string, setEditing: (o: ServiceOrderWithItems) => void) {
  const { data: ord } = await supabase
    .from("service_orders")
    .select("id, company_id, budget_id, user_id, technician_id, client_name, client_email, client_phone, title, service_to_execute, materials_used, technician, status, notes, created_at, updated_at")
    .eq("id", id).maybeSingle();
  if (!ord) return;
  const [{ data: photos }, { data: items }] = await Promise.all([
    supabase
      .from("service_order_photos")
      .select("id, service_order_id, storage_path, kind, position, created_at")
      .eq("service_order_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("service_order_items")
      .select("id, service_order_id, description, quantity, unit, created_at")
      .eq("service_order_id", id)
      .order("created_at", { ascending: true }),
  ]);
  setEditing({ ...(ord as ServiceOrder), photos: (photos as ServiceOrderPhoto[]) || [], items: (items as ServiceOrderItem[]) || [] });
}

async function loadOrderForView(id: string, setViewing: (o: ServiceOrderWithItems) => void) {
  await loadOrderForEdit(id, setViewing);
}

function BudgetCard({
  budget, onEdit, onView, onDelete, onCreateOrder,
}: {
  budget: Budget;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onCreateOrder: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 leading-tight truncate">{budget.title || "Sem título"}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Cliente: {budget.client_name}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
        <span>{formatDate(budget.created_at)}</span>
        {budget.valid_until && <span>Válido até {formatDate(budget.valid_until)}</span>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={onView}><Eye className="w-3.5 h-3.5" /> Visualizar</Button>
        <Button variant="secondary" size="sm" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /> Editar</Button>
        <Button variant="secondary" size="sm" onClick={onCreateOrder}><Wrench className="w-3.5 h-3.5" /> Criar O.S.</Button>
        <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

function OrderCard({
  order, onView, onEdit, onDelete,
}: {
  order: ServiceOrder;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusStyles: Record<ServiceOrderStatus, string> = {
    draft: "bg-slate-100 text-slate-600 border-slate-200",
    in_progress: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 leading-tight truncate">{order.title || "Sem título"}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Cliente: {order.client_name}</p>
        </div>
        <Badge className={statusStyles[order.status]}>{serviceOrderStatusLabel(order.status)}</Badge>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
        <span>{formatDate(order.created_at)}</span>
        {order.technician && <span>Técnico: {order.technician}</span>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={onView}><Eye className="w-3.5 h-3.5" /> Visualizar</Button>
        <Button variant="secondary" size="sm" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /> Editar</Button>
        <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

/* ============ Budget Editor (with photos) ============ */

function BudgetEditor({
  budget, onClose, onSaved,
}: {
  budget: BudgetWithItems;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Budget>(budget);
  const [items, setItems] = useState<BudgetItem[]>(budget.items);
  const [photos, setPhotos] = useState<BudgetPhoto[]>(budget.photos || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsTotal = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);
  const laborCost = Number(form.labor_cost) || 0;
  const total = itemsTotal + laborCost;

  function updateItem(idx: number, patch: Partial<BudgetItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { id: "", budget_id: budget.id, description: "", quantity: 1, unit: "un", unit_price: 0, created_at: "" }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || !files.length || !budget.id) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          setError("Cada foto deve ter no máximo 5MB.");
          continue;
        }
        const { path, error: upErr } = await uploadBudgetPhoto(budget.id, file);
        if (upErr || !path) { setError(upErr || "Falha ao enviar foto."); continue; }
        const { data: row, error: insErr } = await supabase
          .from("budget_photos")
          .insert({ budget_id: budget.id, storage_path: path, position: photos.length })
          .select("id, budget_id, storage_path, position, created_at")
          .maybeSingle();
        if (insErr || !row) { setError(insErr?.message || "Falha ao salvar foto."); continue; }
        setPhotos((prev) => [...prev, row as BudgetPhoto]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo: BudgetPhoto) {
    await deleteStorageObject("budget-photos", photo.storage_path);
    await supabase.from("budget_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      let budgetId = budget.id;
      if (budgetId) {
        const { error: uErr } = await supabase
          .from("budgets")
          .update({
            client_name: form.client_name, client_email: form.client_email, client_phone: form.client_phone,
            title: form.title, description: form.description, valid_until: form.valid_until || null,
            labor_cost: Number(form.labor_cost) || 0,
          })
          .eq("id", budgetId);
        if (uErr) throw uErr;
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from("budgets")
          .insert({
            company_id: form.company_id, user_id: form.user_id,
            client_name: form.client_name, client_email: form.client_email, client_phone: form.client_phone,
            title: form.title, description: form.description, valid_until: form.valid_until || null,
            labor_cost: Number(form.labor_cost) || 0,
          })
          .select().single();
        if (iErr) throw iErr;
        budgetId = (inserted as Budget).id;
      }

      if (budgetId) {
        await supabase.from("budget_items").delete().eq("budget_id", budgetId);
      }
      const valid = items.filter((it) => it.description.trim());
      if (valid.length) {
        const { error: itemsErr } = await supabase
          .from("budget_items")
          .insert(valid.map((it) => ({
            budget_id: budgetId, description: it.description,
            quantity: Number(it.quantity) || 0, unit: it.unit || "un", unit_price: Number(it.unit_price) || 0,
          })));
        if (itemsErr) throw itemsErr;
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title={budget.id ? "Editar orçamento" : "Novo orçamento"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Título</Label>
          <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Orçamento de reforma" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Cliente</Label>
            <Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label>E-mail do cliente</Label>
            <Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="cliente@email.com" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.client_phone || ""} onChange={(e) => setForm({ ...form, client_phone: formatPhone(e.target.value) })} placeholder="(00) 00000-0000" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Válido até</Label>
            <Input type="date" value={form.valid_until || ""} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </div>
          <div>
            <LongTextField label="Descrição / Observações" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Observações gerais — toque para escrever" />
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Itens</Label>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
          </div>
          <div className="space-y-2">
            {items.length === 0 && <p className="text-sm text-slate-400">Nenhum item adicionado.</p>}
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg p-2">
                <input
                  className="col-span-12 sm:col-span-4 px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="Descrição"
                  value={it.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value.toUpperCase() })}
                />
                <input
                  type="number" min="0" step="any"
                  className="col-span-3 sm:col-span-2 px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="Qtd" value={it.quantity === 0 ? "" : it.quantity}
                  onFocus={(e) => { if (it.quantity === 0) e.target.value = ""; }}
                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                />
                <select
                  className="col-span-3 sm:col-span-2 px-1 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  value={it.unit} onChange={(e) => updateItem(idx, { unit: e.target.value })}
                >
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <MoneyInput
                  className="col-span-3 sm:col-span-2 px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="Valor"
                  value={Number(it.unit_price)}
                  onValueChange={(v) => updateItem(idx, { unit_price: v })}
                />
                <div className="col-span-2 sm:col-span-1 text-right text-sm font-medium text-slate-700">
                  {formatCurrency(Number(it.quantity) * Number(it.unit_price))}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeItem(idx)} className="text-slate-400 hover:text-rose-600 transition p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Mão de obra — fixed field */}
          <div className="flex items-center justify-between gap-3 mt-2 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm font-semibold text-slate-800">MÃO DE OBRA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">R$</span>
              <MoneyInput
                className="w-28 px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                value={laborCost}
                onValueChange={(v) => setForm({ ...form, labor_cost: v })}
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col">
                <span className="text-xs text-slate-400">Itens</span>
                <span className="text-sm text-slate-600">{formatCurrency(itemsTotal)}</span>
            </div>
            {laborCost > 0 && (
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">Mão de obra</span>
                <span className="text-sm text-slate-600">{formatCurrency(laborCost)}</span>
              </div>
            )}
            <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-slate-600">Total</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Photos */}
        {budget.id && (
          <PhotoUploader
            label="Fotos do orçamento"
            photos={photos.map((p) => ({ id: p.id, url: publicBudgetPhotoUrl(p.storage_path) }))}
            uploading={uploading}
            onAdd={handlePhotoFiles}
            onRemove={(id) => { const ph = photos.find((p) => p.id === id); if (ph) removePhoto(ph); }}
            disabled={!budget.id}
            emptyHint="Salve o orçamento primeiro para poder anexar fotos."
          />
        )}

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.title || !form.client_name}>{saving ? "Salvando..." : "Salvar orçamento"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============ Budget Preview ============ */

function BudgetPreview({
  budget, company, onClose,
}: {
  budget: BudgetWithItems;
  company: Company;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const laborCost = Number(budget.labor_cost) || 0;
  const itemsTotal = budget.items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);
  const total = itemsTotal + laborCost;
  const photos = budget.photos || [];

  function share() {
    const lines = [
      `Orçamento: ${budget.title}`,
      `Empresa: ${company.name}`,
      `Cliente: ${budget.client_name}`,
      "",
      ...budget.items.map((it) => `- ${it.description} × ${it.quantity} ${it.unit || "un"} = ${formatCurrency(Number(it.quantity) * Number(it.unit_price))}`),
      laborCost > 0 ? `- MÃO DE OBRA = ${formatCurrency(laborCost)}` : "",
      "",
      `Total: ${formatCurrency(total)}`,
      budget.valid_until ? `Válido até: ${formatDate(budget.valid_until)}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const [exporting, setExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function exportPdf() {
    setExporting(true);
    setPdfError(null);
    try {
      await generateBudgetPdf(budget, company);
    } catch (err) {
      setPdfError("Não foi possível gerar o PDF. Tente novamente.");
      console.error("PDF export error:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal title="Visualização do orçamento" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden" style={{ backgroundColor: company.primary_color }}>
            {company.logo_url ? <img src={company.logo_url} alt="" className="w-full h-full object-cover" /> : company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-900">{company.name}</div>
            <div className="text-xs text-slate-500">Orçamento</div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 text-lg">{budget.title}</h3>
          {budget.description && <p className="text-sm text-slate-600 mt-1">{budget.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">Cliente</div>
            <div className="font-medium text-slate-900">{budget.client_name}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">Válido até</div>
            <div className="font-medium text-slate-900">{formatDate(budget.valid_until)}</div>
          </div>
          {budget.client_email && (
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">E-mail</div>
              <div className="font-medium text-slate-900 truncate">{budget.client_email}</div>
            </div>
          )}
          {budget.client_phone && (
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">Telefone</div>
              <div className="font-medium text-slate-900">{budget.client_phone}</div>
            </div>
          )}
        </div>

        <div>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Descrição</th>
                  <th className="text-right px-3 py-2 font-medium">Qtd</th>
                  <th className="text-center px-3 py-2 font-medium">Un.</th>
                  <th className="text-right px-3 py-2 font-medium">Valor</th>
                  <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budget.items.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-slate-400">Sem itens</td></tr>
                ) : (
                  budget.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-slate-700">{it.description}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{it.quantity}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{it.unit || "un"}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(Number(it.unit_price))}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(Number(it.quantity) * Number(it.unit_price))}</td>
                    </tr>
                  ))
                )}
                {laborCost > 0 && (
                  <tr className="bg-blue-50/50">
                    <td className="px-3 py-2 text-slate-800 font-medium" colSpan={4}>MÃO DE OBRA</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(laborCost)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-medium text-slate-600">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 text-base">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {photos.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2">Fotos anexadas</div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <a key={p.id} href={publicBudgetPhotoUrl(p.storage_path)} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-slate-200">
                  <img src={publicBudgetPhotoUrl(p.storage_path)} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end flex-wrap">
          <Button variant="secondary" onClick={share}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copiado!" : "Copiar texto"}
          </Button>
          <Button variant="secondary" onClick={exportPdf} disabled={exporting}>
            <FileDown className="w-4 h-4" /> {exporting ? "Gerando..." : "Baixar PDF"}
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
        {pdfError && (
          <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 text-right">{pdfError}</div>
        )}
      </div>
    </Modal>
  );
}

/* ============ Create Order from Budget ============ */

function CreateOrderFromBudgetModal({
  budget, company, technicians, onClose, onCreated,
}: {
  budget: BudgetWithItems;
  company: Company;
  technicians: Technician[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState(`O.S. — ${budget.title}`);
  const [technicianId, setTechnicianId] = useState<string>("");
  const [serviceToExecute, setServiceToExecute] = useState(budget.description || "");
  const [materials] = useState<string[]>(buildMaterialLines(budget.items));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!technicianId) {
      setError("Selecione um técnico cadastrado.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const chosenTech = technicians.find((t) => t.id === technicianId);
      const { data: ord, error: insErr } = await supabase
        .from("service_orders")
        .insert({
          company_id: budget.company_id,
          budget_id: budget.id,
          user_id: budget.user_id,
          technician_id: technicianId,
          client_name: budget.client_name,
          client_email: budget.client_email,
          client_phone: budget.client_phone,
          title: title.trim() || `O.S. — ${budget.title}`,
          service_to_execute: serviceToExecute || null,
          materials_used: materials,
          technician: chosenTech?.name || chosenTech?.email || null,
          status: "draft",
        })
        .select("id").single();
      if (insErr || !ord) throw insErr || new Error("Falha ao criar ordem de serviço.");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  const total = budget.items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);

  return (
    <Modal title="Criar ordem de serviço a partir do orçamento" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
          <div className="font-medium mb-0.5">{company.name} → Orçamento aprovado</div>
          <div className="text-blue-700/80 text-xs">Cliente: {budget.client_name} · Total: {formatCurrency(total)}</div>
        </div>

        <div>
          <Label>Título da O.S.</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Técnico responsável</Label>
          {technicians.length === 0 ? (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Cadastre um técnico na aba “Técnicos” antes de criar a ordem de serviço.
            </div>
          ) : (
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            >
              <option value="">Selecione um técnico…</option>
              {technicians.map((t) => <option key={t.id} value={t.id}>{t.name ? `${t.name} — ${t.email}` : t.email}</option>)}
            </select>
          )}
        </div>

        <div>
          <LongTextField label="Serviço a executar" value={serviceToExecute} onChange={setServiceToExecute} placeholder="Descreva o serviço a ser executado — toque para escrever" />
          <p className="text-xs text-slate-400 mt-1">Preenchido com a descrição/observações do orçamento — edite se necessário.</p>
        </div>

        <div>
          <Label>Material utilizado</Label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {materials.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">Nenhum material no orçamento.</div>
            ) : materials.map((m, i) => (
              <div key={i} className="px-3 py-2 text-sm text-slate-700">{m}</div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">Lista de materiais trazida do orçamento.</p>
        </div>

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={create} disabled={creating}>{creating ? "Criando..." : "Criar ordem de serviço"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============ Service Order Editor ============ */

function ServiceOrderEditor({
  order, technicians, onClose, onSaved,
}: {
  order: ServiceOrderWithItems;
  technicians: Technician[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ServiceOrder>(order);
  const [materials, setMaterials] = useState<string[]>(order.materials_used || []);
  const [items, setItems] = useState<ServiceOrderItem[]>(order.items || []);
  const [newItem, setNewItem] = useState({ description: "", quantity: "1", unit: "un" });
  const [photos, setPhotos] = useState<ServiceOrderPhoto[]>(order.photos || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    const desc = newItem.description.trim();
    if (!desc) return;
    setItems((prev) => [...prev, {
      id: `tmp-${Date.now()}`,
      service_order_id: order.id,
      description: desc,
      quantity: Number(newItem.quantity) || 1,
      unit: newItem.unit || "un",
      created_at: new Date().toISOString(),
    }]);
    setNewItem({ description: "", quantity: "1", unit: "un" });
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePhotoFiles(files: FileList | null, kind: "before" | "after") {
    if (!files || !files.length || !order.id) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) { setError("Cada foto deve ter no máximo 5MB."); continue; }
        const { path, error: upErr } = await uploadServiceOrderPhoto(order.id, file);
        if (upErr || !path) { setError(upErr || "Falha ao enviar foto."); continue; }
        const sameKind = photos.filter((p) => p.kind === kind);
        const { data: row, error: insErr } = await supabase
          .from("service_order_photos")
          .insert({ service_order_id: order.id, storage_path: path, kind, position: sameKind.length })
          .select("id, service_order_id, storage_path, kind, position, created_at")
          .maybeSingle();
        if (insErr || !row) { setError(insErr?.message || "Falha ao salvar foto."); continue; }
        setPhotos((prev) => [...prev, row as ServiceOrderPhoto]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo: ServiceOrderPhoto) {
    await deleteStorageObject("service-order-photos", photo.storage_path);
    await supabase.from("service_order_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function persistItems(orderId: string) {
    const existing = (order.items || []).filter((it) => !it.id.startsWith("tmp-"));
    const newItems = items.filter((it) => it.id.startsWith("tmp-"));
    const keptIds = new Set(items.filter((it) => !it.id.startsWith("tmp-")).map((it) => it.id));
    const toDelete = existing.filter((it) => !keptIds.has(it.id));

    if (toDelete.length) {
      await supabase.from("service_order_items").delete().in("id", toDelete.map((it) => it.id));
    }
    if (newItems.length) {
      const { error: insErr } = await supabase
        .from("service_order_items")
        .insert(newItems.map((it) => ({
          service_order_id: orderId,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
        })));
      if (insErr) throw insErr;
    }
  }

  async function save() {
    if (!form.technician_id) {
      setError("Selecione um técnico cadastrado.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const chosenTech = technicians.find((t) => t.id === form.technician_id);
      const payload = {
        client_name: form.client_name, client_email: form.client_email, client_phone: form.client_phone,
        title: form.title, service_to_execute: form.service_to_execute, materials_used: materials,
        technician_id: form.technician_id, technician: chosenTech?.email || form.technician,
        status: form.status, notes: form.notes,
      };
      let orderId = order.id;
      if (order.id) {
        const { error: uErr } = await supabase.from("service_orders").update(payload).eq("id", order.id);
        if (uErr) throw uErr;
        await persistItems(order.id);
      } else {
        const { data: ord, error: iErr } = await supabase
          .from("service_orders")
          .insert({ ...payload, company_id: form.company_id, user_id: form.user_id, budget_id: form.budget_id })
          .select("id").single();
        if (iErr || !ord) throw iErr;
        orderId = ord.id;
        await persistItems(orderId);
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const beforePhotos = photos.filter((p) => p.kind === "before");
  const afterPhotos = photos.filter((p) => p.kind === "after");

  return (
    <Modal title={order.id ? "Editar ordem de serviço" : "Nova ordem de serviço"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Título</Label>
          <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Instalação elétrica" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Cliente</Label>
            <Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label>E-mail do cliente</Label>
            <Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="cliente@email.com" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.client_phone || ""} onChange={(e) => setForm({ ...form, client_phone: formatPhone(e.target.value) })} placeholder="(00) 00000-0000" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Técnico responsável</Label>
            {technicians.length === 0 ? (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Cadastre um técnico na aba “Técnicos” antes de criar a ordem de serviço.
              </div>
            ) : (
              <select
                value={form.technician_id || ""}
                onChange={(e) => setForm({ ...form, technician_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              >
                <option value="">Selecione um técnico…</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name ? `${t.name} — ${t.email}` : t.email}</option>)}
              </select>
            )}
          </div>
          <div>
            <Label>Status</Label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ServiceOrderStatus })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            >
              {SERVICE_ORDER_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <LongTextField label="Serviço a executar" value={form.service_to_execute} onChange={(v) => setForm({ ...form, service_to_execute: v })} placeholder="Descreva o serviço a ser executado — toque para escrever" />
        </div>

        {materials.length > 0 && (
          <div>
            <Label>Material previsto (do orçamento)</Label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100 max-h-32 overflow-y-auto">
              {materials.map((m, i) => <div key={i} className="px-3 py-2 text-sm text-slate-700">{m}</div>)}
            </div>
          </div>
        )}

        <div>
          <Label>Material utilizado na execução</Label>
          <div className="grid grid-cols-12 gap-2 mb-2">
            <input
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value.toUpperCase() })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder="Descrição"
              className="col-span-6 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            />
            <input
              type="number"
              min="0"
              step="any"
              value={newItem.quantity === "0" ? "" : newItem.quantity}
              onFocus={(e) => { if (Number(newItem.quantity) === 0) e.target.value = ""; }}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
              placeholder="Qtd"
              className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            />
            <select
              value={newItem.unit}
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="col-span-2 px-2 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            >
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <Button type="button" variant="secondary" size="sm" className="col-span-2" onClick={addItem}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">Nenhum material adicionado.</div>
            ) : items.map((it, i) => (
              <div key={i} className="px-3 py-2 text-sm text-slate-700 flex items-center justify-between">
                <span>{it.description} — {it.quantity} {it.unit}</span>
                <button type="button" onClick={() => removeItem(i)} className="text-slate-400 hover:text-rose-600 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <LongTextField label="Observações" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Notas adicionais sobre o serviço — toque para escrever" />
        </div>

        {order.id && (
          <>
            <PhotoUploader
              label="Fotos — ANTES"
              photos={beforePhotos.map((p) => ({ id: p.id, url: publicServiceOrderPhotoUrl(p.storage_path) }))}
              uploading={uploading}
              onAdd={(files) => handlePhotoFiles(files, "before")}
              onRemove={(id) => { const ph = beforePhotos.find((p) => p.id === id); if (ph) removePhoto(ph); }}
              capture="environment"
            />
            <PhotoUploader
              label="Fotos — DEPOIS"
              photos={afterPhotos.map((p) => ({ id: p.id, url: publicServiceOrderPhotoUrl(p.storage_path) }))}
              uploading={uploading}
              onAdd={(files) => handlePhotoFiles(files, "after")}
              onRemove={(id) => { const ph = afterPhotos.find((p) => p.id === id); if (ph) removePhoto(ph); }}
              capture="environment"
            />
          </>
        )}

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.title || !form.client_name}>{saving ? "Salvando..." : "Salvar O.S."}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============ Service Order Preview ============ */

function ServiceOrderPreview({
  order, company, onClose,
}: {
  order: ServiceOrderWithPhotos;
  company: Company;
  onClose: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [items, setItems] = useState<ServiceOrderItem[]>(order.items || []);
  const beforePhotos = (order.photos || []).filter((p) => p.kind === "before");
  const afterPhotos = (order.photos || []).filter((p) => p.kind === "after");

  useEffect(() => {
    if (!order.id) return;
    (async () => {
      const { data } = await supabase
        .from("service_order_items")
        .select("id, service_order_id, description, quantity, unit, created_at")
        .eq("service_order_id", order.id)
        .order("created_at", { ascending: true });
      if (data) setItems(data as ServiceOrderItem[]);
    })();
  }, [order.id]);

  async function exportPdf() {
    setExporting(true);
    setPdfError(null);
    try {
      await generateServiceOrderPdf({ ...order, items }, company);
    } catch (err) {
      setPdfError("Não foi possível gerar o relatório. Tente novamente.");
      console.error("OS PDF export error:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal title="Visualização da ordem de serviço" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden" style={{ backgroundColor: company.primary_color }}>
            {company.logo_url ? <img src={company.logo_url} alt="" className="w-full h-full object-cover" /> : company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-900">{company.name}</div>
            <div className="text-xs text-slate-500">Ordem de Serviço</div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-lg">{order.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">Cliente: {order.client_name}</p>
          </div>
          <Badge className="bg-slate-100 text-slate-600 border-slate-200">{serviceOrderStatusLabel(order.status)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">Técnico</div>
            <div className="font-medium text-slate-900">{order.technician || "—"}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">Emitido em</div>
            <div className="font-medium text-slate-900">{formatDate(order.created_at)}</div>
          </div>
        </div>

        {order.service_to_execute && (
          <div>
            <div className="text-xs text-slate-500 mb-1">Serviço a executar</div>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{order.service_to_execute}</p>
          </div>
        )}

        {order.materials_used && order.materials_used.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-1">Material utilizado</div>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              {order.materials_used.map((m, i) => <div key={i} className="px-3 py-2 text-sm text-slate-700">{m}</div>)}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-1">Materiais complementares</div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 divide-y divide-blue-100">
              {items.map((it, i) => (
                <div key={i} className="px-3 py-2 text-sm text-slate-700 flex items-center justify-between">
                  <span>{it.description}</span>
                  <span className="text-slate-500">{it.quantity} {it.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {order.notes && (
          <div>
            <div className="text-xs text-slate-500 mb-1">Observações</div>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {beforePhotos.length > 0 && (
          <PhotoGallery label="ANTES" photos={beforePhotos.map((p) => publicServiceOrderPhotoUrl(p.storage_path))} />
        )}
        {afterPhotos.length > 0 && (
          <PhotoGallery label="DEPOIS" photos={afterPhotos.map((p) => publicServiceOrderPhotoUrl(p.storage_path))} />
        )}

        <div className="flex gap-2 justify-end flex-wrap">
          <Button variant="secondary" onClick={exportPdf} disabled={exporting}>
            <FileDown className="w-4 h-4" /> {exporting ? "Gerando..." : "Baixar relatório PDF"}
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
        {pdfError && (
          <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 text-right">{pdfError}</div>
        )}
      </div>
    </Modal>
  );
}

/* ============ Shared photo components ============ */

function PhotoUploader({
  label, photos, uploading, onAdd, onRemove, disabled, emptyHint, capture,
}: {
  label: string;
  photos: { id: string; url: string }[];
  uploading: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  emptyHint?: string;
  capture?: "environment" | "user";
}) {
  const inputId = `photo-input-${label.replace(/\s/g, "-").toLowerCase()}`;
  return (
    <div>
      <Label>{label}</Label>
      {disabled ? (
        <p className="text-xs text-slate-400">{emptyHint || "Salve primeiro para anexar fotos."}</p>
      ) : (
        <>
          <div className="flex gap-2 mb-2">
            <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition cursor-pointer">
              {uploading ? "Enviando..." : <><Camera className="w-3.5 h-3.5" /> Tirar foto</>}
              <input id={inputId} type="file" accept="image/*" capture={capture} className="hidden" onChange={(e) => onAdd(e.target.files)} disabled={uploading} />
            </label>
            <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Galeria
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onAdd(e.target.files)} disabled={uploading} />
            </label>
          </div>
          {photos.length === 0 ? (
            <p className="text-xs text-slate-400">{emptyHint || "Nenhuma foto."}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PhotoGallery({ label, photos }: { label: string; photos: string[] }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-2">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-slate-200">
            <img src={url} alt="" className="w-full h-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}

/* ============ Customize Panel (unchanged) ============ */

function CustomizePanel({
  company, onClose, onSaved,
}: {
  company: Company;
  onClose: () => void;
  onSaved: (c: Company) => void;
}) {
  const [name, setName] = useState(company.name);
  const [color, setColor] = useState(company.primary_color);
  const [logoUrl, setLogoUrl] = useState(company.logo_url || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("O logo deve ter no máximo 2MB."); return; }
    setUploading(true);
    setError(null);
    const { url, error: upErr } = await uploadCompanyLogo(company.id, file);
    setUploading(false);
    if (upErr || !url) { setError(upErr || "Falha ao enviar logo."); return; }
    setLogoUrl(url);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("companies")
      .update({ name, primary_color: color, logo_url: logoUrl || null })
      .eq("id", company.id)
      .select("id, name, active, primary_color, logo_url, created_at")
      .maybeSingle();
    setSaving(false);
    if (error || !data) { setError(error?.message || "Falha ao salvar."); return; }
    onSaved(data as Company);
  }

  return (
    <Modal title="Personalizar aparência" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Nome da empresa</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <Label>Logo da empresa</Label>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden border border-slate-200" style={{ backgroundColor: color }}>
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 opacity-60" />}
            </div>
            <label className="flex-1 cursor-pointer">
              <span className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-sm font-medium transition">
                {uploading ? "Enviando..." : <><Upload className="w-4 h-4" /> Carregar logo</>}
              </span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
            </label>
            {logoUrl && (
              <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => setLogoUrl("")}>
                <X className="w-4 h-4" /> Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">PNG, JPG ou WEBP até 2MB. Aparece no orçamento e no topo do app.</p>
        </div>

        <div>
          <Label>Cor da marca</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
          </div>
          <div className="flex gap-2 mt-2">
            {["#2563eb", "#0891b2", "#059669", "#dc2626", "#ea580c", "#4f46e5", "#0f172a"].map((c) => (
              <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-200 transition hover:scale-110" style={{ backgroundColor: c }} aria-label={`Cor ${c}`} />
            ))}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-2">Pré-visualização</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-slate-900">{name}</span>
          </div>
        </div>

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || uploading}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function TechnicianFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await callAdmin("create-technician", { email: email.trim(), password, name: name.trim() });
    setSubmitting(false);
    if (error) { setError(error); return; }
    onCreated();
    onClose();
  }

  return (
    <Modal title="Novo técnico" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">
          O técnico poderá criar orçamentos sem valores e executar as ordens de serviço designadas a ele.
        </p>
        <div>
          <Label>Nome do técnico</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" />
        </div>
        <div>
          <Label>E-mail de acesso</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tecnico@empresa.com" />
        </div>
        <div>
          <Label>Senha inicial</Label>
          <Input type="text" preserveCase required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
        </div>
        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar técnico"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetTechnicianPasswordModal({ technician, onClose }: { technician: Technician; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await callAdmin("reset-technician-password", { user_id: technician.id, new_password: password });
    setSubmitting(false);
    if (error) { setError(error); return; }
    setDone(true);
  }

  return (
    <Modal title={`Alterar senha — ${technician.name || technician.email}`} onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="font-medium text-slate-900">Senha alterada com sucesso.</p>
          <Button className="mt-4" onClick={onClose}>Fechar</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
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
