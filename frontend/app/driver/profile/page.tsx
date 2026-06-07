"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/services/api";
import { Bike, Phone, Mail, LogOut } from "lucide-react";
import toast from "react-hot-toast";

interface DriverProfile {
  id: string;
  phone: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  isAvailable: boolean;
  companyId: string;
  user: { id: string; name: string; email: string };
}

const FIELD_ROW = "flex items-center gap-3 py-3 border-b border-gray-50 last:border-0";
const LABEL = "text-xs text-gray-400 uppercase tracking-wide w-24 shrink-0";
const VALUE = "text-sm font-medium text-gray-800";

export default function DriverProfilePage() {
  const { logout } = useAuthStore();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DriverProfile>("/drivers/me")
      .then((res) => setProfile(res.data))
      .catch(() => toast.error("Erro ao carregar perfil"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-3">
          <Bike size={36} className="text-orange-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{profile.user.name}</h1>
        <span className={`mt-1 px-3 py-1 rounded-full text-xs font-semibold
          ${profile.isAvailable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
          {profile.isAvailable ? "Disponível" : "Indisponível"}
        </span>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className={FIELD_ROW}>
          <span className={LABEL}>Email</span>
          <Mail size={14} className="text-gray-300 shrink-0" />
          <span className={VALUE}>{profile.user.email}</span>
        </div>
        <div className={FIELD_ROW}>
          <span className={LABEL}>Telefone</span>
          <Phone size={14} className="text-gray-300 shrink-0" />
          <span className={VALUE}>{profile.phone ?? "—"}</span>
        </div>
        <div className={FIELD_ROW}>
          <span className={LABEL}>Veículo</span>
          <Bike size={14} className="text-gray-300 shrink-0" />
          <span className={VALUE}>{profile.vehicleType ?? "—"}</span>
        </div>
        <div className={FIELD_ROW}>
          <span className={LABEL}>Placa</span>
          <span className="text-gray-300 w-3.5 shrink-0" />
          <span className={`${VALUE} font-mono`}>{profile.vehiclePlate ?? "—"}</span>
        </div>
      </div>

      <p className="text-center text-xs text-gray-300 mb-6">
        Para editar suas informações, fale com o administrador.
      </p>

      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-500 font-semibold text-sm hover:bg-red-100 transition"
      >
        <LogOut size={16} />
        Sair
      </button>
    </div>
  );
}
