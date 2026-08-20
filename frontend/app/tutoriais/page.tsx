"use client";

import { GraduationCap, PlayCircle } from "lucide-react";
import { TUTORIALS } from "@/lib/tutorials";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

export default function TutoriaisPage() {
  useNavKeyGuard("tutoriais");

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <GraduationCap size={22} /> Tutoriais
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Vídeos curtos explicando como configurar cada setor do sistema.
        </p>
      </div>

      {TUTORIALS.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center gap-3">
          <PlayCircle size={40} className="text-gray-200" />
          <p className="text-sm text-gray-400 text-center max-w-sm">
            Nenhum tutorial publicado ainda. Assim que os primeiros vídeos forem gravados, eles aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TUTORIALS.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="aspect-video bg-black">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${t.youtubeId}`}
                  title={t.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-4">
                <p className="font-bold text-gray-900">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-gray-400 mt-1">{t.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
