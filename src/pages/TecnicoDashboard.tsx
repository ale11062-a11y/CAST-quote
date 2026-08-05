import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  fetchCompany, formatDate, uploadServiceOrderPhoto, publicServiceOrderPhotoUrl,
  publicBudgetPhotoUrl, deleteStorageObject,
} from "@/lib/api";
import type {
  Budget, BudgetItem, BudgetPhoto, BudgetWithItems, Company,
  ServiceOrder, ServiceOrderItem, ServiceOrderPhoto, ServiceOrderStatus, ServiceOrderWithItems,
} from "@/lib/types";
import { UNIT_OPTIONS, SERVICE_ORDER_STATUS, serviceOrderStatusLabel } from "@/lib/types";
import { generateServiceOrderPdf } from "@/lib/pdf";
import { Button, EmptyState, Input, Label, Modal, Badge, Textarea, LongTextField, formatPhone } from "@/components/ui";
import {
  FileText, Plus, Pencil, Trash2, LogOut, Eye, X, FileDown, Upload,
  Image as ImageIcon, Camera, ClipboardList, Wrench, HardHat,
} from "lucide-react";

type Tab = "budgets" | "orders";

export default function TecnicoDashboard() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("budgets");
  const [company, setCompany] = useState<Company | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BudgetWithItems | null>(null);
  const [viewing, setViewing] = useState<BudgetWithItems | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrderWithItems | null>(null);
  const [viewingOrder, setViewingOrder] = useState<ServiceOrderWithItems | null>(null);

  async function load() {
    if (!profile?.company_id) return;
    const [comp, { data: buds }, { data: ords }] = await Promise.all([
      fetchCompany(profile.company_id),
      supabase
        .from("budgets")
        .select("id, company_id, user_id, client_name, client_email, client_phone, title, description, valid_until, labor_cost, created_at, updated_at")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_orders")
        .select("id, company_id, budget_id, user_id, technician_id, client_name, client_email, client_phone, title, service_to_execute, materials_used, technician, status, notes, created_at, updated_at")
        .eq("technician_id", profile.id)
        .order("created_at", { ascending: false }),
    ]);
    setCompany(comp);
    setBudgets((buds as Budget[]) || []);
    setOrders((ords as ServiceOrder[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function emptyBudget(): BudgetWithItems {
    return {
      id: "", company_id: profile!.company_id!, user_id: profile!.id,
      client_name: "", client_email: null, client_phone: null,
      title: "", description: null, valid_until: null,
      created_at: "", updated_at: "", items: [],
    };
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: company?.primary_color || "#2563eb" }}>
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">{company?.name || "Painel do Técnico"}</h1>
              <p className="text-xs text-slate-500">{profile?.name ? `${profile.name} · ${profile?.email}` : profile?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 -mb-px">
          <TabButton active={tab === "budgets"} onClick={() => setTab("budgets")} icon={<FileText className="w-4 h-4" />} label="Orçamentos" />
          <TabButton active={tab === "orders"} onClick={() => setTab("orders")} icon={<ClipboardList className="w-4 h-4" />} label="Minhas Ordens" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {tab === "budgets" ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Orçamentos</h2>
              <Button size="sm" onClick={() => setEditing(emptyBudget())}>
                <Plus className="w-4 h-4" /> Novo orçamento
              </Button>
            </div>
            {loading ? (
              <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
            ) : budgets.length === 0 ? (
              <EmptyState icon={<FileText className="w-7 h-7" />} title="Nenhum orçamento"
                description="Crie um orçamento com a descrição dos serviços e materiais." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {budgets.map((b) => (
                  <BudgetCardTecnico key={b.id} budget={b}
                    onEdit={() => loadBudgetForEdit(b.id, setEditing)}
                    onView={() => loadBudgetForView(b.id, setViewing)}
                    onDelete={async () => {
                      if (confirm("Excluir este orçamento?")) {
                        await supabase.from("budgets").delete().eq("id", b.id);
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
              <h2 className="text-lg font-semibold text-slate-900">Minhas Ordens de Serviço</h2>
            </div>
            {loading ? (
              <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
            ) : orders.length === 0 ? (
              <EmptyState icon={<ClipboardList className="w-7 h-7" />} title="Nenhuma ordem designada"
                description="As ordens de serviço que a empresa designar a você aparecerão aqui." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders.map((o) => (
                  <OrderCardTecnico key={o.id} order={o}
                    onView={() => loadOrderForView(o.id, setViewingOrder)}
                    onExecute={() => loadOrderForEdit(o.id, setEditingOrder)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {editing && (
        <TecnicoBudgetEditor budget={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
      {viewing && <TecnicoBudgetPreview budget={viewing} company={company} onClose={() => setViewing(null)} />}
      {editingOrder && (
        <TecnicoOrderExecutor order={editingOrder} onClose={() => setEditingOrder(null)}
          onSaved={() => { setEditingOrder(null); load(); }} />
      )}
      {viewingOrder && (
        <OrderView order={viewingOrder} company={company} onClose={() => setViewingOrder(null)} />
      )}
    </div>
  );
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
    supabase.from("service_order_photos").select("id, service_order_id, storage_path, kind, position, created_at").eq("service_order_id", id).order("position", { ascending: true }),
    supabase.from("service_order_items").select("id, service_order_id, description, quantity, unit, created_at").eq("service_order_id", id).order("created_at", { ascending: true }),
  ]);
  setEditing({ ...(ord as ServiceOrder), photos: (photos as ServiceOrderPhoto[]) || [], items: (items as ServiceOrderItem[]) || [] });
}

async function loadOrderForView(id: string, setViewing: (o: ServiceOrderWithItems) => void) {
  await loadOrderForEdit(id, setViewing);
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
      {icon} {label}
    </button>
  );
}

function BudgetCardTecnico({ budget, onEdit, onView, onDelete }: {
  budget: Budget; onEdit: () => void; onView: () => void; onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-900 leading-tight">{budget.title}</h3>
        <Badge className="bg-slate-100 text-slate-600 border-slate-200">Orçamento</Badge>
      </div>
      <p className="text-sm text-slate-500 mb-3">{budget.client_name} · {formatDate(budget.created_at)}</p>
      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={onView}><Eye className="w-3.5 h-3.5" /> Ver</Button>
        <Button variant="secondary" size="sm" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /> Editar</Button>
        <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

function OrderCardTecnico({ order, onView, onExecute }: {
  order: ServiceOrder; onView: () => void; onExecute: () => void;
}) {
  const statusColor =
    order.status === "completed" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    order.status === "in_progress" ? "bg-amber-100 text-amber-700 border-amber-200" :
    order.status === "cancelled" ? "bg-rose-100 text-rose-700 border-rose-200" :
    "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-200/50 transition">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-900 leading-tight">{order.title}</h3>
        <Badge className={statusColor}>{serviceOrderStatusLabel(order.status)}</Badge>
      </div>
      <p className="text-sm text-slate-500 mb-3">{order.client_name} · {formatDate(order.created_at)}</p>
      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={onView}><Eye className="w-3.5 h-3.5" /> Ver</Button>
        <Button size="sm" onClick={onExecute}><Wrench className="w-3.5 h-3.5" /> Executar</Button>
      </div>
    </div>
  );
}

function TecnicoBudgetEditor({ budget, onClose, onSaved }: {
  budget: BudgetWithItems; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Budget>(budget);
  const [items, setItems] = useState<BudgetItem[]>(budget.items || []);
  const [photos, setPhotos] = useState<BudgetPhoto[]>(budget.photos || []);
  const [newItem, setNewItem] = useState({ description: "", quantity: "1", unit: "un" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    const desc = newItem.description.trim();
    if (!desc) return;
    setItems((prev) => [...prev, {
      id: `tmp-${Date.now()}`, budget_id: budget.id,
      description: desc, quantity: Number(newItem.quantity) || 1, unit: newItem.unit || "un",
      unit_price: 0, created_at: new Date().toISOString(),
    }]);
    setNewItem({ description: "", quantity: "1", unit: "un" });
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || !files.length || !budget.id) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) continue;
        const path = `${budget.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`;
        const { error: upErr } = await supabase.storage.from("budget-photos").upload(path, file, { cacheControl: "3600", upsert: true });
        if (upErr) continue;
        const { data: row, error: insErr } = await supabase
          .from("budget_photos")
          .insert({ budget_id: budget.id, storage_path: path, position: photos.length })
          .select("id, budget_id, storage_path, position, created_at").maybeSingle();
        if (insErr || !row) continue;
        setPhotos((prev) => [...prev, row as BudgetPhoto]);
      }
    } finally { setUploading(false); }
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
      if (budget.id) {
        const { error: uErr } = await supabase.from("budgets").update({
          client_name: form.client_name, client_email: form.client_email, client_phone: form.client_phone,
          title: form.title, description: form.description, valid_until: form.valid_until,
        }).eq("id", budget.id);
        if (uErr) throw uErr;
      } else {
        const { data: bud, error: iErr } = await supabase
          .from("budgets")
          .insert({ company_id: form.company_id, user_id: form.user_id, client_name: form.client_name,
            client_email: form.client_email, client_phone: form.client_phone, title: form.title,
            description: form.description, valid_until: form.valid_until, status: "draft" })
          .select("id").single();
        if (iErr || !bud) throw iErr;
        budgetId = bud.id;
      }
      const existing = items.filter((it) => !it.id.startsWith("tmp-"));
      const newItems = items.filter((it) => it.id.startsWith("tmp-"));
      const keptIds = new Set(existing.map((it) => it.id));
      const toDelete = (budget.items || []).filter((it) => !keptIds.has(it.id));
      if (toDelete.length) await supabase.from("budget_items").delete().in("id", toDelete.map((it) => it.id));
      if (newItems.length) {
        const { error: insErr } = await supabase.from("budget_items").insert(
          newItems.map((it) => ({ budget_id: budgetId, description: it.description, quantity: it.quantity, unit: it.unit, unit_price: 0 }))
        );
        if (insErr) throw insErr;
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
          <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Pintura residencial" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Cliente</Label>
            <Input required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="cliente@email.com" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.client_phone || ""} onChange={(e) => setForm({ ...form, client_phone: formatPhone(e.target.value) })} placeholder="(00) 00000-0000" />
          </div>
        </div>
        <div>
          <LongTextField label="Descrição / observações" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Descreva o serviço — toque para escrever" />
        </div>

        <div>
          <Label>Itens do orçamento</Label>
          <div className="grid grid-cols-12 gap-2 mb-2">
            <input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value.toUpperCase() })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder="Descrição" className="col-span-6 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition" />
            <input type="number" min="0" step="any" value={newItem.quantity === "0" ? "" : newItem.quantity}
              onFocus={(e) => { if (Number(newItem.quantity) === 0) e.target.value = ""; }}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} placeholder="Qtd"
              className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition" />
            <select value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="col-span-2 px-2 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition">
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <Button type="button" variant="secondary" size="sm" className="col-span-2" onClick={addItem}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">Nenhum item.</div>
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

        {budget.id && (
          <div>
            <Label>Fotos</Label>
            <PhotoInput uploading={uploading} onAdd={handlePhotoFiles}
              photos={photos.map((p) => ({ id: p.id, url: publicBudgetPhotoUrl(p.storage_path) }))}
              onRemove={(id) => { const ph = photos.find((p) => p.id === id); if (ph) removePhoto(ph); }} />
          </div>
        )}

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.title || !form.client_name}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function TecnicoBudgetPreview({ budget, company, onClose }: {
  budget: BudgetWithItems; company: Company | null; onClose: () => void;
}) {
  const [photos, setPhotos] = useState<BudgetPhoto[]>(budget.photos || []);
  useEffect(() => {
    if (!budget.id) return;
    (async () => {
      const { data } = await supabase
        .from("budget_photos")
        .select("id, budget_id, storage_path, position, created_at")
        .eq("budget_id", budget.id)
        .order("position", { ascending: true });
      if (data) setPhotos(data as BudgetPhoto[]);
    })();
  }, [budget.id]);

  return (
    <Modal title={budget.title} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Cliente</div>
            <div className="font-medium text-slate-900 mt-0.5">{budget.client_name}</div>
            {budget.client_email && <div className="text-xs text-slate-500 mt-0.5">{budget.client_email}</div>}
            {budget.client_phone && <div className="text-xs text-slate-500">{budget.client_phone}</div>}
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Válido até</div>
            <div className="font-medium text-slate-900 mt-0.5">{formatDate(budget.valid_until)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Emitido em {formatDate(budget.created_at)}</div>
          </div>
        </div>
        {budget.description && (
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Descrição</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{budget.description}</p>
          </div>
        )}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Itens</div>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {budget.items.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-400">Nenhum item.</div>
            ) : budget.items.map((it, i) => (
              <div key={i} className="px-3 py-2 text-sm text-slate-700 flex items-center justify-between">
                <span>{it.description}</span>
                <span className="text-slate-500">{it.quantity} {it.unit}</span>
              </div>
            ))}
          </div>
        </div>
        {photos.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Fotos</div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <img key={p.id} src={publicBudgetPhotoUrl(p.storage_path)} alt="" className="w-full h-24 object-cover rounded-lg" />
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}

function TecnicoOrderExecutor({ order, onClose, onSaved }: {
  order: ServiceOrderWithItems; onClose: () => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState<ServiceOrderStatus>(order.status);
  const [notes, setNotes] = useState(order.notes || "");
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
      id: `tmp-${Date.now()}`, service_order_id: order.id,
      description: desc, quantity: Number(newItem.quantity) || 1, unit: newItem.unit || "un",
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
          .select("id, service_order_id, storage_path, kind, position, created_at").maybeSingle();
        if (insErr || !row) { setError(insErr?.message || "Falha ao salvar foto."); continue; }
        setPhotos((prev) => [...prev, row as ServiceOrderPhoto]);
      }
    } finally { setUploading(false); }
  }

  async function removePhoto(photo: ServiceOrderPhoto) {
    await deleteStorageObject("service-order-photos", photo.storage_path);
    await supabase.from("service_order_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function persistItems() {
    const existing = (order.items || []).filter((it) => !it.id.startsWith("tmp-"));
    const newItems = items.filter((it) => it.id.startsWith("tmp-"));
    const keptIds = new Set(items.filter((it) => !it.id.startsWith("tmp-")).map((it) => it.id));
    const toDelete = existing.filter((it) => !keptIds.has(it.id));
    if (toDelete.length) await supabase.from("service_order_items").delete().in("id", toDelete.map((it) => it.id));
    if (newItems.length) {
      const { error: insErr } = await supabase.from("service_order_items").insert(
        newItems.map((it) => ({ service_order_id: order.id, description: it.description, quantity: it.quantity, unit: it.unit }))
      );
      if (insErr) throw insErr;
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { error: uErr } = await supabase
        .from("service_orders")
        .update({ status, notes })
        .eq("id", order.id);
      if (uErr) throw uErr;
      await persistItems();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const beforePhotos = photos.filter((p) => p.kind === "before");
  const afterPhotos = photos.filter((p) => p.kind === "after");

  return (
    <Modal title="Executar ordem de serviço" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="font-semibold text-slate-900">{order.title}</div>
          <div className="text-sm text-slate-500 mt-0.5">{order.client_name} · {formatDate(order.created_at)}</div>
        </div>

        {order.service_to_execute && (
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Serviço a executar</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.service_to_execute}</p>
          </div>
        )}

        {order.materials_used && order.materials_used.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Material previsto</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100">
              {order.materials_used.map((m, i) => <div key={i} className="px-3 py-2 text-sm text-slate-700">{m}</div>)}
            </div>
          </div>
        )}

        <div>
          <Label>Material utilizado</Label>
          <div className="grid grid-cols-12 gap-2 mb-2">
            <input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value.toUpperCase() })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder="Descrição" className="col-span-6 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition" />
            <input type="number" min="0" step="any" value={newItem.quantity === "0" ? "" : newItem.quantity}
              onFocus={(e) => { if (Number(newItem.quantity) === 0) e.target.value = ""; }}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} placeholder="Qtd"
              className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition" />
            <select value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="col-span-2 px-2 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition">
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
          <Label>Status</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ServiceOrderStatus)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition">
            {SERVICE_ORDER_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <LongTextField label="Observações" value={notes} onChange={setNotes} placeholder="Notas sobre a execução — toque para escrever" />
        </div>

        <PhotoUploaderTec label="Fotos — ANTES" uploading={uploading}
          photos={beforePhotos.map((p) => ({ id: p.id, url: publicServiceOrderPhotoUrl(p.storage_path) }))}
          onAdd={(files) => handlePhotoFiles(files, "before")}
          onRemove={(id) => { const ph = beforePhotos.find((p) => p.id === id); if (ph) removePhoto(ph); }} />
        <PhotoUploaderTec label="Fotos — DEPOIS" uploading={uploading}
          photos={afterPhotos.map((p) => ({ id: p.id, url: publicServiceOrderPhotoUrl(p.storage_path) }))}
          onAdd={(files) => handlePhotoFiles(files, "after")}
          onRemove={(id) => { const ph = afterPhotos.find((p) => p.id === id); if (ph) removePhoto(ph); }} />

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar execução"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function OrderView({ order, company, onClose }: {
  order: ServiceOrderWithItems; company: Company | null; onClose: () => void;
}) {
  const [items, setItems] = useState<ServiceOrderItem[]>(order.items || []);
  const [photos, setPhotos] = useState<ServiceOrderPhoto[]>(order.photos || []);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!order.id) return;
    (async () => {
      const [{ data: it }, { data: ph }] = await Promise.all([
        supabase.from("service_order_items").select("id, service_order_id, description, quantity, unit, created_at").eq("service_order_id", order.id).order("created_at", { ascending: true }),
        supabase.from("service_order_photos").select("id, service_order_id, storage_path, kind, position, created_at").eq("service_order_id", order.id).order("position", { ascending: true }),
      ]);
      if (it) setItems(it as ServiceOrderItem[]);
      if (ph) setPhotos(ph as ServiceOrderPhoto[]);
    })();
  }, [order.id]);

  async function downloadPdf() {
    if (!company) return;
    setGenerating(true);
    try {
      await generateServiceOrderPdf({ ...order, items, photos }, company);
    } finally {
      setGenerating(false);
    }
  }

  const beforePhotos = photos.filter((p) => p.kind === "before");
  const afterPhotos = photos.filter((p) => p.kind === "after");

  return (
    <Modal title="Visualização da ordem de serviço" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500">Ordem de Serviço</div>
            <div className="font-semibold text-slate-900">{order.title}</div>
            <div className="text-sm text-slate-500">{order.client_name} · {formatDate(order.created_at)}</div>
          </div>
          <Badge className="bg-slate-100 text-slate-600 border-slate-200">{serviceOrderStatusLabel(order.status)}</Badge>
        </div>

        {order.service_to_execute && (
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Serviço a executar</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.service_to_execute}</p>
          </div>
        )}

        {order.materials_used && order.materials_used.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Material previsto</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100">
              {order.materials_used.map((m, i) => <div key={i} className="px-3 py-2 text-sm text-slate-700">{m}</div>)}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Material utilizado</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100">
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
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Observações</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
          <div className="space-y-3">
            {beforePhotos.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Antes</div>
                <div className="grid grid-cols-3 gap-2">
                  {beforePhotos.map((p) => <img key={p.id} src={publicServiceOrderPhotoUrl(p.storage_path)} alt="" className="w-full h-24 object-cover rounded-lg" />)}
                </div>
              </div>
            )}
            {afterPhotos.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Depois</div>
                <div className="grid grid-cols-3 gap-2">
                  {afterPhotos.map((p) => <img key={p.id} src={publicServiceOrderPhotoUrl(p.storage_path)} alt="" className="w-full h-24 object-cover rounded-lg" />)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={downloadPdf} disabled={generating}>
            <FileDown className="w-4 h-4" /> {generating ? "Gerando..." : "PDF"}
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}

function PhotoInput({ uploading, onAdd, photos, onRemove }: {
  uploading: boolean; onAdd: (files: FileList | null) => void;
  photos: { id: string; url: string }[]; onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex gap-2 items-center mb-2">
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition">
            <Upload className="w-3.5 h-3.5" /> Enviar foto
          </span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onAdd(e.target.files)} />
        </label>
        {uploading && <span className="text-xs text-slate-400">Enviando...</span>}
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              <img src={p.url} alt="" className="w-full h-24 object-cover rounded-lg" />
              <button type="button" onClick={() => onRemove(p.id)} className="absolute top-1 right-1 bg-white/90 rounded-full p-1 text-slate-600 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoUploaderTec({ label, uploading, photos, onAdd, onRemove }: {
  label: string; uploading: boolean;
  photos: { id: string; url: string }[];
  onAdd: (files: FileList | null) => void; onRemove: (id: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 items-center mb-2">
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition">
            <Camera className="w-3.5 h-3.5" /> Tirar/Enviar foto
          </span>
          <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => onAdd(e.target.files)} />
        </label>
        {uploading && <span className="text-xs text-slate-400">Enviando...</span>}
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              <img src={p.url} alt="" className="w-full h-24 object-cover rounded-lg" />
              <button type="button" onClick={() => onRemove(p.id)} className="absolute top-1 right-1 bg-white/90 rounded-full p-1 text-slate-600 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
