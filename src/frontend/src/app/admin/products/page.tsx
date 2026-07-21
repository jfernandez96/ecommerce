"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, ImagePlus, PackagePlus, Power, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import { createProduct, deleteProduct, getProduct, listBrands, listCategories, listStores, searchAdminProducts, setProductStatus, updateProduct, uploadAdminImage } from "@/lib/admin-api";
import { resolveMediaUrl } from "@/lib/media-url";
import { formatCurrency } from "@/lib/utils";

const slugify = (value: string) => value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const parseCsv = (value: string) => Array.from(new Set(value.split(",").map((item) => item.trim()).filter((item) => item.length > 0)));
const variantKey = (size: string, color: string) => `${size.toLowerCase()}::${color.toLowerCase()}`;
const productDefaults = { name: "", slug: "", sku: "", code: "", brandId: "", categoryId: "", mainStoreId: "", regularPrice: undefined, salePrice: undefined, cost: undefined, stock: undefined, minimumStock: undefined, weightKg: undefined, material: "", sizesCsv: "", colorsCsv: "", description: "", longDescription: "", videoUrl: "", seoTitle: "", seoDescription: "", status: 1 };
const MAX_IMAGES = 4;

type ExistingImageState = { url: string; color?: string | null; cacheTag?: string };
type NewImageState = { file: File; color?: string | null };

const uniqueProductCode = (base: string) => `${base || "producto"}-${Date.now().toString(36)}`.slice(0, 80);
const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrio un error inesperado. Intentalo nuevamente.";
};
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

