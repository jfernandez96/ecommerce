"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import {
  createStore,
  listStores,
  updateStore,
  type CreateStorePayload,
  type StoreLocationDto,
} from "@/lib/admin-api";

type StoreFormState = {
  id?: string;
  name: string;
  code: string;
  address: string;
  district: string;
  province: string;
  department: string;
  phone: string;
  pickupInstructions: string;
  isActive: boolean;
};

const emptyForm: StoreFormState = {
  name: "",
  code: "",
  address: "",
  district: "",
  province: "",
  department: "",
  phone: "",
  pickupInstructions: "",
  isActive: true,
};

const toPayload = (form: StoreFormState): CreateStorePayload => ({
  name: form.name.trim(),
  code: form.code.trim().toUpperCase(),
  address: form.address.trim(),
  district: form.district.trim() || undefined,
  province: form.province.trim() || undefined,
  department: form.department.trim() || undefined,
  phone: form.phone.trim() || undefined,
  pickupInstructions: form.pickupInstructions.trim() || undefined,
  isActive: form.isActive,
});

function fromDto(store: StoreLocationDto): StoreFormState {
  return {
    id: store.id,
    name: store.name,
    code: store.code,
    address: store.address,
    district: store.district ?? "",
    province: store.province ?? "",
    department: store.department ?? "",
    phone: store.phone ?? "",
    pickupInstructions: store.pickupInstructions ?? "",
    isActive: store.isActive,
  };
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "No fue posible guardar la tienda.";

export default function AdminStoresPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [form, setForm] = useState<StoreFormState>(emptyForm);

  const storesQuery = useQuery({
    queryKey: ["admin-stores"],
    queryFn: () => listStores(false),
  });

  const createMutation = useMutation({
    mutationFn: createStore,
    onSuccess: async () => {
      toast.success("Tienda creada correctamente.");
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stores-for-inventory"] });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: updateStore,
    onSuccess: async () => {
      toast.success("Tienda actualizada correctamente.");
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stores-for-inventory"] });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const isEditing = Boolean(form.id);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const activeCount = useMemo(() => (storesQuery.data ?? []).filter((store) => store.isActive).length, [storesQuery.data]);

  const submit = () => {
    if (!form.name.trim() || !form.code.trim() || !form.address.trim()) {
      toast.info("Nombre, codigo y direccion son obligatorios.");
      return;
    }

    if (isEditing) {
      updateMutation.mutate({
        id: form.id!,
        ...toPayload(form),
      });
      return;
    }

    createMutation.mutate(toPayload(form));
  };

  return (
    <AdminShell title="Tiendas" description="Administra sucursales para pickup y control de stock por tienda.">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-xl border border-border bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Listado de tiendas</h2>
              <p className="text-sm text-foreground/60">Activas: {activeCount} / {(storesQuery.data ?? []).length}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => storesQuery.refetch()}>
              Recargar
            </Button>
          </div>

          <div className="space-y-3">
            {storesQuery.isLoading && <p className="text-sm text-foreground/60">Cargando tiendas...</p>}
            {!storesQuery.isLoading && (storesQuery.data ?? []).length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-foreground/60">No hay tiendas registradas.</p>
            )}
            {(storesQuery.data ?? []).map((store) => (
              <button
                key={store.id}
                type="button"
                onClick={() => setForm(fromDto(store))}
                className="w-full rounded-xl border border-border px-4 py-3 text-left transition hover:border-primary/50 hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{store.name}</p>
                    <p className="mt-1 truncate text-xs text-foreground/60">{store.code} · {store.address}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${store.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-500/15 text-slate-700"}`}>
                    {store.isActive ? "Activa" : "Inactiva"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{isEditing ? "Editar tienda" : "Nueva tienda"}</h2>
              <p className="text-sm text-foreground/60">Configura la tienda para stock y recogida en checkout.</p>
            </div>
            <Button type="button" variant="ghost" onClick={() => setForm(emptyForm)}>
              <Plus size={16} /> Nuevo
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="rounded-md border border-border bg-background px-3 py-2" placeholder="Nombre de tienda" />
            <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className="rounded-md border border-border bg-background px-3 py-2" placeholder="Codigo (ej. LIMA-CENTRO)" />
            <input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} className="rounded-md border border-border bg-background px-3 py-2" placeholder="Departamento" />
            <input value={form.province} onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))} className="rounded-md border border-border bg-background px-3 py-2" placeholder="Provincia" />
            <input value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} className="rounded-md border border-border bg-background px-3 py-2" placeholder="Distrito" />
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="rounded-md border border-border bg-background px-3 py-2" placeholder="Telefono" />
          </div>

          <textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="mt-3 min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2" placeholder="Direccion completa" />
          <textarea value={form.pickupInstructions} onChange={(event) => setForm((current) => ({ ...current, pickupInstructions: event.target.value }))} className="mt-3 min-h-[90px] w-full rounded-md border border-border bg-background px-3 py-2" placeholder="Instrucciones de recojo (opcional)" />

          <label className="mt-3 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            Tienda activa para checkout e inventario
          </label>

          <Button type="button" onClick={submit} disabled={isSaving} className="mt-4 w-full">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
            {isEditing ? "Guardar cambios" : "Crear tienda"}
          </Button>
        </section>
      </div>
    </AdminShell>
  );
}
