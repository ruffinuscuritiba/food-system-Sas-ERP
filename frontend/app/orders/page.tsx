"use client";
import { api } from "@/services/api";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { socket } from "@/services/socket";
import { useAuthStore } from "@/stores/auth.store";
import {
  ShoppingCart, Printer, Clock, Truck, CheckCircle2, History,
  Phone, User, MapPin, X, Save, ChevronRight, RefreshCw,
  SplitSquareHorizontal, Plus, Minus, Navigation,
} from "lucide-react";
import { type PrintableOrder } from "@/components/printing/printTicket";
import { PrintRouterService } from "@/components/printing/PrintRouterService";
import PrinterAgentBanner from "@/components/PrinterAgentBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderItemComplement = {
  complementName: string;
  optionName: string;
  price: number;
  quantity: number;
};

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  selectedComplements?: OrderItemComplement[];
};

type Customer = { id: string; name: string; phone: string };

type Order = {
  id: string;
  customer?: Customer;
  customerName?: string;    // legacy / pode vir de alguns fluxos
  customerPhone?: string;
  deliveryAddress?: string;
  // Campos crus só em pedidos ONLINE (OnlineOrder guarda endereço
  // estruturado) — usados pra popular o form de corrigir endereço.
  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  paymentMethod: string;
  cashReceived?: number | null;
  paymentStatus?: string | null;
  subtotal?: number;
  discount?: number;
  deliveryFee: number;
  driverFee?: number;
  driverId?: string | null;
  driverName?: string | null;
  total: number;
  status: string;
  orderType?: string;
  notes?: string;
  items: OrderItem[];
  createdAt?: string;
  confirmedAt?: string;
};