const schema = z.object({
  sectionId: z.string().uuid("Selecciona seccion"),
  name: z.string().min(3, "Ingresa un nombre"),
  slug: z.string().regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalido"),
  sku: z.string().optional().default(""),
  code: z.string().optional().default(""),
  brandId: z.string().uuid("Selecciona marca"),
  categoryId: z.string().uuid("Selecciona categoria"),
  mainStoreId: z.string().uuid("Selecciona tienda principal"),
  regularPrice: z.coerce.number().positive("Precio venta requerido"),
  salePrice: z.coerce.number().optional(),
  cost: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  minimumStock: z.coerce.number().int().min(0),
  weightKg: z.coerce.number().min(0),
  material: z.string().optional().default(""),
  sizesCsv: z.string().min(1, "Ingresa al menos una talla (separadas por coma)"),
  colorsCsv: z.string().min(1, "Ingresa al menos un color (separados por coma)"),
  description: z.string().min(5, "Descripcion corta requerida"),
  longDescription: z.string().min(5, "Descripcion larga requerida"),
  videoUrl: z.string().optional(),
  seoTitle: z.string().optional().default(""),
  seoDescription: z.string().optional().default(""),
  status: z.coerce.number().int().min(0).max(3)
}).refine((values) => !values.salePrice || values.salePrice < values.regularPrice, {
  message: "El precio de oferta debe ser menor al precio regular",
  path: ["salePrice"]
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [newImages, setNewImages] = useState<NewImageState[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImageState[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileListQuery, setMobileListQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [variantStockByKey, setVariantStockByKey] = useState<Record<string, number>>({});
  const { data: productsPage, isLoading: isProductsLoading } = useQuery({
    queryKey: ["admin-products-search", page, pageSize, searchTerm],
    queryFn: () => searchAdminProducts({ page, pageSize, query: searchTerm.trim(), sortBy: "newest" })
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const { data: stores = [] } = useQuery({ queryKey: ["stores-for-products"], queryFn: () => listStores(true) });
  const products = productsPage?.items ?? [];
  const mobileFilteredProducts = useMemo(() => {
    const term = mobileListQuery.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => (`${product.name} ${product.sku ?? ""} ${product.brand} ${product.description ?? ""}`).toLowerCase().includes(term));
  }, [mobileListQuery, products]);
  const totalItems = productsPage?.totalItems ?? 0;
  const totalPages = Math.max(productsPage?.totalPages ?? 1, 1);
  const isAlertMessage = /(error|network|ocurrio|debes|solo puedes|invalido|no autorizada)/i.test(message);
  const uploadedPreviews = useMemo(() => newImages.map((image, index) => ({ key: `new-${image.file.name}-${index}`, name: image.file.name, url: URL.createObjectURL(image.file), color: image.color })), [newImages]);
  useEffect(() => () => uploadedPreviews.forEach((preview) => URL.revokeObjectURL(preview.url)), [uploadedPreviews]);
  const sectionOptions = useMemo(() => categories.filter((category) => !category.parentId && category.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [categories]);
  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: { ...productDefaults, sectionId: sectionOptions[0]?.id ?? "" } });
  const sizesCsvValue = form.watch("sizesCsv");
  const colorsCsvValue = form.watch("colorsCsv");
  const sizes = useMemo(() => parseCsv(sizesCsvValue ?? ""), [sizesCsvValue]);
  const colors = useMemo(() => parseCsv(colorsCsvValue ?? ""), [colorsCsvValue]);
  const variantMatrix = useMemo(
    () => sizes.flatMap((size) => colors.map((color) => ({ size, color, key: variantKey(size, color) }))),
    [colors, sizes]
  );
  const computedStock = useMemo(
    () => variantMatrix.reduce((total, variant) => total + Math.max(0, Number(variantStockByKey[variant.key] ?? 0)), 0),
    [variantMatrix, variantStockByKey]
  );
  const selectedSectionId = form.watch("sectionId");
  const availableCategories = useMemo(() => categories.filter((category) => !!category.parentId && category.parentId === selectedSectionId), [categories, selectedSectionId]);
  const clearForm = () => {
    form.reset({ ...productDefaults, sectionId: sectionOptions[0]?.id ?? "" });
    setVariantStockByKey({});
    setNewImages([]);
    setExistingImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const createMutation = useMutation({ mutationFn: createProduct, onSuccess: async () => { setMessage("Producto registrado correctamente."); clearForm(); await queryClient.invalidateQueries({ queryKey: ["admin-products-search"] }); toast.success("Producto registrado correctamente."); }, onError: (error: unknown) => { const message = getErrorMessage(error); setMessage(message); toast.error(message); } });
  const updateMutation = useMutation({ mutationFn: updateProduct, onSuccess: async () => { cancelEdit(); setMessage("Producto actualizado correctamente."); await queryClient.invalidateQueries({ queryKey: ["admin-products-search"] }); toast.success("Producto actualizado correctamente."); }, onError: (error: unknown) => { const message = getErrorMessage(error); setMessage(message); toast.error(message); } });

  const removeExistingImage = (index: number) => setExistingImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  const removeNewImage = (index: number) => setNewImages((current) => current.filter((_, currentIndex) => currentIndex !== index));

  const setExistingImageColor = (index: number, color: string) => setExistingImages((current) => current.map((image, currentIndex) => currentIndex === index ? { ...image, color: color || null } : image));
  const setNewImageColor = (index: number, color: string) => setNewImages((current) => current.map((image, currentIndex) => currentIndex === index ? { ...image, color: color || null } : image));

  const onImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedImages = Array.from(event.target.files ?? []);
    if (!selectedImages.length) return;

    const validImages = selectedImages.filter((file) => file.size <= MAX_IMAGE_SIZE_BYTES);
    if (validImages.length < selectedImages.length)
    {
      setMessage("Algunas imagenes superan 2 MB y no se agregaron.");
    }

    const currentCount = existingImages.length + newImages.length;
    const availableSlots = Math.max(0, MAX_IMAGES - currentCount);
    if (availableSlots <= 0)
    {
      setMessage(`Solo puedes subir hasta ${MAX_IMAGES} imagenes por producto.`);
      event.target.value = "";
      return;
    }

    const nextImages = validImages.slice(0, availableSlots);
    if (nextImages.length < validImages.length) setMessage(`Solo puedes subir hasta ${MAX_IMAGES} imagenes por producto.`);
    setNewImages((current) => [...current, ...nextImages.map((file) => ({ file, color: null }))]);
    event.target.value = "";
  };

  const submit: SubmitHandler<FormValues> = async (values) => {
    const totalImages = existingImages.length + newImages.length;
    if (totalImages < 1)
    {
      setMessage("Debes cargar al menos 1 imagen antes de guardar el producto.");
      return;
    }

    if (totalImages > MAX_IMAGES)
    {
      setMessage(`Solo puedes subir hasta ${MAX_IMAGES} imagenes por producto.`);
      return;
    }

    if (variantMatrix.length === 0)
    {
      setMessage("Debes definir al menos una combinacion de talla y color.");
      return;
    }

    const variants = variantMatrix.map((variant) => ({
      size: variant.size,
      color: variant.color,
      stock: Math.max(0, Number(variantStockByKey[variant.key] ?? 0)),
      priceAdjustment: null
    }));

    const totalVariantStock = variants.reduce((accumulator, variant) => accumulator + variant.stock, 0);

    const slug = values.slug || slugify(values.name);
    const generatedCode = uniqueProductCode(slug);
    let uploadedUrls: string[] = [];
    try {
      uploadedUrls = newImages.length > 0
        ? await Promise.all(newImages.map((image) => uploadAdminImage(image.file, "products")))
        : [];
    } catch (error) {
      setMessage(getErrorMessage(error));
      return;
    }
    const uploadedImagePayload = uploadedUrls.map((url, index) => ({ url, color: newImages[index]?.color ?? null }));
    const payload = {
      ...values,
      slug,
      sku: values.sku || generatedCode,
      code: values.code || generatedCode,
      salePrice: values.salePrice || null,
      stock: totalVariantStock,
      subcategoryId: null,
      videoUrl: values.videoUrl || null,
      variants,
      images: [...existingImages.map((image) => ({ url: image.url, color: image.color ?? null })), ...uploadedImagePayload]
    };
    delete (payload as { sectionId?: string }).sectionId;
    delete (payload as { sizesCsv?: string }).sizesCsv;
    delete (payload as { colorsCsv?: string }).colorsCsv;
    if (editingId) updateMutation.mutate({ ...payload, id: editingId });
    else createMutation.mutate(payload);
  };

  const startEdit = async (id: string) => {
    try
    {
      setMessage("Cargando producto para editar...");
      const product = await getProduct(id);
      setEditingId(id);
      const selectedCategory = categories.find((category) => category.id === product.categoryId);
      const sectionId = selectedCategory?.parentId ?? sectionOptions[0]?.id ?? "";
      form.reset({
        sectionId,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        code: product.code,
        brandId: product.brandId,
        categoryId: product.categoryId,
        mainStoreId: product.mainStoreId,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice ?? undefined,
        cost: product.cost,
        stock: product.stock,
        minimumStock: product.minimumStock,
        weightKg: product.weightKg,
        material: product.material ?? "",
        sizesCsv: Array.from(new Set((product.variants ?? []).map((variant) => variant.size?.trim()).filter((variant): variant is string => !!variant))).join(", "),
        colorsCsv: Array.from(new Set((product.variants ?? []).map((variant) => variant.color?.trim()).filter((variant): variant is string => !!variant))).join(", "),
        description: product.description,
        longDescription: product.longDescription,
        videoUrl: product.videoUrl ?? "",
        seoTitle: product.seoTitle ?? "",
        seoDescription: product.seoDescription ?? "",
        status: product.status
      });
      setVariantStockByKey(
        Object.fromEntries(
          (product.variants ?? []).map((variant) => [variantKey(variant.size, variant.color), Number(variant.stock ?? 0)])
        )
      );
      const cacheTag = String(Date.now());
      setExistingImages(product.images.slice(0, MAX_IMAGES).map((image) => ({ url: image.url, color: image.color ?? null, cacheTag })));
      setNewImages([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Editando producto seleccionado.");
    }
    catch (error)
    {
      setMessage(getErrorMessage(error));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setMessage("");
    clearForm();
  };

  useEffect(() => {
    if (!selectedSectionId) return;
    const selectedCategoryId = form.getValues("categoryId");
    if (!selectedCategoryId) return;
    if (!availableCategories.some((category) => category.id === selectedCategoryId)) {
      form.setValue("categoryId", "", { shouldValidate: true });
    }
  }, [availableCategories, form, selectedSectionId]);

  useEffect(() => {
    setVariantStockByKey((current) => {
      if (variantMatrix.length === 0) return {};
      const nextEntries = variantMatrix.map((variant) => [variant.key, current[variant.key] ?? 0] as const);
      return Object.fromEntries(nextEntries);
    });
  }, [variantMatrix]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    form.setValue("stock", computedStock, { shouldValidate: true });
  }, [computedStock, form]);

  return (
    <AdminShell title="Productos" description="Registro, edicion, consulta, activacion, desactivacion y eliminacion de productos.">
      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-md border border-border p-5">
            <h2 className="font-bold">Buscar productos</h2>
            <div className="mt-4 grid gap-3">
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-md border border-border bg-background py-3 pl-9 pr-3"
                  placeholder="Buscar por nombre o SKU"
                />
              </label>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-md border border-border bg-background p-3"
              >
                <option value={20}>20 por pagina</option>
                <option value={50}>50 por pagina</option>
                <option value={100}>100 por pagina</option>
              </select>
            </div>
            <p className="mt-3 text-xs text-foreground/60">{totalItems} producto(s) encontrados.</p>
          </div>

          <div className="max-h-[64vh] overflow-auto rounded-md border border-border">
            <div className="space-y-3 p-3 md:hidden">
              <div className="sticky top-2 z-10 rounded-xl border border-border bg-background/95 p-2 backdrop-blur">
                <label className="relative block">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
                  <input
                    value={mobileListQuery}
                    onChange={(event) => setMobileListQuery(event.target.value)}
                    className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-xs"
                    placeholder="Filtrar lista cargada"
                  />
                </label>
              </div>

              {isProductsLoading && <p className="p-2 text-sm text-foreground/60">Cargando productos...</p>}
              {!isProductsLoading && products.length === 0 && <p className="p-2 text-sm text-foreground/60">No se encontraron productos con ese criterio.</p>}
              {!isProductsLoading && products.length > 0 && mobileFilteredProducts.length === 0 && <p className="p-2 text-sm text-foreground/60">Sin coincidencias para la busqueda.</p>}

              {mobileFilteredProducts.map((product) => (
                <article key={product.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{product.name}</p>
                      <p className="mt-1 truncate text-xs text-foreground/60">SKU: {product.sku || "-"}</p>
                      <p className="mt-1 truncate text-xs text-foreground/60">Marca: {product.brand}</p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold">{formatCurrency(product.salePrice ?? product.regularPrice)}</p>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-foreground/65">{product.description || "Sin descripcion"}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => startEdit(product.id)} aria-label="Editar producto"><Edit3 size={16} /></Button>
                    <Button variant="ghost" onClick={() => setProductStatus(product.id, product.stock > 0 ? 2 : 1).then(() => { queryClient.invalidateQueries({ queryKey: ["admin-products-search"] }); toast.success("Estado de producto actualizado correctamente."); }).catch((error) => { const message = getErrorMessage(error); setMessage(message); toast.error(message); })} aria-label="Cambiar estado"><Power size={16} /></Button>
                    <Button variant="ghost" onClick={() => confirm("Eliminar producto?") && deleteProduct(product.id).then(() => { queryClient.invalidateQueries({ queryKey: ["admin-products-search"] }); toast.success("Producto eliminado correctamente."); }).catch((error) => { const message = getErrorMessage(error); setMessage(message); toast.error(message); })} aria-label="Eliminar producto"><Trash2 size={16} /></Button>
                  </div>
                </article>
              ))}
            </div>

            <table className="hidden w-full text-sm md:table">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isProductsLoading && (
                  <tr><td className="p-3 text-sm text-foreground/60" colSpan={3}>Cargando productos...</td></tr>
                )}
                {!isProductsLoading && products.length === 0 && (
                  <tr><td className="p-3 text-sm text-foreground/60" colSpan={3}>No se encontraron productos con ese criterio.</td></tr>
                )}
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-border align-top">
                    <td className="p-3">
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-foreground/65">{product.description || "Sin descripcion"}</p>
                      <p className="mt-1 text-xs text-foreground/60">{product.brand} | {formatCurrency(product.salePrice ?? product.regularPrice)}</p>
                    </td>
                    <td className="p-3 text-xs">{product.sku || "-"}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => startEdit(product.id)} aria-label="Editar producto"><Edit3 size={16} /></Button>
                        <Button variant="ghost" onClick={() => setProductStatus(product.id, product.stock > 0 ? 2 : 1).then(() => { queryClient.invalidateQueries({ queryKey: ["admin-products-search"] }); toast.success("Estado de producto actualizado correctamente."); }).catch((error) => { const message = getErrorMessage(error); setMessage(message); toast.error(message); })} aria-label="Cambiar estado"><Power size={16} /></Button>
                        <Button variant="ghost" onClick={() => confirm("Eliminar producto?") && deleteProduct(product.id).then(() => { queryClient.invalidateQueries({ queryKey: ["admin-products-search"] }); toast.success("Producto eliminado correctamente."); }).catch((error) => { const message = getErrorMessage(error); setMessage(message); toast.error(message); })} aria-label="Eliminar producto"><Trash2 size={16} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background px-3 py-2 text-xs">
              <span>Pagina {page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
                <Button variant="secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</Button>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <form onSubmit={form.handleSubmit(submit)} className="rounded-md border border-border p-5">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"><h2 className="font-bold">{editingId ? "Editar producto" : "Registrar producto"}</h2><div className="flex w-full flex-wrap gap-2 sm:w-auto"><Button className="w-full sm:w-auto" disabled={createMutation.isPending || updateMutation.isPending}><PackagePlus size={18} /> {editingId ? "Actualizar" : "Guardar"}</Button>{editingId && <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={cancelEdit}><X size={18} /> Cancelar</Button>}</div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <input type="hidden" {...form.register("stock", { valueAsNumber: true })} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Nombre" {...form.register("name", { onBlur: () => !form.getValues("slug") && form.setValue("slug", slugify(form.getValues("name")), { shouldValidate: true }) })} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Slug" {...form.register("slug")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="SKU automatico si lo dejas vacio" {...form.register("sku")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Codigo automatico si lo dejas vacio" {...form.register("code")} />
            <select className="rounded-md border border-border bg-background p-3" {...form.register("sectionId")}>
              <option value="">Seccion</option>
              {sectionOptions.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
            <select className="rounded-md border border-border bg-background p-3" {...form.register("brandId")}><option value="">Marca</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
            <select className="rounded-md border border-border bg-background p-3" {...form.register("categoryId")}><option value="">Categoria</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <select className="rounded-md border border-border bg-background p-3" {...form.register("mainStoreId")}><option value="">Tienda principal</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select>
            <input className="rounded-md border border-border bg-background p-3" placeholder="Precio venta" type="number" step="0.01" {...form.register("regularPrice")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Precio oferta" type="number" step="0.01" {...form.register("salePrice")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Costo" type="number" step="0.01" {...form.register("cost")} />
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
              <p className="font-semibold text-foreground">Stock total (calculado)</p>
              <p className="mt-1 text-2xl font-black">{computedStock}</p>
              <p className="mt-1 text-xs text-foreground/60">Se calcula automaticamente desde el stock por talla y color.</p>
            </div>
            <input className="rounded-md border border-border bg-background p-3" placeholder="Stock minimo" type="number" {...form.register("minimumStock")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Peso kg" type="number" step="0.001" {...form.register("weightKg")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Material" {...form.register("material")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Tallas separadas por coma (ej: S, M, L, XL)" {...form.register("sizesCsv")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Colores separados por coma (ej: Negro, Azul, Beige)" {...form.register("colorsCsv")} />
            <select className="rounded-md border border-border bg-background p-3" {...form.register("status")}><option value={1}>Activo</option><option value={2}>Inactivo</option><option value={0}>Borrador</option></select>
            <textarea className="min-h-24 rounded-md border border-border bg-background p-3 sm:col-span-2" placeholder="Descripcion corta" {...form.register("description")} />
            <textarea className="min-h-28 rounded-md border border-border bg-background p-3 sm:col-span-2" placeholder="Descripcion larga" {...form.register("longDescription")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Video URL" {...form.register("videoUrl")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="SEO title" {...form.register("seoTitle")} />
            <textarea className="min-h-20 rounded-md border border-border bg-background p-3 sm:col-span-2" placeholder="SEO description" {...form.register("seoDescription")} />

            <div className="sm:col-span-2 rounded-md border border-border p-4">
              <h3 className="font-semibold">Stock por talla y color</h3>
              {variantMatrix.length === 0 ? (
                <p className="mt-2 text-sm text-foreground/65">Ingresa tallas y colores para generar combinaciones.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {variantMatrix.map((variant) => (
                    <div key={variant.key} className="grid gap-3 sm:grid-cols-[1fr_1fr_130px] sm:items-center">
                      <p className="rounded border border-border bg-muted px-3 py-2 text-sm">Talla: {variant.size}</p>
                      <p className="rounded border border-border bg-muted px-3 py-2 text-sm">Color: {variant.color}</p>
                      <input
                        type="number"
                        min={0}
                        className="rounded-md border border-border bg-background p-2 text-sm"
                        value={variantStockByKey[variant.key] ?? 0}
                        onChange={(event) => setVariantStockByKey((current) => ({ ...current, [variant.key]: Number(event.target.value) || 0 }))}
                        placeholder="Stock"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {Object.values(form.formState.errors)[0]?.message && <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{Object.values(form.formState.errors)[0]?.message}</p>}
          {message && <p className={`mt-4 rounded-md p-3 text-sm ${isAlertMessage ? "bg-red-500/10 text-red-600" : "bg-accent/10 text-accent"}`}>{message}</p>}

          <div className="mt-5 rounded-md border border-border p-5">
            <h2 className="font-bold">Imagenes ({existingImages.length + newImages.length}/{MAX_IMAGES})</h2>
            <p className="mt-2 text-xs text-foreground/60">Debes registrar minimo 1 imagen y maximo {MAX_IMAGES} por producto.</p>
            <label className="mt-4 flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted text-center text-foreground/60">
              <ImagePlus size={34} /> <span className="text-sm font-medium">Drag and drop o seleccionar imagenes</span>
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={onImageSelection} />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {existingImages.map((image, index) => (
                <div key={`existing-${image.url}-${index}`} className="space-y-2">
                  <button type="button" onClick={() => removeExistingImage(index)} className="aspect-square w-full rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${resolveMediaUrl(image.url)}${image.cacheTag ? `${resolveMediaUrl(image.url).includes("?") ? "&" : "?"}v=${image.cacheTag}` : ""})` }} aria-label="Eliminar imagen existente" />
                  <select value={image.color ?? ""} onChange={(event) => setExistingImageColor(index, event.target.value)} className="w-full rounded border border-border bg-background p-1 text-xs">
                    <option value="">Color general</option>
                    {colors.map((color) => <option key={`existing-color-${color}-${index}`} value={color}>{color}</option>)}
                  </select>
                </div>
              ))}
              {uploadedPreviews.map((preview, index) => (
                <div key={preview.key} className="space-y-2">
                  <button type="button" onClick={() => removeNewImage(index)} className="aspect-square w-full rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${preview.url})` }} aria-label="Eliminar imagen nueva" />
                  <select value={preview.color ?? ""} onChange={(event) => setNewImageColor(index, event.target.value)} className="w-full rounded border border-border bg-background p-1 text-xs">
                    <option value="">Color general</option>
                    {colors.map((color) => <option key={`new-color-${color}-${index}`} value={color}>{color}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="rounded-md border border-border p-5"><h2 className="font-bold">Carga masiva</h2><Button variant="secondary" className="mt-4 w-full"><Upload size={18} /> Importar Excel</Button></div>
        </div>
      </section>
    </AdminShell>
  );
}
