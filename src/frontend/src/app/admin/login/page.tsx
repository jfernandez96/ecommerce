"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next")?.trim();
  if (!next) return "/admin";
  if (!next.startsWith("/admin")) return "/admin";
  if (next.startsWith("//")) return "/admin";
  return next;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "expired") {
      setError("Tu sesion expiro. Ingresa nuevamente para continuar.");
      return;
    }
    if (reason === "forbidden") {
      setError("No tienes permisos para acceder a este modulo.");
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post("/auth/login", { email, password });
      router.push(getSafeNextPath());
      router.refresh();
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.message.trim()) {
        setError(caughtError.message);
      } else {
        setError("Credenciales invalidas o API no disponible.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl place-items-center px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-md border border-border bg-background p-6 shadow-premium">
        <p className="text-sm uppercase text-primary">Administrador</p>
        <h1 className="mt-2 text-3xl font-black">Acceso privado</h1>
        <p className="mt-3 text-sm text-foreground/60">Ingresa con una cuenta de Administrador o Empleado para acceder al panel.</p>
        <label className="mt-6 block text-sm font-semibold">Correo</label>
        <div className="mt-2 flex items-center gap-2 rounded-md border border-border px-3">
          <Mail size={18} className="text-foreground/45" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent outline-none" type="email" autoComplete="email" placeholder="admin@empresa.com" />
        </div>
        <label className="mt-4 block text-sm font-semibold">Password</label>
        <div className="mt-2 flex items-center gap-2 rounded-md border border-border px-3">
          <LockKeyhole size={18} className="text-foreground/45" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent outline-none" type="password" autoComplete="current-password" placeholder="Tu contraseña" />
        </div>
        {error && <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
        <Button className="mt-6 w-full" disabled={loading}>{loading ? "Ingresando..." : "Entrar al admin"}</Button>
      </form>
    </main>
  );
}