"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit3, ImagePlus, Percent, Power, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import {
  createPromotion,
  deletePromotion,
  duplicatePromotion,
  listBrands,
  listCategories,
  listProducts,
  listPromotions,
  setPromotionStatus,
  updatePromotion,
  uploadAdminImage,
  type PromotionDto,
} from "@/lib/admin-api";

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
  isActive: z.boolean(),
  engineMode: z.enum(["coupon", "segment", "bundle", "bogo", "first-order", "rfm"]),
  couponCode: z.string().optional(),
  segmentRule: z.enum(["all", "new", "vip", "dormant"]).optional(),
  rfmRule: z.enum(["champions", "loyal", "at-risk", "new"]).optional(),
  minOrderAmount: z.coerce.number().min(0).optional(),
  bundleBuyQty: z.coerce.number().int().min(2).max(3).optional(),
  bundlePayQty: z.coerce.number().int().min(1).max(2).optional(),
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;
type EngineMode = "coupon" | "segment" | "bundle" | "bogo" | "first-order" | "rfm";

const promotionTypeValue = (type: string) => ({ Percentage: 0, FixedAmount: 1, TwoForOne: 2, ThreeForTwo: 3 }[type] ?? Number(type));
const promotionTypeLabel = (type: string) => ({ Percentage: "Descuento %", FixedAmount: "Monto fijo", TwoForOne: "2x1", ThreeForTwo: "3x2" }[type] ?? type);
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ENGINE_TAG_REGEX = /\[(\w+):([^\]]+)\]/g;

function stripEngineTags(name: string) {
  return name.replace(ENGINE_TAG_REGEX, "").trim();
}

function findTag(name: string, key: string) {
  const matches = [...name.matchAll(ENGINE_TAG_REGEX)];
  return matches.find((match) => match[1]?.toUpperCase() === key.toUpperCase())?.[2] ?? "";
}

function inferEngineMode(promotion: PromotionDto): EngineMode {
  const upperName = promotion.name.toUpperCase();
  if (upperName.includes("[RFM:")) return "rfm";
  if (upperName.includes("[FIRST_ORDER:")) return "first-order";
  if (upperName.includes("[SEGMENT:")) return "segment";
  if (upperName.includes("[COUPON:")) return "coupon";
  if (promotion.type === "TwoForOne") return "bogo";
  if (promotion.type === "ThreeForTwo") return "bundle";
  return "coupon";
}

