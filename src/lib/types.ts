export type Role = "dev" | "empresa" | "tecnico";

export type Profile = {
  id: string;
  email: string;
  role: Role;
  company_id: string | null;
  name: string | null;
  active: boolean;
  created_at: string;
};

export type Company = {
  id: string;
  name: string;
  active: boolean;
  primary_color: string;
  logo_url: string | null;
  created_at: string;
};

export type Budget = {
  id: string;
  company_id: string;
  user_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  title: string;
  description: string | null;
  valid_until: string | null;
  labor_cost: number | null;
  created_at: string;
  updated_at: string;
};

export type BudgetItem = {
  id: string;
  budget_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  created_at: string;
};

export type BudgetPhoto = {
  id: string;
  budget_id: string;
  storage_path: string;
  position: number;
  created_at: string;
};

export type BudgetWithItems = Budget & {
  items: BudgetItem[];
  photos?: BudgetPhoto[];
};

export type ServiceOrderStatus = "draft" | "in_progress" | "completed" | "cancelled";

export type ServiceOrder = {
  id: string;
  company_id: string;
  budget_id: string | null;
  user_id: string;
  technician_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  title: string;
  service_to_execute: string | null;
  materials_used: string[];
  technician: string | null;
  status: ServiceOrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceOrderItem = {
  id: string;
  service_order_id: string;
  description: string;
  quantity: number;
  unit: string;
  created_at: string;
};

export type ServiceOrderPhoto = {
  id: string;
  service_order_id: string;
  storage_path: string;
  kind: "before" | "after";
  position: number;
  created_at: string;
};

export type ServiceOrderWithItems = ServiceOrder & {
  items?: ServiceOrderItem[];
  photos?: ServiceOrderPhoto[];
};

export type ServiceOrderWithPhotos = ServiceOrder & {
  photos?: ServiceOrderPhoto[];
  items?: ServiceOrderItem[];
};

export type Technician = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

export type TechnicianWithCompany = Technician & {
  company_name: string;
};

export const UNIT_OPTIONS = ["un", "m", "m²", "m³", "kg", "g", "L", "h", "cx", "pct", "sv", "par", "cj"];

export const SERVICE_ORDER_STATUS: { value: ServiceOrderStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "in_progress", label: "Em execução" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

export function serviceOrderStatusLabel(value: ServiceOrderStatus): string {
  return SERVICE_ORDER_STATUS.find((s) => s.value === value)?.label || value;
}
