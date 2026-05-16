"use client";
import { frontendBaseUrl } from "@/services/env";

import { QRCodeSVG } from "qrcode.react";

export default function TablesQrPage() {

  const tables =
    Array.from(
      { length: 20 },
      (_, i) => i + 1,
    );

  return (

    <main className="min-h-screen bg-slate-950 text-white p-8">

      <h1 className="text-5xl font-bold mb-10">
        QRCode Mesas
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">

        {tables.map((table) => (

          <div
            key={table}
            className="bg-white text-black rounded-3xl p-8 text-center"
          >

            <h2 className="text-3xl font-bold mb-6">

              Mesa {table}

            </h2>

            <QRCodeSVG
              value={`${frontendBaseUrl}/menu?table=${table}`}
              size={220}
            />

            <p className="mt-6 text-gray-500 break-all">

              /menu?table={table}

            </p>

          </div>

        ))}

      </div>

    </main>
  );
}