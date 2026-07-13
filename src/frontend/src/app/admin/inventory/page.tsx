"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpToLine, RefreshCcw, Search, TriangleAlert, Warehouse } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import {
  getLowStockAlerts,
  getProduct,
  listStores,
  registerStockIn,
  registerStockOut,
  searchAdminProducts,
  searchInventoryMovements,
  type ProductAdminDto,
} from "@/lib/admin-api";

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange() {
  const now = new Date();
  return {
    start: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(value));
}

function movementTypeLabel(value: number) {
  if (value === 3) return "Salida manual";
  if (value === 2) return "Retorno por anulacion";
  return "Ingreso de mercaderia";
}

function stockBadgeClass(stock: number) {
  if (stock <= 0) return "bg-red-500/12 text-red-700";
  if (stock <= 5) return "bg-amber-500/12 text-amber-700";
  return "bg-emerald-500/12 text-emerald-700";
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Ocurrio un error inesperado.";

export default function AdminInventoryPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const monthRange = useMemo(() => getCurrentMonthRange(), []);

  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [adjustmentType, setAdjustmentType] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState(1);
  const [supplierName, setSupplierName] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");

  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyStoreId, setHistoryStoreId] = useState("");
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);
  const deferredProductQuery = useDeferredValue(productQuery.trim());
  const shouldSearchProducts = deferredProductQuery.length >= 2;

  const productsQuery = useQuery({
    queryKey: ["inventory-products", deferredProductQuery],
    queryFn: () => searchAdminProducts({ page: 1, pageSize: 12, query: deferredProductQuery, sortBy: "newest" }),
    enabled: shouldSearchProducts,
  });

  const selectedProductQuery = useQuery<ProductAdminDto | null>({
    queryKey: ["inventory-product-detail", selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return null;
      return getProduct(selectedProductId);
    },
    enabled: !!selectedProductId,
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory-movements", historyPage, historyPageSize, historyQuery, historyStoreId, startDate, endDate],
    queryFn: () => searchInventoryMovements({
      page: historyPage,
      pageSize: historyPageSize,
      query: historyQuery.trim(),
      storeId: historyStoreId || undefined,
      startDate,
      endDate,
    }),
  });

  const storesQuery = useQuery({
    queryKey: ["admin-stores-for-inventory"],
    queryFn: () => listStores(false),
  });

  const lowStockQuery = useQuery({
    queryKey: ["inventory-low-stock"],
    queryFn: () => getLowStockAlerts(20),
  });

  const selectedProduct = selectedProductQuery.data;
  const stores = storesQuery.data ?? [];
  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? null;
  const variants = selectedProduct?.variants ?? [];
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? null;

  const stockInMutation = useMutation({
    mutationFn: registerStockIn,
    onSuccess: async (movement) => {
      toast.success(`Ingreso registrado: +${movement.quantity} unidades.`);
      setQuantity(1);
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-products-search"] });
      if (selectedProductId) {
        await queryClient.invalidateQueries({ queryKey: ["inventory-product-detail", selectedProductId] });
      }
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const stockOutMutation = useMutation({
    mutationFn: registerStockOut,
    onSuccess: async (movement) => {
      toast.success(`Salida registrada: -${movement.quantity} unidades.`);
      setQuantity(1);
      await queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-products-search"] });
      if (selectedProductId) {
        await queryClient.invalidateQueries({ queryKey: ["inventory-product-detail", selectedProductId] });
      }
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const submitAdjustment = () => {
    if (!selectedProductId) {
      toast.info("Selecciona un producto antes de registrar movimiento.");
      return;
    }

    if (!selectedStoreId) {
      toast.info("Selecciona la tienda donde registrar el movimiento.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.info("La cantidad debe ser mayor a 0.");
      return;
    }

    if (adjustmentType === "out") {
      if (!notes.trim()) {
        toast.info("Debes registrar una razon para salida manual.");
        return;
      }

      stockOutMutation.mutate({
        storeId: selectedStoreId,
        productId: selectedProductId,
        productVariantId: selectedVariantId || null,
        quantity,
        referenceCode: referenceCode.trim() || undefined,
        notes: notes.trim(),
      });
      return;
    }

    stockInMutation.mutate({
      storeId: selectedStoreId,
      productId: selectedProductId,
      productVariantId: selectedVariantId || null,
      quantity,
      supplierName: supplierName.trim() || undefined,
      referenceCode: referenceCode.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const movementPage = movementsQuery.data;
  const movementItems = movementPage?.items ?? [];
  const movementTotalPages = Math.max(movementPage?.totalPages ?? 1, 1);
  const lowStockItems = lowStockQuery.data ?? [];
  const isBusy = stockInMutation.isPending || stockOutMutation.isPending;
  const productResults = productsQuery.data?.items ?? [];
  const totalProductMatches = productsQuery.data?.totalItems ?? 0;
  const selectedStock = selectedVariant?.stock ?? selectedProduct?.stock ?? 0;

  useEffect(() => {
    if (stores.length === 0 || selectedStoreId) {
      return;
    }

    setSelectedStoreId(stores[0].id);
  }, [stores, selectedStoreId]);

  useEffect(() => {
    if (productQuery.trim().length > 0) return;

    setSelectedProductId(null);
    setSelectedVariantId("");
    setSupplierName("");
    setReferenceCode("");
    setNotes("");
    setQuantity(1);
  }, [productQuery]);

  return (
    <AdminShell title="Mercaderia" description="Registra ingreso de stock y audita movimientos de inventario por producto y variante.">
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-lg font-bold">Alerta de stock bajo</h2>
              <p className="text-sm text-foreground/60">Productos activos con stock menor o igual al minimo configurado.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] })}>
              <RefreshCcw size={16} /> Actualizar
            </Button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Stock actual</th>
                  <th className="p-3">Stock minimo</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lowStockQuery.isLoading && <tr><td className="p-4 text-foreground/60" colSpan={5}>Cargando alertas...</td></tr>}
                {!lowStockQuery.isLoading && lowStockItems.length === 0 && <tr><td className="p-4 text-foreground/60" colSpan={5}>No hay alertas en este momento.</td></tr>}
                {lowStockItems.map((item) => (
                  <tr key={item.productId} className="border-t border-border">
                    <td className="p-3 font-semibold">{item.productName}</td>
                    <td className="p-3 text-xs text-foreground/70">{item.sku}</td>
                    <td className="p-3 font-semibold">{item.stock}</td>
                    <td className="p-3">{item.minimumStock}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${item.isOutOfStock ? "bg-red-500/12 text-red-700" : "bg-amber-500/12 text-amber-700"}`}>
                        <TriangleAlert size={13} /> {item.isOutOfStock ? "Sin stock" : "Stock critico"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <section className="space-y-5 rounded-2xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">Operacion guiada</p>
              <h2 className="mt-1 text-xl font-black">Registro de mercaderia</h2>
              <p className="mt-2 text-sm text-foreground/60">Pensado para catalogos grandes: busca por SKU o nombre, elige el producto y registra el movimiento sin recorrer listas interminables.</p>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Warehouse size={20} />
            </span>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm text-foreground/70 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">Paso 1</p>
              <p className="mt-1 font-semibold text-foreground">Busca rapido</p>
              <p className="mt-1 text-xs">Usa nombre, SKU o palabra clave. Idealmente 2 o mas caracteres.</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">Paso 2</p>
              <p className="mt-1 font-semibold text-foreground">Confirma el item</p>
              <p className="mt-1 text-xs">Veras stock, marca, categoria y variantes antes de registrar.</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">Paso 3</p>
              <p className="mt-1 font-semibold text-foreground">Aplica el movimiento</p>
              <p className="mt-1 text-xs">Define cantidad, referencia y notas para dejar trazabilidad limpia.</p>
            </div>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">Tipo de movimiento</span>
            <select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as "in" | "out")} className="w-full rounded-md border border-border bg-background px-3 py-2">
              <option value="in">Ingreso de mercaderia</option>
              <option value="out">Salida manual controlada</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">Tienda</span>
            <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" disabled={storesQuery.isLoading}>
              <option value="">Selecciona tienda</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name} · {store.code}</option>
              ))}
            </select>
            {selectedStore && <p className="text-xs text-foreground/55">{selectedStore.address}</p>}
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold">Buscar producto</span>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
              <input
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3"
                placeholder="Ej. zapatilla blanca, NK-2201, adidas"
              />
            </div>
            <p className="text-xs text-foreground/55">{shouldSearchProducts ? `Mostrando hasta ${productResults.length} resultado(s) de ${totalProductMatches}.` : "Escribe al menos 2 caracteres para evitar ruido cuando el catalogo sea grande."}</p>
          </label>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-border/80 bg-background">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Resultados de busqueda</p>
                  <p className="text-xs text-foreground/55">Selector compacto para trabajar mejor con cientos o miles de productos.</p>
                </div>
                {shouldSearchProducts && <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground/65">{totalProductMatches} coincidencias</span>}
              </div>

              <div className="max-h-[26rem] overflow-auto p-3">
                {!shouldSearchProducts && (
                  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-foreground/60">
                    Empieza escribiendo nombre o SKU. Para catalogos grandes, busca por termino corto y luego afina.
                  </div>
                )}

                {shouldSearchProducts && productsQuery.isLoading && <p className="px-2 py-3 text-sm text-foreground/60">Buscando productos...</p>}

                {shouldSearchProducts && !productsQuery.isLoading && productResults.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-foreground/60">
                    No hay productos con ese filtro. Prueba con una palabra mas corta o con el SKU.
                  </div>
                )}

                <div className="space-y-2">
                  {productResults.map((product) => {
                    const isActive = selectedProductId === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(product.id);
                          setSelectedVariantId("");
                        }}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${isActive ? "border-primary bg-primary/8 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/35"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{product.name}</p>
                            <p className="mt-1 text-xs text-foreground/55">SKU: {product.sku || "-"} · {product.brand} · {product.category}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${stockBadgeClass(product.stock)}`}>
                            Stock {product.stock}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground/60">
                          {!!product.variantCount && <span className="rounded-full bg-muted px-2 py-1">{product.variantCount} variante(s)</span>}
                          {!!product.distinctColorCount && <span className="rounded-full bg-muted px-2 py-1">{product.distinctColorCount} color(es)</span>}
                          {!!product.distinctSizeCount && <span className="rounded-full bg-muted px-2 py-1">{product.distinctSizeCount} talla(s)</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                <p className="text-sm font-semibold">Producto seleccionado</p>
                {!selectedProduct && (
                  <p className="mt-2 text-sm text-foreground/60">Aun no has seleccionado un producto.</p>
                )}
                {selectedProduct && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="font-semibold text-foreground">{selectedProduct.name}</p>
                      <p className="mt-1 text-xs text-foreground/55">SKU base: {selectedProduct.sku} · {selectedProduct.brandId ? "Producto activo en catalogo" : ""}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-xl border border-border bg-background px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-foreground/45">Stock visible</p>
                        <p className="mt-1 text-lg font-black">{selectedStock}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-foreground/45">Variantes</p>
                        <p className="mt-1 text-lg font-black">{variants.length}</p>
                      </div>
                    </div>
                    <p className="text-xs text-foreground/55">Si eliges una variante, el movimiento se aplicara sobre ese stock especifico.</p>
                  </div>
                )}
              </div>

              <label className="space-y-1 text-sm">
                <span className="font-semibold">Variante (opcional)</span>
                <select
                  value={selectedVariantId}
                  onChange={(event) => setSelectedVariantId(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  disabled={!selectedProductId || selectedProductQuery.isLoading}
                >
                  <option value="">Producto principal</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>{variant.color} / {variant.size} - {variant.sku} (stock: {variant.stock})</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Cantidad</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Proveedor</span>
              <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" placeholder={adjustmentType === "in" ? "Proveedor o distribuidor" : "No aplica para salida"} disabled={adjustmentType === "out"} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Codigo referencia</span>
              <input value={referenceCode} onChange={(event) => setReferenceCode(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" placeholder="OC-2026-..." />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Notas</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" placeholder="Observacion breve" />
            </label>
          </div>

          <Button type="button" onClick={submitAdjustment} disabled={isBusy || !selectedProductId} className="h-11 w-full rounded-xl">
            {adjustmentType === "in" ? <ArrowUpToLine size={16} /> : <ArrowDownToLine size={16} />}
            {adjustmentType === "in"
              ? (isBusy ? "Registrando ingreso..." : "Registrar ingreso de mercaderia")
              : (isBusy ? "Registrando salida..." : "Registrar salida manual")}
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-background">
          <div className="flex flex-col gap-4 border-b border-border px-5 py-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Movimientos de inventario</h2>
              <p className="text-sm text-foreground/60">Trazabilidad de ingresos y devoluciones por anulacion de orden.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory-movements"] })}>
              <RefreshCcw size={16} /> Actualizar
            </Button>
          </div>

          <div className="grid gap-3 border-b border-border px-5 py-4 md:grid-cols-5">
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-semibold">Busqueda</span>
              <input value={historyQuery} onChange={(event) => { setHistoryQuery(event.target.value); setHistoryPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" placeholder="Producto, SKU, proveedor o referencia" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Tienda</span>
              <select value={historyStoreId} onChange={(event) => { setHistoryStoreId(event.target.value); setHistoryPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" disabled={storesQuery.isLoading}>
                <option value="">Todas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Fecha inicio</span>
              <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setHistoryPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Fecha fin</span>
              <input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setHistoryPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Tienda</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Cantidad</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {movementsQuery.isLoading && <tr><td className="p-4 text-foreground/60" colSpan={7}>Cargando movimientos...</td></tr>}
                {!movementsQuery.isLoading && movementItems.length === 0 && <tr><td className="p-4 text-foreground/60" colSpan={7}>No hay movimientos para los filtros seleccionados.</td></tr>}
                {movementItems.map((movement) => (
                  <tr key={movement.id} className="border-t border-border">
                    <td className="p-3 text-xs text-foreground/70">{formatDateTime(movement.createdAt)}</td>
                    <td className="p-3 text-xs text-foreground/70">{movement.storeName || "-"}</td>
                    <td className="p-3">
                      <p className="font-semibold">{movement.productName}</p>
                      <p className="mt-1 text-xs text-foreground/60">{movement.variantLabel || movement.productSku}</p>
                    </td>
                    <td className="p-3"><span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{movementTypeLabel(movement.movementType)}</span></td>
                    <td className="p-3 font-semibold">{movement.movementType === 3 ? `-${movement.quantity}` : `+${movement.quantity}`}</td>
                    <td className="p-3 text-xs text-foreground/70">{movement.stockBefore} &rarr; {movement.stockAfter}</td>
                    <td className="p-3 text-xs text-foreground/70">
                      <p>{movement.referenceCode || "-"}</p>
                      <p>{movement.supplierName || "-"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm">
            <div className="flex items-center gap-3">
              <span>Pagina {historyPage} de {movementTotalPages}</span>
              <select value={historyPageSize} onChange={(event) => { setHistoryPageSize(Number(event.target.value)); setHistoryPage(1); }} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                <option value={20}>20 por pagina</option>
                <option value={50}>50 por pagina</option>
                <option value={100}>100 por pagina</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={historyPage <= 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}>Anterior</Button>
              <Button type="button" variant="secondary" disabled={historyPage >= movementTotalPages} onClick={() => setHistoryPage((current) => Math.min(movementTotalPages, current + 1))}>Siguiente</Button>
            </div>
          </div>
        </section>
        </div>
      </div>
    </AdminShell>
  );
}