function buildEngineName(values: FormValues) {
  const tags: string[] = [];

  if (values.engineMode === "coupon") {
    if (values.couponCode?.trim()) tags.push(`[COUPON:${values.couponCode.trim().toUpperCase()}]`);
    if ((values.minOrderAmount ?? 0) > 0) tags.push(`[MIN_ORDER:${values.minOrderAmount}]`);
  }

  if (values.engineMode === "segment") {
    tags.push(`[SEGMENT:${(values.segmentRule ?? "all").toUpperCase()}]`);
    if ((values.minOrderAmount ?? 0) > 0) tags.push(`[MIN_ORDER:${values.minOrderAmount}]`);
  }

  if (values.engineMode === "bundle") {
    const buyQty = values.bundleBuyQty ?? 3;
    const payQty = values.bundlePayQty ?? 2;
    tags.push(`[BUNDLE:${buyQty}x${payQty}]`);
  }

  if (values.engineMode === "bogo") {
    tags.push("[BOGO:YES]");
  }

  if (values.engineMode === "first-order") {
    tags.push("[FIRST_ORDER:YES]");
    if ((values.minOrderAmount ?? 0) > 0) tags.push(`[MIN_ORDER:${values.minOrderAmount}]`);
  }

  if (values.engineMode === "rfm") {
    tags.push(`[RFM:${(values.rfmRule ?? "loyal").toUpperCase()}]`);
    if ((values.minOrderAmount ?? 0) > 0) tags.push(`[MIN_ORDER:${values.minOrderAmount}]`);
  }

  const cleanName = stripEngineTags(values.name);
  return `${tags.join(" ")} ${cleanName}`.trim();
}

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

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 0,
      value: 0,
      isActive: false,
      engineMode: "coupon",
      segmentRule: "all",
      rfmRule: "loyal",
      minOrderAmount: 0,
      bundleBuyQty: 3,
      bundlePayQty: 2,
    },
  });

  const bannerUrl = form.watch("bannerUrl");
  const engineMode = form.watch("engineMode");

  const createMutation = useMutation({
    mutationFn: createPromotion,
    onSuccess: async () => {
      setApiError("");
      form.reset({
        type: 0,
        value: 0,
        isActive: false,
        engineMode: "coupon",
        segmentRule: "all",
        rfmRule: "loyal",
        minOrderAmount: 0,
        bundleBuyQty: 3,
        bundlePayQty: 2,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promocion registrada correctamente.");
    },
    onError: (error: Error) => {
      setApiError(error.message);
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updatePromotion,
    onSuccess: async () => {
      setApiError("");
      setEditing(null);
      form.reset({
        type: 0,
        value: 0,
        isActive: false,
        engineMode: "coupon",
        segmentRule: "all",
        rfmRule: "loyal",
        minOrderAmount: 0,
        bundleBuyQty: 3,
        bundlePayQty: 2,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promocion actualizada correctamente.");
    },
    onError: (error: Error) => {
      setApiError(error.message);
      toast.error(error.message);
    },
  });

  const toDateInput = (value: string) => new Date(value).toISOString().slice(0, 10);

  const buildPayload = (values: FormValues) => {
    let resolvedType = values.type;
    let resolvedValue = values.value;

    if (values.engineMode === "bogo") {
      resolvedType = 2;
      resolvedValue = 0;
    }

    if (values.engineMode === "bundle") {
      const buyQty = values.bundleBuyQty ?? 3;
      const payQty = values.bundlePayQty ?? 2;
      if (buyQty === 2 && payQty === 1) {
        resolvedType = 2;
        resolvedValue = 0;
      } else {
        resolvedType = 3;
        resolvedValue = 0;
      }
    }

    return {
      name: buildEngineName(values),
      type: resolvedType,
      value: resolvedValue,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      bannerUrl: values.bannerUrl || undefined,
      categoryId: values.categoryId || undefined,
      brandId: values.brandId || undefined,
      productId: values.productId || undefined,
      isActive: values.isActive,
    };
  };

  const rulePreview = useMemo(() => {
    const values = form.getValues();
    const scopeLabel = values.productId
      ? "producto"
      : values.categoryId
        ? "categoria"
        : values.brandId
          ? "marca"
          : "catalogo completo";

    if (engineMode === "coupon") {
      const code = values.couponCode?.trim() || "SIN-CODIGO";
      return `Cupon ${code} sobre ${scopeLabel}.`;
    }

    if (engineMode === "segment") {
      return `Regla por segmento ${values.segmentRule ?? "all"} sobre ${scopeLabel}.`;
    }

    if (engineMode === "bundle") {
      return `Bundle ${values.bundleBuyQty ?? 3}x${values.bundlePayQty ?? 2} sobre ${scopeLabel}.`;
    }

    if (engineMode === "bogo") {
      return `BOGO (lleva 2 paga 1) sobre ${scopeLabel}.`;
    }

    if (engineMode === "first-order") {
      return `Primera compra para clientes nuevos sobre ${scopeLabel}.`;
    }

    return `Regla RFM ${values.rfmRule ?? "loyal"} sobre ${scopeLabel}.`;
  }, [engineMode, form]);

  const submit: SubmitHandler<FormValues> = (values) => {
    if (values.engineMode === "coupon" && !values.couponCode?.trim()) {
      setApiError("Para motor de cupon debes ingresar un codigo.");
      return;
    }

    if (values.engineMode === "bogo" && !values.productId) {
      setApiError("Para BOGO debes seleccionar un producto especifico.");
      return;
    }

    if (values.engineMode === "bundle") {
      const buyQty = values.bundleBuyQty ?? 3;
      const payQty = values.bundlePayQty ?? 2;
      if (!((buyQty === 2 && payQty === 1) || (buyQty === 3 && payQty === 2))) {
        setApiError("Bundle soporta 2x1 o 3x2 en la version actual.");
        return;
      }
    }

    setApiError("");
    const payload = buildPayload(values);
    if (editing) updateMutation.mutate({ ...payload, id: editing.id } as unknown as PromotionDto);
    else createMutation.mutate(payload as unknown as Omit<PromotionDto, "id">);
  };

  const startEdit = (promotion: PromotionDto) => {
    const mode = inferEngineMode(promotion);
    setEditing(promotion);
    setApiError("");

    const bundleTag = findTag(promotion.name, "BUNDLE");
    const [buyPart, payPart] = bundleTag.split("x");
    const bundleBuyQty = Number(buyPart);
    const bundlePayQty = Number(payPart);

    form.reset({
      name: stripEngineTags(promotion.name),
      type: promotionTypeValue(promotion.type),
      value: promotion.value,
      startsAt: toDateInput(promotion.startsAt),
      endsAt: toDateInput(promotion.endsAt),
      bannerUrl: promotion.bannerUrl ?? "",
      categoryId: promotion.categoryId ?? "",
      brandId: promotion.brandId ?? "",
      productId: promotion.productId ?? "",
      isActive: promotion.isActive,
      engineMode: mode,
      couponCode: findTag(promotion.name, "COUPON") || "",
      segmentRule: (findTag(promotion.name, "SEGMENT").toLowerCase() || "all") as "all" | "new" | "vip" | "dormant",
      rfmRule: (findTag(promotion.name, "RFM").toLowerCase() || "loyal") as "champions" | "loyal" | "at-risk" | "new",
      minOrderAmount: Number(findTag(promotion.name, "MIN_ORDER") || 0),
      bundleBuyQty: Number.isFinite(bundleBuyQty) && bundleBuyQty >= 2 ? bundleBuyQty : 3,
      bundlePayQty: Number.isFinite(bundlePayQty) && bundlePayQty >= 1 ? bundlePayQty : 2,
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setApiError("");
    form.reset({
      type: 0,
      value: 0,
      isActive: false,
      engineMode: "coupon",
      segmentRule: "all",
      rfmRule: "loyal",
      minOrderAmount: 0,
      bundleBuyQty: 3,
      bundlePayQty: 2,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadImage = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
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
    <AdminShell title="Promociones" description="Motor flexible para cupon, segmento, bundle, BOGO, primera compra y RFM.">
      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form onSubmit={form.handleSubmit(submit)} className="rounded-md border border-border p-5">
          <div className="mb-4 rounded-md bg-muted/50 p-4 text-sm text-foreground/75">
            Crea multiples reglas y activa solo la campana vigente. El motor avanzado guarda metadatos de cupon/segmento/RFM en el nombre de la promocion para compatibilidad con el backend actual.
          </div>

          <div className="mb-4 grid gap-3 rounded-md border border-border bg-background p-4 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Motor de regla</span>
              <select className="w-full rounded-md border border-border bg-background p-2.5" {...form.register("engineMode")}>
                <option value="coupon">Cupon</option>
                <option value="segment">Regla por segmento</option>
                <option value="bundle">Bundle</option>
                <option value="bogo">BOGO</option>
                <option value="first-order">Primera compra</option>
                <option value="rfm">RFM</option>
              </select>
            </label>

            {engineMode === "coupon" && (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Codigo cupon</span>
                <input className="w-full rounded-md border border-border bg-background p-2.5" placeholder="EJ: JULIO10" {...form.register("couponCode")} />
              </label>
            )}

            {engineMode === "segment" && (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Segmento cliente</span>
                <select className="w-full rounded-md border border-border bg-background p-2.5" {...form.register("segmentRule")}>
                  <option value="all">Todos</option>
                  <option value="new">Nuevos</option>
                  <option value="vip">VIP</option>
                  <option value="dormant">Dormidos</option>
                </select>
              </label>
            )}

            {engineMode === "rfm" && (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Segmento RFM</span>
                <select className="w-full rounded-md border border-border bg-background p-2.5" {...form.register("rfmRule")}>
                  <option value="champions">Champions</option>
                  <option value="loyal">Loyal</option>
                  <option value="at-risk">At Risk</option>
                  <option value="new">New</option>
                </select>
              </label>
            )}

            {engineMode === "bundle" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Lleva</span>
                  <select className="w-full rounded-md border border-border bg-background p-2.5" {...form.register("bundleBuyQty")}>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Paga</span>
                  <select className="w-full rounded-md border border-border bg-background p-2.5" {...form.register("bundlePayQty")}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </label>
              </div>
            )}

            {(engineMode === "coupon" || engineMode === "segment" || engineMode === "first-order" || engineMode === "rfm") && (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Ticket minimo</span>
                <input className="w-full rounded-md border border-border bg-background p-2.5" type="number" step="0.01" {...form.register("minOrderAmount")} />
              </label>
            )}

            <div className="col-span-full rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-foreground/70">
              <div className="mb-1 flex items-center gap-2 font-semibold text-foreground"><Sparkles size={14} /> Vista previa de regla</div>
              <p>{rulePreview}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input className="rounded-md border border-border bg-background p-3" placeholder="Nombre de campana" {...form.register("name")} />
            <select className="rounded-md border border-border bg-background p-3" {...form.register("type")}>
              <option value={0}>Descuento %</option>
              <option value={1}>Monto fijo</option>
              <option value={2}>2x1</option>
              <option value={3}>3x2</option>
            </select>
            <input className="rounded-md border border-border bg-background p-3" placeholder="Valor" type="number" step="0.01" {...form.register("value")} disabled={engineMode === "bogo" || engineMode === "bundle"} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Imagen promocional (URL o archivo)" {...form.register("bannerUrl")} />
            <input className="rounded-md border border-border bg-background p-3" type="date" {...form.register("startsAt")} />
            <input className="rounded-md border border-border bg-background p-3" type="date" {...form.register("endsAt")} />
            <select className="rounded-md border border-border bg-background p-3" {...form.register("productId")}>
              <option value="">Producto especifico</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <select className="rounded-md border border-border bg-background p-3" {...form.register("categoryId")}>
              <option value="">Categoria</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select className="rounded-md border border-border bg-background p-3" {...form.register("brandId")}>
              <option value="">Marca</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
            <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground">
              <input type="checkbox" className="h-4 w-4" {...form.register("isActive")} /> Activar ahora
            </label>
            <div className="flex flex-wrap gap-2">
              <Button disabled={createMutation.isPending || updateMutation.isPending}><Percent size={18} /> {editing ? "Actualizar" : "Crear promocion"}</Button>
              {editing && <Button type="button" variant="secondary" onClick={cancelEdit}><X size={18} /> Cancelar</Button>}
            </div>
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

      <section className="mt-6 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">Regla</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((promotion) => {
              const mode = inferEngineMode(promotion);
              const cleanName = stripEngineTags(promotion.name);

              return (
                <tr key={promotion.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{cleanName}</td>
                  <td className="p-3 uppercase text-xs tracking-wide text-foreground/70">{mode}</td>
                  <td className="p-3">{promotionTypeLabel(promotion.type)}</td>
                  <td className="p-3">{promotion.value}</td>
                  <td className="p-3">{promotion.isActive ? "Activa" : "Inactiva"}</td>
                  <td className="flex gap-2 p-3">
                    <Button variant="ghost" onClick={() => startEdit(promotion)} aria-label="Editar promocion"><Edit3 size={16} /></Button>
                    <Button variant="ghost" onClick={() => duplicatePromotion(promotion.id).then(() => { queryClient.invalidateQueries({ queryKey: ["promotions"] }); toast.success("Promocion duplicada correctamente."); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Copy size={16} /></Button>
                    <Button variant="ghost" onClick={() => togglePromotionStatus(promotion)}><Power size={16} /></Button>
                    <Button variant="ghost" onClick={() => confirm("Eliminar promocion?") && deletePromotion(promotion.id).then(() => { queryClient.invalidateQueries({ queryKey: ["promotions"] }); toast.success("Promocion eliminada correctamente."); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Trash2 size={16} /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
