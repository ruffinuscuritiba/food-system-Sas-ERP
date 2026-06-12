"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, Trash2, KeyRound, Loader2, X, Save,
  Eye, EyeOff, UserCircle, AlertTriangle, CheckCircle2,
  Shield, ChefHat, ShoppingCart, Bike, Users,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "CASHIER" | "KITCHEN" | "DELIVERY";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

// ── Configurações de role ──────────────────────────────────────────────────────

const ROLE_OPTIONS: Array<{ value: Role; label: string; desc: string }> = [
  { value: "ADMIN",    label: "Administrador", desc: "Acesso total ao painel" },
  { value: "MANAGER",  label: "Gerente",       desc: "Relatórios, estoque e equipe" },
  { value: "CASHIER",  label: "Caixa",         desc: "PDV, caixa e pedidos" },
  { value: "KITCHEN",  label: "Cozinha",       desc: "Painel da cozinha apenas" },
  { value: "DELIVERY", label: "Entregador",    desc: "App do entregador" },
];

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  SUPER_ADMIN: { label: "Super Admin",    color: "text-purple-700", bg: "bg-purple-100 dark:bg-purple-900/30",  icon: <Shield size={11} /> },
  ADMIN:       { label: "Administrador", color: "text-blue-700",   bg: "bg-blue-100 dark:bg-blue-900/30",    icon: <Shield size={11} /> },
  MANAGER:     { label: "Gerente",       color: "text-indigo-700", bg: "bg-indigo-100 dark:bg-indigo-900/30", icon: <Users size={11} /> },
  CASHIER:     { label: "Caixa",         color: "text-green-700",  bg: "bg-green-100 dark:bg-green-900/30",  icon: <ShoppingCart size={11} /> },
  KITCHEN:     { label: "Cozinha",       color: "text-orange-700", bg: "bg-orange-100 dark:bg-orange-900/30",icon: <ChefHat size={11} /> },
  DELIVERY:    { label: "Entregador",    color: "text-teal-700",   bg: "bg-teal-100 dark:bg-teal-900/30",    icon: <Bike size={11} /> },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function avatarColor(name: string): string {
  const colors = [
    "bg-orange-500", "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-red-500",
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}

// ── Componente de input reutilizável ──────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text", disabled,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type} value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
    />
  );
}

function PasswordInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
      <button
        type="button" onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ── Modal base ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, footer }: {
  title: string; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal: criar/editar usuário ───────────────────────────────────────────────

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
}

const EMPTY_FORM: UserForm = { name: "", email: "", password: "", role: "CASHIER" };

