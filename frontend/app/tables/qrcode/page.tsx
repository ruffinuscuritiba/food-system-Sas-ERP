"use client";
import { frontendBaseUrl } from "@/services/env";
import { api } from "@/services/api";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

export default function TablesQrPage() {
  const [companyId, setCompanyId] = useState("");
  const [tableNumbers, setTableNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setCompanyId(user.companyId || "");
    } catch {}

    api.get("/tables")
      .then((r) => {
        const nums = Array.isArray(r.data) && r.data.length > 0
          ? r.data.map((t: any) => t.number).sort((a: number, b: number) => a - b)
          : Array.from({ length: 20 }, (_, i) => i + 1);
        setTableNumbers(nums);
      })
      .catch(() => {
        setTableNumbers(Array.from({ length: 20 }, (_, i) => i + 1));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !companyId) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Carregando QR Codes...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold">QR Code das Mesas</h1>
            <p className="text-slate-400 text-sm mt-1">
              Escaneie para abrir o cardápio e realizar pedidos
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 transition px-5 py-3 rounded-xl font-semibold text-sm"
          >
            <Printer size={18} /> Imprimir
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {tableNumbers.map((table) => {
            const url = `${frontendBaseUrl}/menu/${companyId}?table=${table}`;
            return (
              <div key={table} className="bg-white text-black rounded-2xl p-6 text-center shadow-xl">
                <h2 className="text-2xl font-black mb-4">Mesa {table}</h2>
                <div className="flex justify-center">
                  <QRCodeSVG value={url} size={180} level="M" />
                </div>
                <p className="mt-4 text-gray-400 text-[10px] break-all leading-tight">
                  /menu/{companyId}?table={table}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
