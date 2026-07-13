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

const slugify = (value: string) => value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const schema = z.object({
  sectionId: z.string().uuid("Selecciona una seccion"),
  name: z.string().min(2, "Nombre requerido"),
  slug: z.string().regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalido"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true)
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [apiError, setApiError] = useState("");
  const { data: categories = [], isLoading, error } = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const sectionOptions = categories.filter((category) => !category.parentId && category.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const form = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: { sectionId: sectionOptions[0]?.id ?? "", isActive: true, sortOrder: 0 } });
  const createMutation = useMutation({ mutationFn: createCategory, onSuccess: async () => { setApiError(""); form.reset({ sectionId: sectionOptions[0]?.id ?? "", isActive: true, sortOrder: 0 }); await queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Categoria registrada correctamente."); }, onError: (mutationError: Error) => { setApiError(mutationError.message); toast.error(mutationError.message); } });
  const updateMutation = useMutation({ mutationFn: updateCategory, onSuccess: async () => { setApiError(""); setEditing(null); form.reset({ sectionId: sectionOptions[0]?.id ?? "", isActive: true, sortOrder: 0 }); await queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Categoria actualizada correctamente."); }, onError: (mutationError: Error) => { setApiError(mutationError.message); toast.error(mutationError.message); } });

  const submit: SubmitHandler<FormOutput> = async (values) => {
    setApiError("");
    const payload = { ...values, slug: values.slug || slugify(values.name), description: values.description || undefined, imageUrl: values.imageUrl || undefined, parentId: values.sectionId };
    delete (payload as { sectionId?: string }).sectionId;
    if (editing) updateMutation.mutate({ ...payload, id: editing.id });
    else createMutation.mutate(payload);
  };

  const startEdit = (category: CategoryDto) => {
    setEditing(category);
    setApiError("");
    form.reset({ sectionId: category.parentId ?? sectionOptions[0]?.id ?? "", name: category.name, slug: category.slug, description: category.description ?? "", imageUrl: category.imageUrl ?? "", sortOrder: category.sortOrder, isActive: category.isActive });
  };

  const cancelEdit = () => {
    setEditing(null);
    setApiError("");
    form.reset({ sectionId: sectionOptions[0]?.id ?? "", isActive: true, sortOrder: 0 });
  };

  const visibleCategories = categories.filter((category) => category.parentId);

  return (
    <AdminShell title="Categorias" description="Registro de subcategorias por seccion principal: Hombre, Mujeres, Zapatillas y Accesorios.">
      <form onSubmit={form.handleSubmit(submit)} className="rounded-md border border-border p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <select className="rounded-md border border-border bg-background p-3" {...form.register("sectionId")}>
            <option value="">Selecciona seccion</option>
            {sectionOptions.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
          <input className="rounded-md border border-border bg-background p-3" placeholder="Nombre" {...form.register("name", { onBlur: () => !form.getValues("slug") && form.setValue("slug", slugify(form.getValues("name")), { shouldValidate: true }) })} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Slug" {...form.register("slug")} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Imagen URL" {...form.register("imageUrl")} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Orden" type="number" {...form.register("sortOrder")} />
          <div className="flex gap-2"><Button disabled={createMutation.isPending || updateMutation.isPending}><Save size={18} /> {editing ? "Actualizar" : "Crear"}</Button>{editing && <Button type="button" variant="secondary" onClick={cancelEdit}><X size={18} /> Cancelar</Button>}</div>
          <textarea className="min-h-20 rounded-md border border-border bg-background p-3 lg:col-span-5" placeholder="Descripcion" {...form.register("description")} />
        </div>
        {Object.values(form.formState.errors)[0]?.message && <p className="mt-3 text-sm text-red-600">{Object.values(form.formState.errors)[0]?.message}</p>}
        {(apiError || error) && <p className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{apiError || "No se pudo cargar categorias. Valida la conexion al backend y que database/init.sql se haya ejecutado en la base actual."}</p>}
      </form>
      <section className="mt-6 overflow-hidden rounded-md border border-border"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Seccion</th><th className="p-3">Nombre</th><th className="p-3">Slug</th><th className="p-3">Orden</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr></thead><tbody>{isLoading && <tr><td className="p-3" colSpan={6}>Cargando categorias...</td></tr>}{!isLoading && visibleCategories.length === 0 && <tr><td className="p-3" colSpan={6}>No hay subcategorias registradas.</td></tr>}{visibleCategories.map((category) => <tr key={category.id} className="border-t border-border"><td className="p-3">{categories.find((item) => item.id === category.parentId)?.name ?? "-"}</td><td className="p-3 font-semibold">{category.name}</td><td className="p-3">{category.slug}</td><td className="p-3">{category.sortOrder}</td><td className="p-3">{category.isActive ? "Activo" : "Inactivo"}</td><td className="flex gap-2 p-3"><Button variant="ghost" onClick={() => startEdit(category)} aria-label="Editar categoria"><Edit3 size={16} /></Button><Button variant="ghost" onClick={() => setCategoryStatus(category.id, !category.isActive).then(() => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success(`Categoria ${category.isActive ? "desactivada" : "activada"} correctamente.`); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Power size={16} /></Button><Button variant="ghost" onClick={() => confirm("Eliminar categoria?") && deleteCategory(category.id).then(() => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Categoria eliminada correctamente."); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Trash2 size={16} /></Button></td></tr>)}</tbody></table></section>
    </AdminShell>
  );
}