function UserModal({
  user,
  companyId,
  onClose,
  onSaved,
}: {
  user: User | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState<UserForm>(
    user ? { name: user.name, email: user.email, password: "", role: user.role } : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);

  const patch = <K extends keyof UserForm>(k: K, v: UserForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    if (!isEdit && form.password.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/users/${user!.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
        });
        toast.success("Usuário atualizado!");
      } else {
        await api.post("/users", {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          companyId,
        });
        toast.success("Usuário criado!");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Editar Usuário" : "Novo Usuário"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {isEdit ? "Salvar" : "Criar usuário"}
          </button>
        </>
      }
    >
      <Field label="Nome completo">
        <TextInput value={form.name} onChange={(v) => patch("name", v)} placeholder="João da Silva" />
      </Field>

      <Field label="E-mail">
        <TextInput value={form.email} onChange={(v) => patch("email", v)} type="email" placeholder="joao@loja.com" />
      </Field>

      {!isEdit && (
        <Field label="Senha inicial">
          <PasswordInput value={form.password} onChange={(v) => patch("password", v)} placeholder="Mínimo 6 caracteres" />
        </Field>
      )}

      <Field label="Função / Role">
        <div className="grid grid-cols-1 gap-1.5">
          {ROLE_OPTIONS.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => patch("role", value)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                form.role === value
                  ? "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${form.role === value ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"}`} />
              <div>
                <p className={`text-xs font-medium ${form.role === value ? "text-orange-700 dark:text-orange-400" : "text-gray-800 dark:text-gray-200"}`}>
                  {label}
                </p>
                <p className="text-[10px] text-gray-400">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

// ── Modal: redefinir senha ────────────────────────────────────────────────────

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleReset() {
    if (newPassword.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { newPassword });
      toast.success("Senha redefinida com sucesso!");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao redefinir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Redefinir Senha"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
            Redefinir senha
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Redefine a senha de <strong>{user.name}</strong>. O usuário deverá ser informado da nova senha.
        </p>
      </div>
      <Field label="Nova senha">
        <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="Mínimo 6 caracteres" />
      </Field>
    </Modal>
  );
}

// ── Modal: confirmar exclusão ─────────────────────────────────────────────────

function DeleteModal({
  user,
  onClose,
  onDeleted,
}: {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/users/${user.id}`);
      toast.success("Usuário removido");
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao remover");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      title="Remover Usuário"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-60"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Remover definitivamente
          </button>
        </>
      }
    >
      <div className="text-center py-2">
        <div className={`w-12 h-12 rounded-full ${avatarColor(user.name)} text-white flex items-center justify-center text-base font-bold mx-auto mb-3`}>
          {initials(user.name)}
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
        <p className="text-xs text-red-500 mt-3">
          Esta ação é irreversível. Todos os registros deste usuário serão desvinculados.
        </p>
      </div>
    </Modal>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function UsuariosTab() {
  const { user: me } = useAuthStore();
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser]     = useState<User | null | "new">(null);
  const [resetUser, setResetUser]   = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const load = useCallback(() => {
    api.get<User[]>("/users")
      .then((r) => setUsers(r.data))
      .catch(() => toast.error("Erro ao carregar usuários"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(user: User) {
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? "Usuário desativado" : "Usuário reativado");
      load();
    } catch {
      toast.error("Erro ao alterar status");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  const isAdmin = me?.role === "SUPER_ADMIN" || me?.role === "ADMIN";

  return (
    <div className="max-w-3xl space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Equipe ({users.length} {users.length === 1 ? "membro" : "membros"})
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gerencie acessos e funções dos colaboradores
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditUser("new")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
          >
            <Plus size={13} />
            Novo Usuário
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {users.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <UserCircle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum usuário cadastrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {users.map((u) => {
              const rc = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.CASHIER;
              const isSelf = u.id === (me as any)?.id;
              return (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                    u.isActive ? "" : "opacity-50"
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full ${avatarColor(u.name)} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
                    {initials(u.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {u.name}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                          Você
                        </span>
                      )}
                      {!u.isActive && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>

                  {/* Role badge */}
                  <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${rc.bg} ${rc.color} flex-shrink-0`}>
                    {rc.icon}
                    {rc.label}
                  </span>

                  {/* Status toggle */}
                  {isAdmin && !isSelf && (
                    <button
                      onClick={() => toggleActive(u)}
                      title={u.isActive ? "Desativar" : "Reativar"}
                      className={`hidden sm:flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                        u.isActive
                          ? "text-green-600 bg-green-50 dark:bg-green-950/30 hover:bg-green-100"
                          : "text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      <CheckCircle2 size={13} />
                    </button>
                  )}

                  {/* Ações */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setEditUser(u)}
                        title="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setResetUser(u)}
                        title="Redefinir senha"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      >
                        <KeyRound size={13} />
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => setDeleteUser(u)}
                          title="Remover"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aviso role MANAGER */}
      {!isAdmin && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Apenas Administradores podem criar, editar ou remover usuários. Você pode visualizar a equipe.
          </p>
        </div>
      )}

      {/* Modais */}
      {editUser === "new" && (
        <UserModal user={null} companyId={(me as any)?.companyId ?? ""} onClose={() => setEditUser(null)} onSaved={load} />
      )}
      {editUser && editUser !== "new" && (
        <UserModal user={editUser} companyId={(me as any)?.companyId ?? ""} onClose={() => setEditUser(null)} onSaved={load} />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
      {deleteUser && (
        <DeleteModal user={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={load} />
      )}
    </div>
  );
}
