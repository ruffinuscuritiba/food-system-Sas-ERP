"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  Plus, Trash2, X, Repeat, Users, Package, Pause, Play, Ban,
  Loader2, Search,
} from "lucide-react";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

// ─── Types ───────────────────────────────────────────────────────────────────

type BillingCycle = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

interface Product { id: string; name: string; salePrice: number; }

interface IncludedItem { productId: string; quantity: number; }

interface SalesPackage {
  id: string; name: string; description: string | null; price: number;
  billingCycle: BillingCycle; includedItems: IncludedItem[]; isActive: boolean;
  _count?: { subscriptions: number };
}

interface Billing { id: string; cycleNumber: number; amount: number; status: string; dueDate: string; paidAt: string | null; }

interface Subscription {
  id: string; customerPhone: string; customerName: string | null;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  nextBillingAt: string; package: { name: string; price: number; billingCycle: BillingCycle };
  billings: Billing[];
}

const CYCLE_LABEL: Record<BillingCycle, string> = { WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", MONTHLY: "Mensal" };
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PAUSED: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  PENDING: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

// ─── Modal: novo pacote ──────────────────────────────────────────────────────

function PackageModal({ products, onClose, onSaved }: { products: Product[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  function toggleProduct(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) return toast.error("Dê um nome ao pacote.");
    const priceNum = Number(price.replace(",", "."));
    if (!(priceNum > 0)) return toast.error("Preço deve ser maior que zero.");
    const includedItems = Object.entries(selected).map(([productId, quantity]) => ({ productId, quantity }));
    if (!includedItems.length) return toast.error("Selecione ao menos 1 produto incluído no pacote.");

    setSaving(true);
    try {
      await api.post("/sales-packages", {
        name: name.trim(), description: description.trim() || undefined,
        price: priceNum, billingCycle, includedItems,
      });
      toast.success("Pacote criado!");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao criar pacote.");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Novo Pacote Recorrente</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: 10 Marmitas por mês"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Descrição (opcional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Preço por ciclo</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="120,00"
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Frequência</label>
              <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="MONTHLY">Mensal</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Produtos incluídos por ciclo</label>
            <div className="relative mt-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm" />
            </div>
            <div className="mt-2 border border-gray-100 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-50">
              {filtered.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <input type="checkbox" checked={!!selected[p.id]} onChange={() => toggleProduct(p.id)} />
                  <span className="flex-1 text-sm text-gray-700 truncate">{p.name}</span>
                  {selected[p.id] && (
                    <input
                      type="number" min={1} value={selected[p.id]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: Math.max(1, Number(e.target.value)) }))}
                      className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-center"
                    />
                  )}
                </div>
              ))}
              {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum produto encontrado</p>}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">O preço do pacote é o valor cobrado por ciclo — não precisa bater com a soma dos itens.</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Criar Pacote
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: assinar cliente ──────────────────────────────────────────────────

function SubscribeModal({ pkg, onClose, onSaved }: { pkg: SalesPackage; onClose: () => void; onSaved: () => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!phone.trim()) return toast.error("Informe o telefone do cliente.");
    setSaving(true);
    try {
      await api.post("/sales-packages/subscriptions", { packageId: pkg.id, customerPhone: phone, customerName: name || undefined });
      toast.success("Assinatura criada! 1º ciclo já cobrado via PIX.");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao assinar.");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Assinar — {pkg.name}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Telefone (WhatsApp)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="41999998888"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Nome (opcional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-gray-400">O 1º ciclo é cobrado na hora — o cliente recebe o PIX por WhatsApp.</p>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Assinar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function VendasRecorrentesPage() {
  useNavKeyGuard("vendas-recorrentes");

  const [packages, setPackages] = useState<SalesPackage[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [subscribeTarget, setSubscribeTarget] = useState<SalesPackage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgRes, subRes, prodRes] = await Promise.allSettled([
        api.get("/sales-packages"),
        api.get("/sales-packages/subscriptions"),
        api.get("/products"),
      ]);
      if (pkgRes.status === "fulfilled") setPackages(pkgRes.value.data ?? []);
      if (subRes.status === "fulfilled") setSubscriptions(subRes.value.data ?? []);
      if (prodRes.status === "fulfilled") setProducts(prodRes.value.data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function togglePackage(pkg: SalesPackage) {
    try {
      await api.patch(`/sales-packages/${pkg.id}`, { isActive: !pkg.isActive });
      toast.success(pkg.isActive ? "Pacote desativado" : "Pacote reativado");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao atualizar pacote.");
    }
  }

  async function deletePackage(pkg: SalesPackage) {
    if (!confirm(`Excluir o pacote "${pkg.name}"?`)) return;
    try {
      await api.delete(`/sales-packages/${pkg.id}`);
      toast.success("Pacote excluído");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao excluir pacote.");
    }
  }

  async function subAction(sub: Subscription, action: "pause" | "resume" | "cancel") {
    try {
      await api.patch(`/sales-packages/subscriptions/${sub.id}/${action}`);
      toast.success("Atualizado!");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao atualizar assinatura.");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2"><Repeat size={22} /> Vendas Recorrentes</h1>
          <p className="text-sm text-gray-400 mt-1">Pacotes/combos cobrados automaticamente via PIX a cada ciclo (ex: "10 marmitas por mês").</p>
        </div>
        <button onClick={() => setShowPackageModal(true)}
          className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold flex items-center gap-2">
          <Plus size={16} /> Novo Pacote
        </button>
      </div>

      {/* ── Pacotes ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Package size={16} /> Pacotes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{pkg.name}</p>
                  {pkg.description && <p className="text-xs text-gray-400 mt-0.5">{pkg.description}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pkg.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {pkg.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-3">
                <span className="text-xl font-black text-gray-900">{fmt(pkg.price)}</span>
                <span className="text-xs text-gray-400">/ {CYCLE_LABEL[pkg.billingCycle].toLowerCase()}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Users size={12} /> {pkg._count?.subscriptions ?? 0} assinante(s)</p>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => setSubscribeTarget(pkg)} disabled={!pkg.isActive}
                  className="flex-1 text-xs font-semibold bg-gray-900 text-white rounded-lg py-2 disabled:opacity-40">
                  Assinar cliente
                </button>
                <button onClick={() => togglePackage(pkg)} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600">
                  {pkg.isActive ? "Desativar" : "Ativar"}
                </button>
                <button onClick={() => deletePackage(pkg)} className="p-2 border border-gray-200 rounded-lg text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {!loading && packages.length === 0 && (
            <p className="text-sm text-gray-400 col-span-2 text-center py-8">Nenhum pacote cadastrado ainda.</p>
          )}
        </div>
      </div>

      {/* ── Assinantes ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Users size={16} /> Assinantes</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{sub.customerName || "Cliente"} · {sub.customerPhone}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub.package.name} — {fmt(sub.package.price)} / {CYCLE_LABEL[sub.package.billingCycle].toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[sub.status]}`}>{sub.status}</span>
                    {sub.status === "ACTIVE" && (
                      <button onClick={() => subAction(sub, "pause")} title="Pausar" className="p-1.5 border border-gray-200 rounded-lg text-gray-500"><Pause size={12} /></button>
                    )}
                    {sub.status === "PAUSED" && (
                      <button onClick={() => subAction(sub, "resume")} title="Retomar" className="p-1.5 border border-gray-200 rounded-lg text-emerald-600"><Play size={12} /></button>
                    )}
                    {sub.status !== "CANCELLED" && (
                      <button onClick={() => subAction(sub, "cancel")} title="Cancelar" className="p-1.5 border border-gray-200 rounded-lg text-red-500"><Ban size={12} /></button>
                    )}
                  </div>
                </div>
                {sub.billings.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {sub.billings.map((b) => (
                      <span key={b.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[b.status]}`}>
                        Ciclo {b.cycleNumber} · {fmt(b.amount)} · {b.status}
                      </span>
                    ))}
                  </div>
                )}
                {sub.status === "ACTIVE" && (
                  <p className="text-[11px] text-gray-400 mt-1.5">Próxima cobrança: {new Date(sub.nextBillingAt).toLocaleDateString("pt-BR")}</p>
                )}
              </div>
            ))}
            {!loading && subscriptions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum assinante ainda.</p>
            )}
          </div>
        </div>
      </div>

      {showPackageModal && (
        <PackageModal products={products} onClose={() => setShowPackageModal(false)} onSaved={load} />
      )}
      {subscribeTarget && (
        <SubscribeModal pkg={subscribeTarget} onClose={() => setSubscribeTarget(null)} onSaved={load} />
      )}
    </div>
  );
}
