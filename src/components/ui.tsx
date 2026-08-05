import type { ReactNode } from "react";
import { useState } from "react";
import { X, Pencil, MessageSquare } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 pb-24 sm:pb-6">{children}</div>
      </div>
    </div>
  );
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
    ghost: "hover:bg-slate-100 text-slate-600",
    danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)})${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)})${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)})${d.slice(2, 7)}-${d.slice(7)}`;
}

export function Input({ preserveCase, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { preserveCase?: boolean }) {
  const { type, onChange, ...rest } = props;
  const skipUpper = type === "email" || preserveCase;
  return (
    <input
      {...rest}
      type={type}
      onChange={(e) => {
        if (!skipUpper) e.target.value = e.target.value.toUpperCase();
        onChange?.(e);
      }}
      className={`w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition ${rest.className || ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { onChange, ...rest } = props;
  return (
    <textarea
      {...rest}
      onChange={(e) => {
        e.target.value = e.target.value.toUpperCase();
        onChange?.(e);
      }}
      className={`w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition resize-y ${rest.className || ""}`}
    />
  );
}

export function MoneyInput({
  value,
  onValueChange,
  className,
  ...rest
}: {
  value: number | null;
  onValueChange: (v: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [focused, setFocused] = useState(false);
  const display = focused
    ? (value === 0 || value === null ? "" : String(value))
    : (value === 0 || value === null ? "0" : String(value));
  return (
    <input
      {...rest}
      type="number"
      min="0"
      step="any"
      className={className}
      value={display}
      onFocus={(e) => { setFocused(true); e.target.value = ""; }}
      onBlur={(e) => {
        setFocused(false);
        const v = Number(e.target.value) || 0;
        e.target.value = v === 0 ? "0" : String(v);
      }}
      onChange={(e) => onValueChange(Number(e.target.value) || 0)}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 mb-1.5">{children}</label>;
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
    </div>
  );
}

export function LongTextField({
  label,
  value,
  onChange,
  placeholder = "Toque para escrever…",
  rows = 8,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const text = value || "";
  const hasText = text.trim().length > 0;
  const preview = text.length > 120 ? text.slice(0, 120) + "…" : text;

  function openEditor() {
    setDraft(text);
    setOpen(true);
  }

  function save() {
    onChange(draft.trim());
    setOpen(false);
  }

  return (
    <div>
      <Label>{label}</Label>
      <button
        type="button"
        onClick={openEditor}
        className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30 transition group flex items-start gap-2 min-h-[44px]"
      >
        {hasText ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap flex-1 line-clamp-3">{preview}</p>
        ) : (
          <span className="text-sm text-slate-400 flex-1">{placeholder}</span>
        )}
        <Pencil className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0 mt-0.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                {label}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={rows}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition resize-y min-h-[200px]"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-400">{draft.length} caracteres</span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={save}>Salvar</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
