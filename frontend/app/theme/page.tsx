"use client";
import { apiBaseUrl } from "@/services/env";

import ImageUpload from "@/components/ImageUpload";

import {
  useEffect,
  useState,
} from "react";

export default function ThemePage() {

  const companyId =
    "1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a";

  const [theme, setTheme] =
    useState<any>(null);

  useEffect(() => {

    loadTheme();

  }, []);

  async function loadTheme() {

    const response =
      await fetch(
        `${apiBaseUrl}/themes/${companyId}`,
      );

    const data =
      await response.json();

    setTheme(data);
  }

  async function saveTheme() {

    await fetch(
      `${apiBaseUrl}/themes/${companyId}`,
      {

        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          theme,
        ),
      },
    );

    alert(
      "Tema atualizado",
    );
  }

  if (!theme) {

    return (

      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">

        Carregando...

      </div>
    );
  }

  return (

    <main
      className="min-h-screen p-8"
      style={{
        backgroundColor:
          theme.backgroundColor,

        color:
          theme.textColor,
      }}
    >

      <div className="max-w-5xl mx-auto">

        <div className="mb-10">

          <h1 className="text-5xl font-bold">
            Personalização
          </h1>

          <p className="mt-3 opacity-70">
            White-label delivery
          </p>

        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">

          <div
            className="rounded-3xl p-8 border"
            style={{
              borderColor:
                theme.primaryColor,
            }}
          >

            <h2 className="text-3xl font-bold mb-8">
              Configurações
            </h2>

            <div className="space-y-6">

              <div>

                <label className="block mb-2">
                  Cor Primária
                </label>

                <input
                  type="color"
                  value={
                    theme.primaryColor
                  }
                  onChange={(e) =>
                    setTheme({

                      ...theme,

                      primaryColor:
                        e.target.value,
                    })
                  }
                  className="w-full h-14 rounded-xl"
                />

              </div>

              <div>

                <label className="block mb-2">
                  Cor Secundária
                </label>

                <input
                  type="color"
                  value={
                    theme.secondaryColor
                  }
                  onChange={(e) =>
                    setTheme({

                      ...theme,

                      secondaryColor:
                        e.target.value,
                    })
                  }
                  className="w-full h-14 rounded-xl"
                />

              </div>

              <div>

                <label className="block mb-2">
                  Fundo
                </label>

                <input
                  type="color"
                  value={
                    theme.backgroundColor
                  }
                  onChange={(e) =>
                    setTheme({

                      ...theme,

                      backgroundColor:
                        e.target.value,
                    })
                  }
                  className="w-full h-14 rounded-xl"
                />

              </div>

              <div>

                <label className="block mb-2">
                  Cor Texto
                </label>

                <input
                  type="color"
                  value={
                    theme.textColor
                  }
                  onChange={(e) =>
                    setTheme({

                      ...theme,

                      textColor:
                        e.target.value,
                    })
                  }
                  className="w-full h-14 rounded-xl"
                />

              </div>

              <div>

                <label className="block mb-2">
                  Logo URL
                </label>

                <ImageUpload
  value={theme.logoUrl}
  onChange={(url) =>
    setTheme({

      ...theme,

      logoUrl: url,
    })
  }
/>

              </div>

              <div>

                <ImageUpload
  value={theme.bannerUrl}
  onChange={(url) =>
    setTheme({

      ...theme,

      bannerUrl: url,
    })
  }
/>

                <input
                  value={
                    theme.bannerUrl || ""
                  }
                  onChange={(e) =>
                    setTheme({

                      ...theme,

                      bannerUrl:
                        e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4"
                />

              </div>

              <button
                onClick={saveTheme}
                className="w-full py-4 rounded-2xl font-bold text-xl"
                style={{
                  backgroundColor:
                    theme.primaryColor,
                }}
              >
                Salvar Tema
              </button>

            </div>

          </div>

          <div
            className="rounded-3xl overflow-hidden border"
            style={{
              borderColor:
                theme.primaryColor,
            }}
          >

            <div className="relative h-80">

  <img
    src={
      theme.bannerUrl ||

      "https://images.unsplash.com/photo-1513104890138-7c749659a591"
    }
    className="w-full h-full object-cover"
  />

  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">

    {theme.logoUrl && (

      <img
        src={theme.logoUrl}
        className="h-32 object-contain mb-6"
      />

    )}

  </div>

</div>

<div className="p-8">

  <div
    className="rounded-2xl p-6"
    style={{
      backgroundColor:
        theme.secondaryColor,
    }}
  >

    <h3 className="text-2xl font-bold mb-4">
      Preview Tema
    </h3>

    <button
      className="px-6 py-3 rounded-xl font-bold"
      style={{
        backgroundColor:
          theme.primaryColor,
      }}
    >
      Botão Exemplo
    </button>

  </div>

</div>

</div>

</div>

</div>

</main>
  );
}