"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Power, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import { createCategory, deleteCategory, listCategories, setCategoryStatus, updateCategory, type CategoryDto } from "@/lib/admin-api";

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  slug: z.string().min(2, "Slug requerido").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalido"),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean()
});

type FormValues = z.infer<typeof schema>;

export default function AdminMenuPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [apiError, setApiError] = useState("");
  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    error: categoriesError
  } = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", sortOrder: 0, isActive: true }
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      setApiError("");
      setEditing(null);
      form.reset({ name: "", slug: "", sortOrder: 0, isActive: true });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Opcion de menu registrada correctamente.");
    },
    onError: (error: Error) => { setApiError(error.message); toast.error(error.message); }
  });

  const updateMutation = useMutation({
    mutationFn: updateCategory,
    onSuccess: async () => {
      setApiError("");
      setEditing(null);
      form.reset({ name: "", slug: "", sortOrder: 0, isActive: true });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Opcion de menu actualizada correctamente.");
    },
    onError: (error: Error) => { setApiError(error.message); toast.error(error.message); }
  });

  const submit: SubmitHandler<FormValues> = async (values) => {
    setApiError("");
    const payload = {
      name: values.name,
      slug: values.slug,
      sortOrder: values.sortOrder,
      parentId: undefined,
      description: undefined,
      imageUrl: undefined,
      isActive: values.isActive
    };

    if (editing) updateMutation.mutate({ ...payload, id: editing.id });
    else createMutation.mutate(payload);
  };

  const menuOptions = categories
    .filter((category) => !category.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const startEdit = (category: CategoryDto) => {
    setEditing(category);
    setApiError("");
    form.reset({
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      isActive: category.isActive
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setApiError("");
    form.reset({ name: "", slug: "", sortOrder: 0, isActive: true });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminShell title="Menu" description="CRUD de opciones principales del menu guardadas en base de datos.">
      <form onSubmit={form.handleSubmit(submit)} className="rounded-md border border-border p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <input className="rounded-md border border-border bg-background p-3" placeholder="Nombre categoria" {...form.register("name")} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Slug" {...form.register("slug")} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Orden" type="number" {...form.register("sortOrder")} />
          <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground"><input type="checkbox" className="h-4 w-4" {...form.register("isActive")} /> Activo</label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={isPending}><Save size={18} /> {editing ? "Actualizar categoria" : "Registrar categoria"}</Button>
          {editing && <Button type="button" variant="secondary" onClick={cancelEdit}><X size={18} /> Cancelar</Button>}
        </div>
        {Object.values(form.formState.errors)[0]?.message && <p className="mt-3 text-sm text-red-600">{Object.values(form.formState.errors)[0]?.message}</p>}
        {apiError && <p className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{apiError}</p>}
      </form>

      <section className="mt-6 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Opcion menu</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Orden</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingCategories && <tr><td className="p-3" colSpan={5}>Cargando opciones de menu...</td></tr>}
            {!!categoriesError && <tr><td className="p-3 text-red-600" colSpan={5}>No se pudieron cargar las opciones de menu.</td></tr>}
            {!isLoadingCategories && !categoriesError && menuOptions.length === 0 && <tr><td className="p-3" colSpan={5}>No hay opciones de menu registradas.</td></tr>}
            {menuOptions.map((category) => (
              <tr key={category.id} className="border-t border-border">
                <td className="p-3 font-semibold">{category.name}</td>
                <td className="p-3">{category.slug}</td>
                <td className="p-3">{category.sortOrder}</td>
                <td className="p-3">{category.isActive ? "Activo" : "Inactivo"}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => startEdit(category)} aria-label="Editar categoria menu"><Edit3 size={16} /></Button>
                    <Button variant="ghost" onClick={() => setCategoryStatus(category.id, !category.isActive).then(() => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success(`Opcion de menu ${category.isActive ? "desactivada" : "activada"} correctamente.`); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Power size={16} /></Button>
                    <Button variant="ghost" onClick={() => confirm("Eliminar categoria del menu?") && deleteCategory(category.id).then(() => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Opcion de menu eliminada correctamente."); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Trash2 size={16} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
