"use client";

import { FormEvent, useState } from "react";
import { registerClaimBookEntry } from "@/lib/api";

export default function ClaimBookPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResultCode(null);

    const formData = new FormData(event.currentTarget);

    setIsSubmitting(true);
    try {
      const response = await registerClaimBookEntry({
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        documentType: String(formData.get("documentType") ?? ""),
        documentNumber: String(formData.get("documentNumber") ?? ""),
        responseChannel: String(formData.get("responseChannel") ?? ""),
        email: String(formData.get("email") ?? ""),
        address: String(formData.get("address") ?? ""),
        phone: String(formData.get("phone") ?? "") || undefined,
        isMinor: String(formData.get("isMinor") ?? "false") === "true",
        contractedGoodType: String(formData.get("contractedGoodType") ?? ""),
        orderNumber: String(formData.get("orderNumber") ?? "") || undefined,
        claimedAmount: Number(formData.get("claimedAmount") ?? "") || undefined,
        goodDescription: String(formData.get("goodDescription") ?? ""),
        claimType: String(formData.get("claimType") ?? ""),
        claimDetail: String(formData.get("claimDetail") ?? ""),
        consumerRequest: String(formData.get("consumerRequest") ?? ""),
        acceptedTerms: formData.get("acceptedTerms") === "on",
      });

      setResultCode(response.code);
      event.currentTarget.reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el reclamo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-black">Libro de reclamaciones</h1>
      </header>

      <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-border bg-background p-5">
        <section className="space-y-3">
          <h2 className="text-xl font-black">1. Identificacion del consumidor reclamante</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="firstName" required className="rounded-md border border-border p-2" placeholder="Nombres" />
            <input name="lastName" required className="rounded-md border border-border p-2" placeholder="Apellidos" />
            <select name="documentType" required className="rounded-md border border-border p-2">
              <option value="">Tipo de documento</option>
              <option value="DNI">DNI</option>
              <option value="CE">Carnet de extranjeria</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
            <input name="documentNumber" required className="rounded-md border border-border p-2" placeholder="Numero de documento" />
            <select name="responseChannel" required className="rounded-md border border-border p-2 sm:col-span-2">
              <option value="">Tipo de respuesta</option>
              <option value="EMAIL">Correo electronico</option>
              <option value="DOMICILIO">Domicilio</option>
            </select>
            <input name="email" type="email" required className="rounded-md border border-border p-2 sm:col-span-2" placeholder="Correo electronico" />
            <input name="address" required className="rounded-md border border-border p-2 sm:col-span-2" placeholder="Direccion domiciliaria" />
            <input name="phone" className="rounded-md border border-border p-2" placeholder="Telefono (opcional)" />
            <select name="isMinor" className="rounded-md border border-border p-2">
              <option value="false">No es menor de edad</option>
              <option value="true">Es menor de edad</option>
            </select>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black">2. Identificacion del bien contratado</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <select name="contractedGoodType" required className="rounded-md border border-border p-2">
              <option value="">Bien contratado</option>
              <option value="PRODUCTO">Producto</option>
              <option value="SERVICIO">Servicio</option>
            </select>
            <input name="orderNumber" className="rounded-md border border-border p-2" placeholder="Numero de pedido" />
            <input name="claimedAmount" type="number" min="0" step="0.01" className="rounded-md border border-border p-2" placeholder="Monto reclamado" />
            <textarea name="goodDescription" required className="rounded-md border border-border p-2 sm:col-span-3" rows={3} placeholder="Descripcion" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-black">3. Detalle de la reclamacion y pedido del consumidor</h2>
          <div className="grid gap-3 sm:grid-cols-3">  
            <select name="claimType" required className="rounded-md border border-border p-2">
                <option value="">Tipo</option>
                <option value="RECLAMO">Reclamo</option>
                <option value="QUEJA">Queja</option>
            </select>
            <textarea name="claimDetail" required className="rounded-md border border-border p-2 sm:col-span-3" rows={4} placeholder="Detalle" />
            <textarea name="consumerRequest" required className="rounded-md border border-border p-2 sm:col-span-3" rows={3} placeholder="Pedido del consumidor" />
            <label className="inline-flex items-center gap-2 text-sm sm:col-span-3">
                <input type="checkbox" name="acceptedTerms" required />
                Estoy de acuerdo con Terminos y condiciones y Politica de privacidad.
            </label>
          </div>

        </section>

        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {resultCode && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Reclamo registrado correctamente. Codigo: {resultCode}</p>}

        <button disabled={isSubmitting} className="rounded-md bg-black px-4 py-2 text-white transition hover:opacity-90 disabled:opacity-50" type="submit">
          {isSubmitting ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </main>
  );
}
