"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Power, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import { createBrand, deleteBrand, listBrands, setBrandStatus, updateBrand, type BrandDto } from "@/lib/admin-api";

const slugify = (value: string) => value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  slug: z.string().regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalido"),
  logoUrl: z.string().optional(),
  isActive: z.boolean()
});

type FormValues = z.infer<typeof schema>;

export default function AdminBrandsPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [editing, setEditing] = useState<BrandDto | null>(null);
  const [apiError, setApiError] = useState("");
  const { data: brands = [], isLoading, error } = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isActive: true } });
  const createMutation = useMutation({ mutationFn: createBrand, onSuccess: async () => { setApiError(""); form.reset({ isActive: true }); await queryClient.invalidateQueries({ queryKey: ["brands"] }); toast.success("Marca registrada correctamente."); }, onError: (mutationError: Error) => { setApiError(mutationError.message); toast.error(mutationError.message); } });
  const updateMutation = useMutation({ mutationFn: updateBrand, onSuccess: async () => { setApiError(""); setEditing(null); form.reset({ isActive: true }); await queryClient.invalidateQueries({ queryKey: ["brands"] }); toast.success("Marca actualizada correctamente."); }, onError: (mutationError: Error) => { setApiError(mutationError.message); toast.error(mutationError.message); } });

  const submit = (values: FormValues) => {
    const payload = { ...values, slug: values.slug || slugify(values.name), logoUrl: values.logoUrl || undefined };
    if (editing) updateMutation.mutate({ ...payload, id: editing.id });
    else createMutation.mutate(payload);
  };

  const startEdit = (brand: BrandDto) => {
    setEditing(brand);
    setApiError("");
    form.reset({ name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl ?? "", isActive: brand.isActive });
  };

  const cancelEdit = () => {
    setEditing(null);
    setApiError("");
    form.reset({ isActive: true });
  };

  return (
    <AdminShell title="Marcas" description="Mantenimiento de marcas para catalogo, filtros y promociones.">
      <form onSubmit={form.handleSubmit(submit)} className="rounded-md border border-border p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input className="rounded-md border border-border bg-background p-3" placeholder="Nombre" {...form.register("name", { onBlur: () => !form.getValues("slug") && form.setValue("slug", slugify(form.getValues("name")), { shouldValidate: true }) })} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Slug" {...form.register("slug")} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Logo URL" {...form.register("logoUrl")} />
          <div className="flex gap-2"><Button disabled={createMutation.isPending || updateMutation.isPending}><Save size={18} /> {editing ? "Actualizar" : "Crear"}</Button>{editing && <Button type="button" variant="secondary" onClick={cancelEdit}><X size={18} /> Cancelar</Button>}</div>
        </div>
        {Object.values(form.formState.errors)[0]?.message && <p className="mt-3 text-sm text-red-600">{Object.values(form.formState.errors)[0]?.message}</p>}
        {(apiError || error) && <p className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{apiError || "No se pudo cargar marcas. Valida que el backend este corriendo y que hayas iniciado sesion como Administrator."}</p>}
      </form>
      <section className="mt-6 overflow-hidden rounded-md border border-border"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Marca</th><th className="p-3">Slug</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr></thead><tbody>{isLoading && <tr><td className="p-3" colSpan={4}>Cargando marcas...</td></tr>}{!isLoading && brands.length === 0 && <tr><td className="p-3" colSpan={4}>No hay marcas registradas.</td></tr>}{brands.map((brand) => <tr key={brand.id} className="border-t border-border"><td className="p-3 font-semibold">{brand.name}</td><td className="p-3">{brand.slug}</td><td className="p-3">{brand.isActive ? "Activo" : "Inactivo"}</td><td className="flex gap-2 p-3"><Button variant="ghost" onClick={() => startEdit(brand)} aria-label="Editar marca"><Edit3 size={16} /></Button><Button variant="ghost" onClick={() => setBrandStatus(brand.id, !brand.isActive).then(() => { queryClient.invalidateQueries({ queryKey: ["brands"] }); toast.success(`Marca ${brand.isActive ? "desactivada" : "activada"} correctamente.`); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Power size={16} /></Button><Button variant="ghost" onClick={() => confirm("Eliminar marca?") && deleteBrand(brand.id).then(() => { queryClient.invalidateQueries({ queryKey: ["brands"] }); toast.success("Marca eliminada correctamente."); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Trash2 size={16} /></Button></td></tr>)}</tbody></table></section>
    </AdminShell>
  );
}
