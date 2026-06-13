"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import toast from "react-hot-toast";

export default function GarcomPerfil() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  function handleLogout() {
    logout();
    toast.success("Até logo!");
    router.push("/login");
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Perfil</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
          <User size={28} className="text-orange-500" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg">{user?.name ?? "Garçom"}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
          <span className="mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
            Garçom
          </span>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-red-200 text-red-500 font-semibold hover:bg-red-50 transition"
      >
        <LogOut size={18} />
        Sair
      </button>
    </div>
  );
}
