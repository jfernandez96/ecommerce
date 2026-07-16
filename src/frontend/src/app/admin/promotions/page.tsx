"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit3, ImagePlus, Percent, Power, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import { createPromotion, deletePromotion, duplicatePromotion, listBrands, listCategories, listProducts, listPromotions, setPromotionStatus, updatePromotion, uploadAdminImage, type PromotionDto } from "@/lib/admin-api";

const schema = z.object({
  name: z.string().min(3, "Nombre requerido"),
  type: z.coerce.number().int().min(0).max(3),
  value: z.coerce.number().min(0),
  startsAt: z.string().min(1, "Fecha inicio requerida"),
  endsAt: z.string().min(1, "Fecha fin requerida"),
  bannerUrl: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  productId: z.string().optional(),
  isActive: z.boolean()
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;
const promotionTypeValue = (type: string) => ({ Percentage: 0, FixedAmount: 1, TwoForOne: 2, ThreeForTwo: 3 }[type] ?? Number(type));
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export default function AdminPromotionsPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState<PromotionDto | null>(null);
  const [apiError, setApiError] = useState("");
  const { data: promotions = [] } = useQuery({ queryKey: ["promotions"], queryFn: listPromotions });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: listProducts });
  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: { type: 0, value: 0, isActive: false } });
  const bannerUrl = form.watch("bannerUrl");
  const createMutation = useMutation({ mutationFn: createPromotion, onSuccess: async () => { setApiError(""); form.reset({ type: 0, value: 0, isActive: false }); if (fileInputRef.current) fileInputRef.current.value = ""; await queryClient.invalidateQueries({ queryKey: ["promotions"] }); toast.success("Promocion registrada correctamente."); }, onError: (error: Error) => { setApiError(error.message); toast.error(error.message); } });
  const updateMutation = useMutation({ mutationFn: updatePromotion, onSuccess: async () => { setApiError(""); setEditing(null); form.reset({ type: 0, value: 0, isActive: false }); if (fileInputRef.current) fileInputRef.current.value = ""; await queryClient.invalidateQueries({ queryKey: ["promotions"] }); toast.success("Promocion actualizada correctamente."); }, onError: (error: Error) => { setApiError(error.message); toast.error(error.message); } });

  const toDateInput = (value: string) => new Date(value).toISOString().slice(0, 10);
  const buildPayload = (values: FormValues) => ({ ...values, startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString(), bannerUrl: values.bannerUrl || undefined, categoryId: values.categoryId || undefined, brandId: values.brandId || undefined, productId: values.productId || undefined });
  const submit: SubmitHandler<FormValues> = (values) => {
    const payload = buildPayload(values);
    if (editing) updateMutation.mutate({ ...payload, id: editing.id } as unknown as PromotionDto);
    else createMutation.mutate(payload as unknown as Omit<PromotionDto, "id">);
  };
  const startEdit = (promotion: PromotionDto) => {
    setEditing(promotion);
    setApiError("");
    form.reset({ name: promotion.name, type: promotionTypeValue(promotion.type), value: promotion.value, startsAt: toDateInput(promotion.startsAt), endsAt: toDateInput(promotion.endsAt), bannerUrl: promotion.bannerUrl ?? "", categoryId: promotion.categoryId ?? "", brandId: promotion.brandId ?? "", productId: promotion.productId ?? "", isActive: promotion.isActive });
  };
  const cancelEdit = () => {
    setEditing(null);
    setApiError("");
    form.reset({ type: 0, value: 0, isActive: false });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadImage = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_BYTES)
    {
      setApiError("La imagen supera 2 MB. Comprime la imagen o usa una URL externa.");
      return;
    }

    setApiError("");
    try {
      const uploadedUrl = await uploadAdminImage(file, "promotions");
      form.setValue("bannerUrl", uploadedUrl, { shouldValidate: true });
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "No se pudo subir la imagen.");
    }
  };

  const togglePromotionStatus = async (promotion: PromotionDto) => {
    const nextStatus = !promotion.isActive;

    setApiError("");
    try {
      await setPromotionStatus(promotion.id, nextStatus);
      await queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(`Promocion ${nextStatus ? "activada" : "desactivada"} correctamente.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el estado de la promocion.";
      setApiError(message);
      toast.error(message);
    }
  };

  return (
    <AdminShell title="Promociones" description="Puedes crear multiples promociones, pero solo una puede estar activa al mismo tiempo.">
      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form onSubmit={form.handleSubmit(submit)} className="rounded-md border border-border p-5">
        <div className="mb-4 rounded-md bg-muted/50 p-4 text-sm text-foreground/75">
          Crea todas las promociones que necesites y activa solo la campaña vigente. La promocion activa no se usa como banner principal de la home.
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input className="rounded-md border border-border bg-background p-3" placeholder="Nombre" {...form.register("name")} />
          <select className="rounded-md border border-border bg-background p-3" {...form.register("type")}><option value={0}>Descuento %</option><option value={1}>Monto fijo</option><option value={2}>2x1</option><option value={3}>3x2</option></select>
          <input className="rounded-md border border-border bg-background p-3" placeholder="Valor" type="number" step="0.01" {...form.register("value")} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Imagen promocional (URL o archivo)" {...form.register("bannerUrl")} />
          <input className="rounded-md border border-border bg-background p-3" type="date" {...form.register("startsAt")} />
          <input className="rounded-md border border-border bg-background p-3" type="date" {...form.register("endsAt")} />
          <select className="rounded-md border border-border bg-background p-3" {...form.register("productId")}><option value="">Producto especifico</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
          <select className="rounded-md border border-border bg-background p-3" {...form.register("categoryId")}><option value="">Categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select className="rounded-md border border-border bg-background p-3" {...form.register("brandId")}><option value="">Marca</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
          <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground"><input type="checkbox" className="h-4 w-4" {...form.register("isActive")} /> Activar ahora</label>
          <div className="flex gap-2"><Button disabled={createMutation.isPending || updateMutation.isPending}><Percent size={18} /> {editing ? "Actualizar" : "Crear promocion"}</Button>{editing && <Button type="button" variant="secondary" onClick={cancelEdit}><X size={18} /> Cancelar</Button>}</div>
        </div>
        {Object.values(form.formState.errors)[0]?.message && <p className="mt-3 text-sm text-red-600">{Object.values(form.formState.errors)[0]?.message}</p>}
        {apiError && <p className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{apiError}</p>}
      </form>
      <aside className="rounded-md border border-border p-5">
        <h2 className="font-bold">Imagen promocional</h2>
        <label className="relative mt-4 flex aspect-[16/10] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-dashed border-border bg-muted text-center text-foreground/60">
          {bannerUrl ? <ProductImage src={bannerUrl} alt="Preview promocion" fill className="object-cover" /> : <><ImagePlus size={34} /><span className="text-sm font-medium">Seleccionar imagen</span></>}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => loadImage(event.target.files?.[0])} />
        </label>
      </aside>
      </section>
      <section className="mt-6 overflow-hidden rounded-md border border-border"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Nombre</th><th className="p-3">Tipo</th><th className="p-3">Valor</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr></thead><tbody>{promotions.map((promotion) => <tr key={promotion.id} className="border-t border-border"><td className="p-3 font-semibold">{promotion.name}</td><td className="p-3">{promotion.type}</td><td className="p-3">{promotion.value}</td><td className="p-3">{promotion.isActive ? "Activa" : "Inactiva"}</td><td className="flex gap-2 p-3"><Button variant="ghost" onClick={() => startEdit(promotion)} aria-label="Editar promocion"><Edit3 size={16} /></Button><Button variant="ghost" onClick={() => duplicatePromotion(promotion.id).then(() => { queryClient.invalidateQueries({ queryKey: ["promotions"] }); toast.success("Promocion duplicada correctamente."); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Copy size={16} /></Button><Button variant="ghost" onClick={() => togglePromotionStatus(promotion)}><Power size={16} /></Button><Button variant="ghost" onClick={() => confirm("Eliminar promocion?") && deletePromotion(promotion.id).then(() => { queryClient.invalidateQueries({ queryKey: ["promotions"] }); toast.success("Promocion eliminada correctamente."); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Trash2 size={16} /></Button></td></tr>)}</tbody></table></section>
    </AdminShell>
  );
}
