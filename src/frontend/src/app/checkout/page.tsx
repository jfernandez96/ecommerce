"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, Loader2, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createOrder,
  getDepartments,
  getDistricts,
  getProvinces,
  getPublicStores,
  getPublicSettings,
  type DepartmentDto,
  type DistrictDto,
  type OrderCheckoutResponse,
  type ProvinceDto,
  type PublicStoreSettings,
  type StoreLocationDto,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";

// Lima's CodigoSunat is "15"
const LIMA_CODE = "15";

export default function CheckoutPage() {
  const { items, clear } = useCartStore();

  // ── Settings & geo state ─────────────────────────────────────────────────
  const [settings, setSettings] = useState<PublicStoreSettings>({
    paymentGatewayEnabled: false,
    freeShippingLima: true,
    provinceShippingCost: 15,
  });

  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [provinces, setProvinces] = useState<ProvinceDto[]>([]);
  const [districts, setDistricts] = useState<DistrictDto[]>([]);
  const [stores, setStores] = useState<StoreLocationDto[]>([]);

  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");

  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<"shipping" | "pickup">("shipping");
  const [selectedStoreId, setSelectedStoreId] = useState("");

  // ── Checkout state ────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<"card" | "yape">("card");
  const [documentType, setDocumentType] = useState<"receipt" | "invoice">("receipt");
  const [customerDocumentType, setCustomerDocumentType] = useState<"dni" | "ruc" | "ce" | "passport">("dni");
  const [result, setResult] = useState<OrderCheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Load settings + departments on mount ─────────────────────────────────
  useEffect(() => {
    void getPublicSettings().then(setSettings);
    void getDepartments().then(setDepartments);
    void getPublicStores().then((data) => {
      setStores(data);
      if (data.length > 0) {
        setSelectedStoreId(data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (fulfillmentType === "pickup" && !selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [fulfillmentType, selectedStoreId, stores]);

  // ── Cascade: dept → provinces ─────────────────────────────────────────────
  useEffect(() => {
    setSelectedProvinceId("");
    setSelectedDistrictId("");
    setProvinces([]);
    setDistricts([]);
    if (!selectedDeptId) return;
    setIsLoadingProvinces(true);
    getProvinces(selectedDeptId)
      .then(setProvinces)
      .finally(() => setIsLoadingProvinces(false));
  }, [selectedDeptId]);

  // ── Cascade: province → districts ────────────────────────────────────────
  useEffect(() => {
    setSelectedDistrictId("");
    setDistricts([]);
    if (!selectedProvinceId) return;
    setIsLoadingDistricts(true);
    getDistricts(selectedProvinceId)
      .then(setDistricts)
      .finally(() => setIsLoadingDistricts(false));
  }, [selectedProvinceId]);

  // ── Shipping cost ─────────────────────────────────────────────────────────
  const selectedDept = departments.find((d) => d.id === selectedDeptId);
  const isLima = selectedDept?.code === LIMA_CODE;

  const shipping = useMemo(() => {
    if (items.length === 0) return 0;
    if (fulfillmentType === "pickup") return 0;
    if (!selectedDeptId) return 0; // unknown yet
    if (isLima && settings.freeShippingLima) return 0;
    return Number(settings.provinceShippingCost);
  }, [items.length, selectedDeptId, isLima, settings, fulfillmentType]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [items]);
  const total = subtotal + shipping;

  // ── Derived geo labels for order payload ─────────────────────────────────
  const selectedProvince = provinces.find((p) => p.id === selectedProvinceId);
  const selectedDistrict = districts.find((d) => d.id === selectedDistrictId);
  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? null;

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (items.length === 0) { setError("Tu carrito esta vacio."); return; }
    if (fulfillmentType === "pickup" && !selectedStoreId) {
      setError("Selecciona una tienda para continuar.");
      return;
    }
    if (fulfillmentType === "shipping" && (!selectedDeptId || !selectedProvinceId || !selectedDistrictId)) {
      setError("Selecciona departamento, provincia y distrito.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);

    // When gateway is off, default payment method to "card" but backend handles by sending email only
    const effectivePaymentMethod = settings.paymentGatewayEnabled ? paymentMethod : "card";
    const effectiveStoreId = fulfillmentType === "pickup"
      ? selectedStoreId
      : (selectedStoreId || stores[0]?.id || "");

    if (!effectiveStoreId) {
      setError("No hay tiendas configuradas para procesar el pedido.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await createOrder({
        email: String(formData.get("email") ?? ""),
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        line1: fulfillmentType === "pickup"
          ? (selectedStore?.address ?? "Recojo en tienda")
          : String(formData.get("line1") ?? ""),
        district: fulfillmentType === "pickup"
          ? (selectedStore?.district ?? "")
          : (selectedDistrict?.name ?? ""),
        province: fulfillmentType === "pickup"
          ? (selectedStore?.province ?? "")
          : (selectedProvince?.name ?? ""),
        department: fulfillmentType === "pickup"
          ? (selectedStore?.department ?? "")
          : (selectedDept?.name ?? ""),
        reference: String(formData.get("reference") ?? "") || undefined,
        documentType,
        customerDocumentType,
        documentNumber: String(formData.get("documentNumber") ?? ""),
        paymentMethod: effectivePaymentMethod,
        fulfillmentType,
        storeId: effectiveStoreId,
        notes: String(formData.get("notes") ?? "") || undefined,
        items: items.map((item) => ({
          productId: item.id,
          productVariantId: item.selectedVariantId,
          quantity: item.quantity,
        })),
      });

      setResult(response);
      clear();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No se pudo registrar tu pedido.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.08fr_420px]">
      <section>
        <h1 className="text-4xl font-black">Finalizar compra</h1>
        <p className="mt-2 max-w-2xl text-foreground/60">
          {settings.paymentGatewayEnabled
            ? "Registramos tu pedido y preparamos el flujo seguro de pago."
            : "Registramos tu pedido y te enviamos los detalles por correo."}
        </p>

        {result ? (
          <div className="mt-8 rounded-[32px] border border-border bg-background p-8 shadow-sm">
            <p className="text-sm uppercase tracking-[0.24em] text-accent">Pedido registrado</p>
            <h2 className="mt-3 text-3xl font-black">{result.orderNumber}</h2>
            <p className="mt-3 text-foreground/65">Total confirmado: {formatCurrency(result.total)}</p>
            {(result.storeName || result.fulfillmentType) && (
              <p className="mt-2 text-sm text-foreground/60">
                {result.fulfillmentType === "pickup" ? "Recojo en tienda" : "Envio a domicilio"}
                {result.storeName ? ` · ${result.storeName}` : ""}
              </p>
            )}
            <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-5">
              <h3 className="text-xl font-bold">Siguiente paso</h3>
              <p className="mt-2 text-sm text-foreground/65">
                {settings.paymentGatewayEnabled
                  ? `Proveedor: ${result.payment.provider.toUpperCase()} · Estado: ${result.payment.status}`
                  : "Recibirás un correo con el detalle de tu pedido."}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-foreground/70">
                {result.payment.instructions.map((instruction) => (
                  <li key={instruction}>- {instruction}</li>
                ))}
              </ul>
              {result.payment.qrCodeUrl && (
                <a href={result.payment.qrCodeUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-semibold text-primary underline underline-offset-4">
                  Abrir QR de Yape
                </a>
              )}
            </div>
            <div className="mt-6">
              <Link href="/"><Button>Volver al inicio</Button></Link>
            </div>
          </div>
        ) : (
          <form id="checkout-form" onSubmit={handleSubmit} className="mt-8 space-y-8">

            <div className="rounded-[32px] border border-border bg-background p-6 shadow-sm">
              <h2 className="text-2xl font-black">Entrega y tienda</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setFulfillmentType("shipping")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${fulfillmentType === "shipping" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                >
                  <p className="font-semibold">Envio a domicilio</p>
                  <p className="mt-1 text-xs text-foreground/60">Calcula costo segun ubicacion.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType("pickup")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${fulfillmentType === "pickup" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                >
                  <p className="font-semibold">Recoger en tienda</p>
                  <p className="mt-1 text-xs text-foreground/60">Sin costo de envio.</p>
                </button>
              </div>

              {fulfillmentType === "pickup" && (
                <div className="mt-4">
                  <label className="text-sm font-semibold">Tienda</label>
                  <select
                    value={selectedStoreId}
                    onChange={(event) => setSelectedStoreId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3"
                    required
                  >
                    <option value="">Selecciona tienda</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name} · {store.code}
                      </option>
                    ))}
                  </select>
                  {selectedStore && (
                    <p className="mt-2 text-xs text-foreground/60">
                      {selectedStore.address}
                      {selectedStore.district ? `, ${selectedStore.district}` : ""}
                      {selectedStore.province ? `, ${selectedStore.province}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Datos de entrega ───────────────────────────────────────── */}
            <div className="rounded-[32px] border border-border bg-background p-6 shadow-sm">
              <h2 className="text-2xl font-black">Datos de entrega</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <input name="fullName" className="rounded-2xl border border-border bg-background px-4 py-3" placeholder="Nombre completo" required />
                <input name="email" type="email" className="rounded-2xl border border-border bg-background px-4 py-3" placeholder="Correo electronico" required />
                <input name="phone" className="rounded-2xl border border-border bg-background px-4 py-3" placeholder="Telefono" required />
                <select value={customerDocumentType} onChange={(e) => setCustomerDocumentType(e.target.value as "dni" | "ruc" | "ce" | "passport")} className="rounded-2xl border border-border bg-background px-4 py-3">
                  <option value="dni">DNI</option>
                  <option value="ruc">RUC</option>
                  <option value="ce">Carnet de extranjeria</option>
                  <option value="passport">Pasaporte</option>
                </select>
                <input name="documentNumber" className="rounded-2xl border border-border bg-background px-4 py-3" placeholder="Numero de documento" required />
                <select value={documentType} onChange={(e) => setDocumentType(e.target.value as "receipt" | "invoice")} className="rounded-2xl border border-border bg-background px-4 py-3">
                  <option value="receipt">Boleta</option>
                  <option value="invoice">Factura</option>
                </select>
                <input name="line1" className="rounded-2xl border border-border bg-background px-4 py-3" placeholder="Direccion" required={fulfillmentType === "shipping"} />
              </div>

              {/* ── Ubigeo cascada ─────────────────────────────────────── */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
                  <MapPin size={15} /> Ubicacion de entrega
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                    disabled={fulfillmentType === "pickup"}
                    required
                  >
                    <option value="">Departamento</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedProvinceId}
                    onChange={(e) => setSelectedProvinceId(e.target.value)}
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-sm disabled:opacity-50"
                    disabled={fulfillmentType === "pickup" || !selectedDeptId || isLoadingProvinces}
                    required
                  >
                    <option value="">
                      {isLoadingProvinces ? "Cargando..." : "Provincia"}
                    </option>
                    {provinces.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedDistrictId}
                    onChange={(e) => setSelectedDistrictId(e.target.value)}
                    className="rounded-2xl border border-border bg-background px-4 py-3 text-sm disabled:opacity-50"
                    disabled={fulfillmentType === "pickup" || !selectedProvinceId || isLoadingDistricts}
                    required
                  >
                    <option value="">
                      {isLoadingDistricts ? "Cargando..." : "Distrito"}
                    </option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {selectedDeptId && (
                  <p className="text-xs text-foreground/55">
                    {fulfillmentType === "pickup"
                      ? "Recojo en tienda seleccionado. El envio no aplica."
                      : isLima && settings.freeShippingLima
                      ? "Envio gratis dentro de Lima Metropolitana."
                      : `Envio a provincias: ${formatCurrency(settings.provinceShippingCost)}`}
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <input name="reference" className="rounded-2xl border border-border bg-background px-4 py-3" placeholder="Referencia (opcional)" />
                <textarea name="notes" className="rounded-2xl border border-border bg-background px-4 py-3" placeholder="Notas para despacho (opcional)" />
              </div>
            </div>

            {/* ── Metodo de pago ────────────────────────────────────────── */}
            <div className="rounded-[32px] border border-border bg-background p-6 shadow-sm">
              <h2 className="text-2xl font-black">Metodo de pago</h2>

              {settings.paymentGatewayEnabled ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${paymentMethod === "card" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                  >
                    <div className="flex items-center gap-3 font-semibold"><CreditCard size={18} /> Tarjeta</div>
                    <p className="mt-2 text-sm text-foreground/60">Credito o debito. Pago seguro desde backend.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("yape")}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${paymentMethod === "yape" ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-black">Y</span>
                      Yape
                    </div>
                    <p className="mt-2 text-sm text-foreground/60">QR o deep link generado desde servidor.</p>
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-950/40">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Pago coordinado por correo</p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                    Al confirmar tu pedido recibirás todos los detalles para coordinar el pago por transferencia, Yape u otro medio acordado.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
          </form>
        )}
      </section>

      {/* ── Resumen ──────────────────────────────────────────────────────── */}
      <aside className="h-fit rounded-[32px] border border-border bg-muted/30 p-6">
        <h2 className="text-2xl font-black">Resumen</h2>
        <div className="mt-6 space-y-4 text-sm">
          {items.map((item) => (
            <div key={item.lineId} className="flex items-start justify-between gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-foreground/60">{[item.selectedColor, item.selectedSize].filter(Boolean).join(" / ") || "General"} · {item.quantity} und.</p>
              </div>
              <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground/60">Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground/60">
              Envio
              {fulfillmentType === "shipping" && selectedDeptId && (
                <span className="ml-1 text-xs text-foreground/40">
                  ({isLima ? "Lima" : selectedDept?.name ?? "Provincia"})
                </span>
              )}
            </span>
            <strong>
              {fulfillmentType === "pickup"
                ? "No aplica"
                : !selectedDeptId
                ? <span className="text-foreground/45 text-xs">Selecciona ubicacion</span>
                : shipping === 0
                  ? "Gratis"
                  : formatCurrency(shipping)}
            </strong>
          </div>
          <div className="flex items-center justify-between text-lg">
            <span className="font-semibold">Total</span>
            <strong className="text-2xl font-black">{formatCurrency(total)}</strong>
          </div>
        </div>

        {!result && (
          <div className="mt-6 grid gap-3">
            <Button type="submit" form="checkout-form" className="w-full" disabled={items.length === 0 || isSubmitting}>
              {isSubmitting
                ? <><Loader2 size={16} className="animate-spin" /> Registrando pedido...</>
                : settings.paymentGatewayEnabled
                  ? "Confirmar y pagar"
                  : "Confirmar pedido"}
            </Button>
            <div className="rounded-2xl border border-border bg-background p-4 text-sm text-foreground/65">
              <div className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck size={18} /> Datos seguros</div>
              <p className="mt-2">Tu informacion esta protegida y nunca se comparte con terceros.</p>
            </div>
          </div>
        )}
      </aside>
    </main>
  );
}
