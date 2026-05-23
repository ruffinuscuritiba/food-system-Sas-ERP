"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const plan = searchParams.get("plan") || "DELIVERY";

  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    try {
      setLoading(true);

      alert(`Plano selecionado: ${plan}`);

      router.push("/login");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
        color: "#fff",
      }}
    >
      <div
        style={{
          width: 400,
          padding: 24,
          background: "#111",
          borderRadius: 12,
        }}
      >
        <h1 style={{ fontSize: 32, marginBottom: 24 }}>
          Signup
        </h1>

        <form onSubmit={handleSubmit}>
          <input
            placeholder="Empresa"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
            }}
          />

          <input
            placeholder="Email"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
            }}
          />

          <input
            placeholder="Senha"
            type="password"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
            }}
          >
            {loading ? "Carregando..." : "Criar conta"}
          </button>
        </form>

        <div style={{ marginTop: 20 }}>
          <Link href="/login">
            Ir para login
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupContent />
    </Suspense>
  );
}