type DriverOption = { id: string; name: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:          { label: "Pendente",     color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  CONFIRMED:        { label: "Confirmado",   color: "bg-blue-100 text-blue-700 border-blue-200" },
  PREPARING:        { label: "Preparando",   color: "bg-primary/10 text-orange-700 border-primary/20" },
  READY:            { label: "Pronto",       color: "bg-green-100 text-green-700 border-green-200" },
  OUT_FOR_DELIVERY: { label: "Saiu entrega", color: "bg-purple-100 text-purple-700 border-purple-200" },
  DELIVERED:        { label: "Finalizado",   color: "bg-gray-100 text-gray-600 border-gray-200" },
  CANCELLED:        { label: "Cancelado",    color: "bg-red-100 text-red-600 border-red-200" },
};

const PAY_LABELS: Record<string, string> = {
  PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito", MEAL_VOUCHER: "Vale-Refeição", TRANSFER: "Transferência",
};

const HISTORY_STATUSES = new Set(["DELIVERED", "CANCELLED"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Data/horário completo do pedido — pra conferência/auditoria precisar achar
// um pedido específico (ex.: bateu caixa errado, cliente reclamou de um
// pedido de tal dia), igual coluna "Data" do Histórico e do relatório de
// concorrentes (DD/MM/AAAA - HH:MM:SS).
function fmtDateTime(order: Order): string {
  const ref = order.createdAt || order.confirmedAt;
  if (!ref) return "—";
  const d = new Date(ref);
  const date = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const time = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return `${date} - ${time}`;
}

function elapsedMin(order: Order): number {
  const ref = order.confirmedAt || order.createdAt;
  if (!ref) return 0;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 60000);
}

function timingBorderClass(order: Order): string {
  if (HISTORY_STATUSES.has(order.status)) return "border-gray-100";
  const min = elapsedMin(order);
  if (min > 45) return "border-red-400 shadow-red-100/50 shadow-md";
  if (min > 25) return "border-amber-400 shadow-amber-100/50 shadow-md";
  return "border-green-400 shadow-green-100/50 shadow-md";
}

function timingDotClass(order: Order): string {
  const min = elapsedMin(order);
  if (min > 45) return "bg-[var(--danger)]";
  if (min > 25) return "bg-[var(--warning)]";
  return "bg-[var(--success)]";
}

function estimatedDelivery(order: Order): string {
  const ref = order.confirmedAt || order.createdAt;
  if (!ref) return "—";
  return new Date(new Date(ref).getTime() + 45 * 60000)
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function customerName(order: Order): string {
  return order.customer?.name || order.customerName || "Cliente sem cadastro";
}

function customerPhone(order: Order): string {
  return order.customer?.phone || order.customerPhone || "—";
}

// ── Print ─────────────────────────────────────────────────────────────────────

async function printOrder(order: Order, companyName: string) {
  const printable: PrintableOrder = {
    ...(order as unknown as PrintableOrder),
    source:        (order as Order & { source?: string }).source,
    status:        STATUS_LABELS[order.status]?.label || order.status,
    customerName:  customerName(order),
    customerPhone: customerPhone(order),
  };
  const result = await PrintRouterService.printAll(printable, { companyName });
  if (result.blockedSectors.length > 0) {
    toast.error(
      `Impressão bloqueada pelo navegador (${result.blockedSectors.join(", ")}). Libere pop-ups para este site.`,
      { id: "orders-print-blocked", duration: 8000 },
    );
  }
}

// ── Edit Notes Modal ──────────────────────────────────────────────────────────

function EditNotesModal({
  order: initialOrder,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Cópia local que reflete itens/total novos ao vivo (adicionar item não
  // fecha o modal — operador pode acrescentar vários em sequência); o resto
  // do modal (desconto, forma de pagamento) usa `order` normalmente.
  const [order, setOrder] = useState(initialOrder);
  const orderFinalized = order.status === "DELIVERED" || order.status === "CANCELLED";

  const [products, setProducts] = useState<{ id: string; name: string; salePrice: number; isActive: boolean }[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data || [])).catch(() => {});
  }, []);

  async function addItem() {
    if (!addProductId) { toast.error("Escolha um produto"); return; }
    const qty = parseInt(addQty, 10);
    if (!qty || qty <= 0) { toast.error("Quantidade inválida"); return; }
    setAddingItem(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/items`, {
        productId: addProductId,
        quantity: qty,
      });
      setOrder(data);
      setAddProductId("");
      setAddQty("1");
      toast.success("Item acrescentado ao pedido");
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao acrescentar item");
    } finally {
      setAddingItem(false);
    }
  }

  const [notes, setNotes] = useState(order.notes || "");
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod);
  // Desconto pós-criação (ex: caixa sem troco, abateu a diferença depois de
  // já ter fechado o pedido) — mesmo padrão de texto+vírgula já usado no
  // valor do split logo abaixo, pra ficar consistente dentro do mesmo modal.
  const [discount, setDiscount] = useState(String(order.discount ?? 0).replace(".", ","));
  const [orderType, setOrderType] = useState(order.orderType || "PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress || "");
  const [neighborhood, setNeighborhood] = useState("");
  const [saving, setSaving] = useState(false);

  // Corrigir endereço — pedido do usuário: "quando o cliente anota o
  // endereço errado como faço pra editar?" Antes só dava pra editar
  // endereço na CONVERSÃO retirada->entrega; um pedido que já nasce como
  // entrega (o caso real, pedido ONLINE) não tinha nenhum jeito de corrigir
  // o texto. ONLINE guarda endereço estruturado (OnlineOrder), diferente do
  // texto único de PDV/Order — dois grupos de estado, um pra cada formato.
  const orderSource = ((order as Order & { source?: string }).source ?? "PDV") as string;
  const isOnlineOrder = orderSource === "ONLINE";
  const [correctAddress, setCorrectAddress] = useState(order.deliveryAddress || "");
  const [correctNeighborhood, setCorrectNeighborhood] = useState(order.neighborhood || "");
  const [onlineAddr, setOnlineAddr] = useState(order.address || "");
  const [onlineAddrNumber, setOnlineAddrNumber] = useState(order.addressNumber || "");
  const [onlineComplement, setOnlineComplement] = useState(order.complement || "");
  const [onlineNeighborhood, setOnlineNeighborhood] = useState(order.neighborhood || "");
  const [onlineCity, setOnlineCity] = useState(order.city || "");
  const canCorrectAddress =
    !orderFinalized && order.status !== "CANCELLED" && (orderType === "DELIVERY" || order.orderType === "DELIVERY");
  const addressChanged = isOnlineOrder
    ? onlineAddr !== (order.address || "") ||
      onlineAddrNumber !== (order.addressNumber || "") ||
      onlineComplement !== (order.complement || "") ||
      onlineNeighborhood !== (order.neighborhood || "") ||
      onlineCity !== (order.city || "")
    : correctAddress !== (order.deliveryAddress || "") ||
      correctNeighborhood !== (order.neighborhood || "");

  // Nome/telefone do pedido -- snapshot próprio do Order, não o cadastro
  // vinculado (Customer). Usa o valor cru (não o helper de exibição com
  // fallback "Cliente sem cadastro"/"—"), senão o input nasceria com esse
  // texto de placeholder como se fosse o nome/telefone de verdade.
  const originalCustomerName = order.customerName || "";
  const originalCustomerPhone = order.customerPhone || "";
  const [editCustomerName, setEditCustomerName] = useState(originalCustomerName);
  const [editCustomerPhone, setEditCustomerPhone] = useState(originalCustomerPhone);
  const hasLinkedCustomer = !!order.customer;

  // Pagamento dividido (ex: "26 no dinheiro + 8 no PIX") -- mesma
  // capacidade que já existe na criação do pedido no PDV (PaymentModal),
  // só que não existia ainda pra CORRIGIR um pedido já criado.
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<{ method: string; amount: string }[]>([
    { method: order.paymentMethod, amount: "" },
    { method: "PIX", amount: "" },
  ]);
  const splitTotal = splits.reduce((a, s) => a + (parseFloat(s.amount) || 0), 0);
  const splitDiff = Number(order.total) - splitTotal;

  function updateSplit(idx: number, patch: Partial<{ method: string; amount: string }>) {
    setSplits((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function addSplit() {
    if (splits.length >= 3) return;
    setSplits((prev) => [...prev, { method: "CASH", amount: "" }]);
  }
  function removeSplit(idx: number) {
    if (splits.length <= 2) return;
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  }
  function autoFillSplit(idx: number) {
    const otherSum = splits.reduce((a, s, i) => (i === idx ? a : a + (parseFloat(s.amount) || 0)), 0);
    const remaining = Math.max(0, Number(order.total) - otherSum);
    updateSplit(idx, { amount: remaining.toFixed(2) });
  }

  // Depois de despachado/entregue não faz sentido converter o tipo (mudar
  // pra "entrega" um pedido que já saiu como retirada, por ex.) — forma de
  // pagamento continua editável em qualquer status, é o caso real que gerou
  // esse pedido: cliente informou cartão e pagou em dinheiro na retirada.
  const typeLocked = order.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED";
  const convertingToDelivery = orderType === "DELIVERY" && order.orderType !== "DELIVERY";

  const discountValue = Math.max(0, parseFloat(discount.replace(",", ".")) || 0);
  const discountChanged = Math.abs(discountValue - Number(order.discount ?? 0)) > 0.001;
  const subtotalForPreview = Number(order.subtotal ?? order.total);
  const totalAfterDiscount = Math.max(0, subtotalForPreview - discountValue + Number(order.deliveryFee ?? 0));

  async function save() {
    if (convertingToDelivery && !deliveryAddress.trim()) {
      toast.error("Informe o endereço de entrega");
      return;
    }
    if (splitMode && Math.abs(splitDiff) > 0.01) {
      toast.error(`A soma da divisão precisa bater com o total (falta R$ ${splitDiff.toFixed(2)})`);
      return;
    }
    setSaving(true);
    try {
      // Pagamento dividido: paymentMethod="SPLIT" (enum real, não mais o
      // método do 1º split como "oficial" — bug real corrigido: mandava o
      // TOTAL pro caixa se o 1º split fosse CASH, ou nunca creditava o
      // dinheiro se CASH caísse em 2º/3º). cashReceived guarda só a soma das
      // parcelas em dinheiro — mesmo padrão de app/pdv/page.tsx.
      const splitNote = splitMode
        ? `Pgto dividido: ${splits.filter(s => parseFloat(s.amount) > 0).map(s => `${PAY_LABELS[s.method] ?? s.method} R$${(parseFloat(s.amount) || 0).toFixed(2)}`).join(" + ")}`
        : null;
      const finalNotes = splitNote
        ? [notes.trim(), splitNote].filter(Boolean).join("\n")
        : notes;
      const finalPaymentMethod = splitMode ? "SPLIT" : paymentMethod;
      const finalCashReceived = splitMode
        ? splits.filter(s => s.method === "CASH").reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
        : (paymentMethod === "CASH" ? Number(order.total) : 0);
      const previousCashReceived = order.cashReceived != null
        ? Number(order.cashReceived)
        : (order.paymentMethod === "CASH" ? Number(order.total) : 0);
      const cashReceivedChanged = Math.abs(finalCashReceived - previousCashReceived) > 0.001;

      if (finalNotes !== (order.notes || "")) {
        // Sem endpoint PATCH genérico pra notes ainda — reaproveita /status
        // mantendo o status atual (não altera o fluxo da cozinha).
        await api.patch(`/orders/${order.id}/status`, { status: order.status, notes: finalNotes });
      }

      const nameChanged = editCustomerName.trim() !== originalCustomerName;
      const phoneChanged = editCustomerPhone.trim() !== originalCustomerPhone;
      const paymentMethodChanged = finalPaymentMethod !== order.paymentMethod;
      const detailsChanged =
        paymentMethodChanged ||
        cashReceivedChanged ||
        orderType !== (order.orderType || "PICKUP") ||
        nameChanged ||
        phoneChanged ||
        discountChanged;
      if (detailsChanged) {
        await api.patch(`/orders/${order.id}/details`, {
          ...(paymentMethodChanged && { paymentMethod: finalPaymentMethod }),
          // Manda cashReceived sempre que a forma OU a composição do split
          // mudar — sem isso, editar só os valores de um pedido já SPLIT
          // nunca atualizava quanto de fato é dinheiro (paymentMethod
          // continuava "SPLIT" nos dois lados, então o patch de paymentMethod
          // sozinho nunca disparava).
          ...((paymentMethodChanged || cashReceivedChanged) && { cashReceived: finalCashReceived }),
          ...(orderType !== (order.orderType || "PICKUP") && { orderType }),
          ...(convertingToDelivery && {
            deliveryAddress: deliveryAddress.trim(),
            neighborhood: neighborhood.trim() || undefined,
          }),
          ...(nameChanged && { customerName: editCustomerName.trim() }),
          ...(phoneChanged && { customerPhone: editCustomerPhone.trim() }),
          ...(discountChanged && { discount: discountValue }),
        });
      }

      // Corrigir endereço — independente do bloco acima (que só cobre
      // Order/PDV e só durante a conversão retirada->entrega). Endpoint
      // source-routed próprio, cobre PDV e ONLINE, texto puro sem recalcular
      // taxa/total (pedido pode já estar pago).
      if (canCorrectAddress && addressChanged) {
        await api.patch(`/orders/kitchen/${orderSource}/${order.id}/address`, isOnlineOrder ? {
          address: onlineAddr.trim(),
          addressNumber: onlineAddrNumber.trim(),
          complement: onlineComplement.trim(),
          neighborhood: onlineNeighborhood.trim(),
          city: onlineCity.trim(),
        } : {
          deliveryAddress: correctAddress.trim(),
          neighborhood: correctNeighborhood.trim(),
        });
      }

      toast.success("Pedido atualizado");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Editar Pedido</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                Forma de pagamento
              </label>
              <button
                type="button"
                onClick={() => setSplitMode((v) => !v)}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition ${
                  splitMode
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                <SplitSquareHorizontal size={11} /> Dividir
              </button>
            </div>

            {!splitMode ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(PAY_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className={`text-xs font-semibold py-2 rounded-lg border transition ${
                      paymentMethod === value
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2 bg-gray-50 border border-gray-100 rounded-xl p-3">
                {splits.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <select
                      value={s.method}
                      onChange={(e) => updateSplit(idx, { method: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none bg-white"
                    >
                      {Object.entries(PAY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">R$</span>
                      <input
                        value={s.amount}
                        onChange={(e) => updateSplit(idx, { amount: e.target.value.replace(",", ".") })}
                        onFocus={() => !s.amount && autoFillSplit(idx)}
                        placeholder="0,00"
                        inputMode="decimal"
                        className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                    {splits.length > 2 && (
                      <button type="button" onClick={() => removeSplit(idx)} className="text-gray-400 hover:text-red-500 shrink-0">
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {splits.length < 3 && (
                  <button
                    type="button"
                    onClick={addSplit}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <Plus size={12} /> Adicionar forma
                  </button>
                )}
                <div className={`text-[11px] font-semibold flex justify-between pt-1 border-t border-gray-200 ${Math.abs(splitDiff) > 0.01 ? "text-red-500" : "text-green-600"}`}>
                  <span>Total do pedido: R$ {Number(order.total).toFixed(2)}</span>
                  <span>{Math.abs(splitDiff) > 0.01 ? `Falta R$ ${splitDiff.toFixed(2)}` : "✓ Confere"}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Tipo de pedido
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "PICKUP", label: "Retirada" },
                { value: "DELIVERY", label: "Entrega" },
                { value: "DINE_IN", label: "Local" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={typeLocked}
                  onClick={() => setOrderType(opt.value)}
                  className={`text-xs font-semibold py-2 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    orderType === opt.value
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {typeLocked && (
              <p className="text-[11px] text-gray-400 mt-1">
                Pedido já despachado/entregue — tipo não pode mais ser trocado.
              </p>
            )}
          </div>

          {convertingToDelivery && (
            <div className="space-y-2 bg-orange-50 border border-orange-100 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-orange-700">
                Convertendo para entrega — a taxa é calculada automaticamente pelo bairro.
              </p>
              <input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Endereço completo (rua, número)"
                className="w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
              />
              <input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Bairro (pra calcular a taxa)"
                className="w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          {/* Corrigir endereço — pedido já nasceu (ou já está) como entrega;
              cliente digitou errado no cardápio/PDV. Nunca mexe em taxa/total
              já cobrado, só corrige o texto que a cozinha/entregador vê. */}
          {!convertingToDelivery && canCorrectAddress && (
            <div className="space-y-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-blue-700">
                Corrigir endereço de entrega (não altera a taxa já cobrada)
              </p>
              {isOnlineOrder ? (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      value={onlineAddr}
                      onChange={(e) => setOnlineAddr(e.target.value)}
                      placeholder="Rua"
                      className="col-span-2 w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
                    />
                    <input
                      value={onlineAddrNumber}
                      onChange={(e) => setOnlineAddrNumber(e.target.value)}
                      placeholder="Número"
                      className="w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <input
                    value={onlineComplement}
                    onChange={(e) => setOnlineComplement(e.target.value)}
                    placeholder="Complemento (opcional)"
                    className="w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      value={onlineNeighborhood}
                      onChange={(e) => setOnlineNeighborhood(e.target.value)}
                      placeholder="Bairro"
                      className="w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
                    />
                    <input
                      value={onlineCity}
                      onChange={(e) => setOnlineCity(e.target.value)}
                      placeholder="Cidade"
                      className="w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <input
                    value={correctAddress}
                    onChange={(e) => setCorrectAddress(e.target.value)}
                    placeholder="Endereço completo (rua, número)"
                    className="w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
                  />
                  <input
                    value={correctNeighborhood}
                    onChange={(e) => setCorrectNeighborhood(e.target.value)}
                    placeholder="Bairro"
                    className="w-full border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Itens do pedido
            </label>
            <div className="space-y-1.5 mb-2">
              {order.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-700">{it.quantity}x {it.productName}</span>
                  <span className="font-semibold text-gray-600">R$ {Number(it.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {orderFinalized ? (
              <p className="text-[11px] text-gray-400">
                Pedido já finalizado/cancelado — não é mais possível acrescentar itens.
              </p>
            ) : (
              <div className="flex items-center gap-1.5">
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none bg-white"
                >
                  <option value="">Escolher produto...</option>
                  {products.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R$ {Number(p.salePrice).toFixed(2)}
                    </option>
                  ))}
                </select>
                <input
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  className="w-12 border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none text-center"
                />
                <button
                  type="button"
                  onClick={addItem}
                  disabled={addingItem || !addProductId}
                  className="shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white p-2 rounded-lg transition"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Desconto
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/[^0-9,.]/g, ""))}
                placeholder="0,00"
                inputMode="decimal"
                className="w-full border border-gray-200 focus:border-primary rounded-lg pl-8 pr-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-400">
              <span>Ex: abater diferença de troco que faltou no fechamento</span>
              <span className="font-semibold text-gray-600 whitespace-nowrap ml-2">
                Total: R$ {totalAfterDiscount.toFixed(2)}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Observações do pedido
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none resize-none"
              placeholder="Ex: sem cebola, ponto da carne..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Cliente
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                placeholder="Nome do cliente"
                className="border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
              />
              <input
                value={editCustomerPhone}
                onChange={(e) => setEditCustomerPhone(e.target.value)}
                placeholder="Telefone"
                className="border border-gray-200 focus:border-primary rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            {hasLinkedCustomer && (
              <p className="text-[11px] text-gray-400 mt-1">
                Este pedido está vinculado a um cadastro de cliente — editar aqui corrige só este pedido, não o cadastro.
              </p>
            )}
            {order.deliveryAddress && (
              <p className="text-xs text-gray-400 mt-2"><strong>Endereço:</strong> {order.deliveryAddress}</p>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [companyName, setCompanyName] = useState("Restaurante");
  const [showHistory, setShowHistory] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [sharingLocationId, setSharingLocationId] = useState<string | null>(null);
  // Trava contra clique duplo no botão Imprimir — sem isso, 2-3 cliques rápidos
  // no mesmo pedido abrem 2-3 janelas de impressão (o pop-up não bloqueia o clique seguinte).
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const { user } = useAuthStore();

  const fetchOrders = useCallback(async () => {
    try {
      // Endpoint unificado (Item 4 — Caminho 2): PDV + Cardápio Digital
      const response = await api.get("/orders/kitchen");
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Só usado se o módulo "delivery" estiver ativo pro tenant — falha
  // silenciosa (fica lista vazia, o seletor de entregador não aparece).
  async function fetchDrivers() {
    try {
      const res = await api.get("/drivers");
      const list: any[] = Array.isArray(res.data) ? res.data : [];
      setDrivers(
        list
          .filter((d) => d.user?.isActive)
          .map((d) => ({ id: d.id, name: d.user.name })),
      );
    } catch {
      // sem módulo delivery ou sem entregador cadastrado — normal, ignora
    }
  }

  async function assignDriver(orderId: string, driverId: string, source?: string) {
    if (!driverId) return;
    setAssigningOrderId(orderId);
    try {
      await api.post("/drivers/assign", { orderId, driverId, source });
      toast.success("Entregador atualizado");
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao atribuir entregador");
    } finally {
      setAssigningOrderId(null);
    }
  }

  async function shareDriverLocation(orderId: string, source?: string) {
    setSharingLocationId(orderId);
    try {
      await api.post("/drivers/share-location", { orderId, source });
      toast.success("Localização enviada pro cliente por WhatsApp");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao enviar localização");
    } finally {
      setSharingLocationId(null);
    }
  }

  async function fetchCompany() {
    if (!user?.companyId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/company/${user.companyId}`);
      const data = await res.json();
      if (data?.name) setCompanyName(data.name);
    } catch {}
  }

  async function updateStatus(id: string, status: string, source?: string) {
    try {
      const src = (source as string) || "PDV";
      await api.patch(`/orders/kitchen/${src}/${id}/status`, { status });
      toast.success("Status atualizado");
      fetchOrders();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  }

  useEffect(() => {
    fetchOrders();
    fetchCompany();
    fetchDrivers();
    socket.connect();
    socket.on("orderCreated", fetchOrders);
    socket.on("kitchenUpdate", fetchOrders);
    return () => {
      socket.off("orderCreated");
      socket.off("kitchenUpdate");
      socket.disconnect();
    };
  }, [fetchOrders]);

  // Separar ativos × histórico
  const activeOrders  = orders.filter(o => !HISTORY_STATUSES.has(o.status));
  const historyOrders = orders.filter(o =>  HISTORY_STATUSES.has(o.status));
  const displayOrders = showHistory ? historyOrders : activeOrders;

  return (
    <main className="min-h-screen bg-gray-50">
      <PrinterAgentBanner />

      <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-xl">
              <ShoppingCart size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Pedidos</h1>
              <p className="text-gray-400 text-sm">Gestão em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="border border-gray-200 text-gray-500 hover:bg-gray-100 p-2 rounded-xl transition"
              title="Atualizar"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                showHistory
                  ? "bg-gray-800 text-white border-gray-800"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <History size={15} />
              Histórico
              {historyOrders.length > 0 && (
                <span className="bg-gray-400 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {historyOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Legend */}
        {!showHistory && (
          <div className="flex items-center gap-4 mb-5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Em dia (&lt;25 min)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Próximo do prazo (25–45 min)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Atrasado (&gt;45 min)
            </span>
          </div>
        )}

        {/* Orders list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400">Carregando pedidos...</span>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            {showHistory ? "Nenhum pedido no histórico" : "Nenhum pedido ativo no momento"}
          </div>
        ) : (
          <div className="space-y-4">
            {displayOrders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-600 border-gray-200" };
              const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
              const elapsed = elapsedMin(order);
              const isDelivery = order.orderType === "DELIVERY" || Number(order.deliveryFee) > 0;

              return (
                <div
                  key={`${(order as any).source ?? 'PDV'}-${order.id}`}
                  className={`bg-white rounded-2xl border-2 overflow-hidden transition ${timingBorderClass(order)}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      {/* Timing dot */}
                      {!HISTORY_STATUSES.has(order.status) && (
                        <span className={`w-3 h-3 rounded-full shrink-0 ${timingDotClass(order)}`} />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-gray-400" />
                          <p className="font-black text-gray-900 text-sm">{customerName(order)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Phone size={11} className="text-gray-400" />
                          <p className="text-gray-400 text-xs">{customerPhone(order)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock size={11} className="text-gray-400" />
                          <p className="text-gray-400 text-xs">{fmtDateTime(order)}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      {/* Adapter Item 4 — fonte do pedido */}
                      {(order as any).source === "NINETY_NINE_FOOD" ? (
                        <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md tracking-wide bg-yellow-100 text-yellow-800 border border-yellow-300">
                          <img
                            src="https://play-lh.googleusercontent.com/nfaQypUllRKXUlc5YsratEEtwkLwUuL4fLtxzJvjjZdm0c0MUHT13FfWjyCN0D39EmZAbKk5OmK2NpK-jUKeSdU=s128-rw"
                            alt="99Food"
                            className="w-3.5 h-3.5 rounded-sm object-cover"
                          />
                          99FOOD
                        </span>
                      ) : (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md tracking-wide ${
                          (order as any).source === "ONLINE"
                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                            : (order as any).source === "MOCK"
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : (order as any).source === "IFOOD"
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}>
                          {(order as any).source ?? "PDV"}
                        </span>
                      )}
                      {/* Fase 2: badge de tipo de atendimento */}
                      {order.orderType === "DELIVERY" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                          🛵 Delivery
                        </span>
                      )}
                      {order.orderType === "PICKUP" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                          🏠 Retirada
                        </span>
                      )}
                      {(order.orderType === "DINE_IN" || !order.orderType) && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          🍽️ Balcão
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-primary font-black text-lg">
                          R$ {Number(order.total).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {order.paymentMethod === "SPLIT" ? "Dividido" : (PAY_LABELS[order.paymentMethod] || order.paymentMethod)}
                        </p>
                        {order.paymentStatus === "APPROVED" ? (
                          <p className="text-[10px] font-bold text-green-600 mt-0.5">✓ Já pago (online)</p>
                        ) : order.paymentMethod !== "CASH" && order.paymentStatus ? (
                          <p className="text-[10px] font-bold text-amber-600 mt-0.5">A receber</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4 space-y-3">
                    {/* Fees row */}
                    {(Number(order.deliveryFee) > 0 || Number(order.driverFee) > 0) && (
                      <div className="flex items-center gap-4 text-xs bg-blue-50 rounded-xl px-3 py-2">
                        {Number(order.deliveryFee) > 0 && (
                          <span className="text-blue-700">
                            <strong>Taxa cliente:</strong> R$ {Number(order.deliveryFee).toFixed(2)}
                          </span>
                        )}
                        {Number(order.driverFee) > 0 && (
                          <span className="text-purple-700">
                            <strong>Taxa entregador:</strong> R$ {Number(order.driverFee).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Timing row */}
                    {!HISTORY_STATUSES.has(order.status) && (
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {order.confirmedAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={11} className="text-green-500" />
                            Aceito às {new Date(order.confirmedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {isDelivery && order.confirmedAt && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            Previsão: {estimatedDelivery(order)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {elapsed}min
                        </span>
                      </div>
                    )}

                    {/* Address — clicável, abre direto no Maps/Waze (mesmo padrão do app do entregador) */}
                    {order.deliveryAddress && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-primary flex items-center gap-1 underline decoration-dotted"
                        >
                          <MapPin size={11} /> {order.deliveryAddress}
                        </a>
                        <a
                          href={`https://waze.com/ul?q=${encodeURIComponent(order.deliveryAddress)}&navigate=yes`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-500 hover:text-sky-600 flex items-center gap-1 font-semibold"
                        >
                          <Navigation size={11} /> Waze
                        </a>
                      </div>
                    )}

                    {/* Notes */}
                    {order.notes && (
                      <p className="text-xs text-primary bg-primary/5 rounded-lg px-3 py-2">
                        Obs: {order.notes}
                      </p>
                    )}

                    {/* Items */}
                    <div className="space-y-1">
                      {items.map((item) => (
                        <div key={item.id} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-700">
                              <span className="font-bold text-primary">{item.quantity}x</span>{" "}
                              {item.productName}
                              {item.notes && <span className="text-gray-400 ml-2 text-xs">({item.notes})</span>}
                            </span>
                            <span className="text-gray-500 font-medium">
                              R$ {Number(item.subtotal).toFixed(2)}
                            </span>
                          </div>
                          {/* Sabor/complementos escolhidos — sem isso, um produto travado em
                              1 sabor (ex: combo de promoção) aparece só com o nome genérico
                              do combo, sem indicar QUAL sabor o cliente escolheu (achado real:
                              13/08/2026, cozinha recebendo "As Mais Mais do Dia" sem saber
                              qual das 4 opções preparar — o dado já vinha certo da API, só
                              nunca era renderizado aqui). Mesmo padrão visual do KitchenBoard. */}
                          {Array.isArray(item.selectedComplements) && item.selectedComplements.length > 0 && (
                            <ul className="ml-4 mt-0.5 space-y-0.5">
                              {item.selectedComplements.map((c, ci) => (
                                <li key={ci} className="text-gray-600 text-xs">
                                  + {c.quantity}x {c.optionName}
                                  {Number(c.price) > 0 && (
                                    <span className="text-gray-400 ml-1">(R$ {Number(c.price).toFixed(2)})</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
                    {/* Status select */}
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value, (order as any).source)}
                      className="border border-gray-200 focus:border-primary text-gray-700 px-3 py-2 rounded-xl outline-none text-sm font-medium"
                    >
                      <option value="PENDING">Pendente</option>
                      <option value="CONFIRMED">Confirmado</option>
                      <option value="PREPARING">Preparando</option>
                      <option value="READY">Pronto</option>
                      <option value="OUT_FOR_DELIVERY">Saiu entrega</option>
                      <option value="DELIVERED">Finalizado</option>
                      <option value="CANCELLED">Cancelado</option>
                    </select>

                    {/* Despachar para entrega — pedido de delivery pronto, sem entregador ainda */}
                    {order.status === "READY" && isDelivery && drivers.length > 0 && (
                      <select
                        disabled={assigningOrderId === order.id}
                        defaultValue=""
                        onChange={(e) => e.target.value && assignDriver(order.id, e.target.value, (order as any).source)}
                        style={{ colorScheme: "dark" }}
                        className="border border-purple-500/30 bg-purple-500/15 text-purple-200 px-3 py-2 rounded-xl outline-none text-sm font-bold disabled:opacity-60"
                      >
                        <option value="" disabled>🛵 Despachar com...</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    )}

                    {/* Fallback: sem entregador cadastrado, ou pedido não é delivery — despacha sem atribuir ninguém */}
                    {order.status === "READY" && (!isDelivery || drivers.length === 0) && (
                      <button
                        onClick={() => updateStatus(order.id, "OUT_FOR_DELIVERY", (order as any).source)}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
                      >
                        <Truck size={14} /> Despachar entrega
                      </button>
                    )}

                    {/* Entregador já em rota — mostra quem está e permite trocar */}
                    {order.status === "OUT_FOR_DELIVERY" && isDelivery && drivers.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Truck size={12} className="text-purple-500" />
                          {order.driverName ?? "Sem entregador"}
                        </span>
                        <select
                          disabled={assigningOrderId === order.id}
                          value={order.driverId ?? ""}
                          onChange={(e) => e.target.value && assignDriver(order.id, e.target.value, (order as any).source)}
                          className="border border-gray-200 text-gray-600 px-2 py-1.5 rounded-lg outline-none text-xs font-medium disabled:opacity-60"
                        >
                          <option value="" disabled>Trocar...</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Manda a localização ATUAL do entregador pro cliente via WhatsApp —
                        pra usar quando o cliente liga perguntando "cadê meu pedido". */}
                    {order.status === "OUT_FOR_DELIVERY" && order.driverId && (
                      <button
                        onClick={() => shareDriverLocation(order.id, (order as any).source)}
                        disabled={sharingLocationId === order.id}
                        title="Enviar localização do entregador pro cliente por WhatsApp"
                        className="flex items-center gap-1.5 border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-600 px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-60"
                      >
                        <Navigation size={12} />
                        {sharingLocationId === order.id ? "Enviando..." : "Enviar localização"}
                      </button>
                    )}

                    {/* Finalizar */}
                    {(order.status === "OUT_FOR_DELIVERY" || order.status === "READY") && (
                      <button
                        onClick={() => {
                          if (!confirm("Finalizar este pedido?")) return;
                          updateStatus(order.id, "DELIVERED", (order as any).source);
                        }}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
                      >
                        <CheckCircle2 size={14} /> Finalizar
                      </button>
                    )}

                    {/* Editar */}
                    <button
                      onClick={() => setEditingOrder(order)}
                      className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium transition ml-auto"
                    >
                      Editar
                    </button>

                    {/* Imprimir */}
                    <button
                      disabled={printingOrderId === order.id}
                      onClick={async () => {
                        if (printingOrderId === order.id) return;
                        setPrintingOrderId(order.id);
                        try {
                          await printOrder(order, companyName);
                        } finally {
                          setPrintingOrderId(null);
                        }
                      }}
                      className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Printer size={14} /> {printingOrderId === order.id ? "Imprimindo..." : "Imprimir"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingOrder && (
        <EditNotesModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={fetchOrders}
        />
      )}
      </div>{/* /p-6 md:p-8 */}
    </main>
  );
}
