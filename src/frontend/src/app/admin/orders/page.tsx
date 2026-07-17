"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock3, MessageCircleMore, Printer, RefreshCcw, RotateCcw, Search, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAppToast } from "@/components/ui/toast";
import {
  cancelAdminOrder,
  getAdminOrder,
  getStoreSettings,
  reactivateAdminOrder,
  searchAdminOrders,
  sendOrderWhatsApp,
  updateAdminOrderPaymentStatus,
  type OrderAdminDetailDto,
} from "@/lib/admin-api";
import { formatCurrency } from "@/lib/utils";

const paymentStatusOptions = [
  { value: "", label: "Todos los pagos" },
  { value: "pending", label: "Pendiente" },
  { value: "pending_contact", label: "Pendiente contacto" },
  { value: "confirmed", label: "Confirmado" },
  { value: "rejected", label: "Rechazado" },
  { value: "cancelled", label: "Cancelado" },
];

const orderStatusOptions = [
  { value: "", label: "Todos los estados" },
  { value: "0", label: "Pendiente" },
  { value: "1", label: "Pagada" },
  { value: "2", label: "Preparando" },
  { value: "3", label: "Enviada" },
  { value: "4", label: "Entregada" },
  { value: "5", label: "Anulada" },
  { value: "6", label: "Devuelta" },
];

const orderStatusLabels: Record<number, string> = {
  0: "Pendiente",
  1: "Pagada",
  2: "Preparando",
  3: "Enviada",
  4: "Entregada",
  5: "Anulada",
  6: "Devuelta",
};

const paymentMethodLabels: Record<number, string> = {
  0: "Tarjeta",
  1: "Mercado Pago",
  2: "Yape",
  3: "Plin",
  4: "Transferencia",
};

const documentTypeLabels: Record<number, string> = {
  0: "Boleta",
  1: "Factura",
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Ocurrio un error inesperado.";

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paymentStatusLabel(value: string) {
  switch (value) {
    case "confirmed": return "Confirmado";
    case "rejected": return "Rechazado";
    case "pending_contact": return "Pendiente contacto";
    case "cancelled": return "Cancelado";
    default: return "Pendiente";
  }
}

function paymentBadgeClass(value: string) {
  switch (value) {
    case "confirmed": return "bg-emerald-500/10 text-emerald-700";
    case "rejected": return "bg-red-500/10 text-red-700";
    case "cancelled": return "bg-slate-500/10 text-slate-700";
    default: return "bg-amber-500/10 text-amber-700";
  }
}

function orderBadgeClass(value: number) {
  if (value === 5) return "bg-red-500/10 text-red-700";
  if (value === 4) return "bg-emerald-500/10 text-emerald-700";
  if (value === 3) return "bg-sky-500/10 text-sky-700";
  return "bg-foreground/10 text-foreground";
}

type PendingOrderAction =
  | { type: "confirm-payment"; title: string; description: string; confirmLabel: string; }
  | { type: "reject-payment"; title: string; description: string; confirmLabel: string; }
  | { type: "cancel-order"; title: string; description: string; confirmLabel: string; }
  | { type: "reactivate-order"; title: string; description: string; confirmLabel: string; };

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const toast = useAppToast();
  const selectedFromQuery = searchParams.get("selected");
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(selectedFromQuery);
  const [pendingAction, setPendingAction] = useState<PendingOrderAction | null>(null);
  const [mobileListQuery, setMobileListQuery] = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-orders", startDate, endDate, paymentStatus, orderStatus, customerName, orderNumber, page, pageSize],
    queryFn: () => searchAdminOrders({
      startDate,
      endDate,
      paymentStatus,
      orderStatus: orderStatus ? Number(orderStatus) : undefined,
      customerName: customerName.trim(),
      orderNumber: orderNumber.trim(),
      page,
      pageSize,
    }),
  });

  const orders = data?.page.items ?? [];
  const mobileFilteredOrders = useMemo(() => {
    const term = mobileListQuery.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => (`${order.number} ${order.customerName} ${order.customerEmail}`).toLowerCase().includes(term));
  }, [mobileListQuery, orders]);
  const summary = data?.summary;
  const totalPages = Math.max(data?.page.totalPages ?? 1, 1);

  useEffect(() => {
    if (selectedFromQuery) {
      setSelectedOrderId(selectedFromQuery);
    }
  }, [selectedFromQuery]);

  useEffect(() => {
    if (!orders.length) return;

    if (!selectedOrderId) {
      setSelectedOrderId(orders[0]?.id ?? null);
    }
  }, [orders, selectedOrderId]);

  const selectedOrderQuery = useQuery({
    queryKey: ["admin-order", selectedOrderId],
    queryFn: () => getAdminOrder(selectedOrderId as string),
    enabled: !!selectedOrderId,
  });

  const storeSettingsQuery = useQuery({
    queryKey: ["store-settings"],
    queryFn: getStoreSettings,
  });

  const refreshOrders = async (successMessage: string) => {
    await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    if (selectedOrderId) {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", selectedOrderId] });
    }
    toast.success(successMessage);
  };

  const paymentMutation = useMutation({
    mutationFn: updateAdminOrderPaymentStatus,
    onSuccess: async (_, variables) => {
      await refreshOrders(variables.paymentStatus === "confirmed" ? "Pago confirmado correctamente." : "Pago rechazado correctamente.");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelAdminOrder,
    onSuccess: async () => {
      await refreshOrders("Orden anulada correctamente.");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateAdminOrder,
    onSuccess: async () => {
      await refreshOrders("Orden reactivada correctamente.");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const whatsappMutation = useMutation({
    mutationFn: sendOrderWhatsApp,
    onSuccess: (result) => {
      toast.success(result.message || "Mensaje de WhatsApp enviado correctamente.");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const selectedOrder = selectedOrderQuery.data;

  const submitPaymentStatus = (nextStatus: "confirmed" | "rejected") => {
    if (!selectedOrderId) return;

    if (nextStatus === "confirmed") {
      setPendingAction({
        type: "confirm-payment",
        title: "Marcar pago como aprobado",
        description: "Esta accion actualizara la orden como pago validado y movera el caso fuera de la bandeja pendiente.",
        confirmLabel: "Aprobar pago ahora",
      });
      return;
    }

    setPendingAction({
      type: "reject-payment",
      title: "Dejar pago en revision",
      description: "Usa esta opcion cuando el comprobante no pueda validarse y el equipo deba continuar el seguimiento con el cliente.",
      confirmLabel: "Enviar a revision",
    });
  };

  const submitCancel = () => {
    if (!selectedOrderId) return;
    setPendingAction({
      type: "cancel-order",
      title: "Cerrar orden sin despacho",
      description: "La orden quedara anulada desde administracion. Usa esta accion solo si ya no debe seguir en flujo operativo.",
      confirmLabel: "Anular orden",
    });
  };

  const submitReactivate = () => {
    if (!selectedOrderId) return;
    setPendingAction({
      type: "reactivate-order",
      title: "Reactivar orden anulada",
      description: "Se intentara reservar nuevamente el stock para esta orden. Si no hay stock suficiente, la reactivacion sera bloqueada.",
      confirmLabel: "Reactivar orden",
    });
  };

  const submitWhatsApp = (messageType: "confirm" | "reject") => {
    if (!selectedOrderId) return;
    whatsappMutation.mutate({ id: selectedOrderId, messageType });
  };

  const executePendingAction = () => {
    if (!selectedOrderId || !pendingAction) return;

    if (pendingAction.type === "confirm-payment") {
      paymentMutation.mutate({ id: selectedOrderId, paymentStatus: "confirmed" }, { onSuccess: () => setPendingAction(null) });
      return;
    }

    if (pendingAction.type === "reject-payment") {
      paymentMutation.mutate({ id: selectedOrderId, paymentStatus: "rejected" }, { onSuccess: () => setPendingAction(null) });
      return;
    }

    if (pendingAction.type === "reactivate-order") {
      reactivateMutation.mutate({ id: selectedOrderId, reason: "Reactivada desde el panel administrativo." }, { onSuccess: () => setPendingAction(null) });
      return;
    }

    cancelMutation.mutate({ id: selectedOrderId, reason: "Anulada desde el panel administrativo." }, { onSuccess: () => setPendingAction(null) });
  };

  const closePendingAction = () => {
    if (paymentMutation.isPending || cancelMutation.isPending || reactivateMutation.isPending) return;
    setPendingAction(null);
  };

  const dialogTone = pendingAction?.type === "confirm-payment"
    ? "success"
    : pendingAction?.type === "cancel-order"
      ? "danger"
      : "warning";

  const printVoucher = () => {
    if (!selectedOrder) return;
    const latestPayment = selectedOrder.payments[0];
    const company = storeSettingsQuery.data?.company;
    const printWindow = window.open("", "_blank", "width=420,height=760");

    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresion. Verifica el bloqueador de ventanas.");
      return;
    }

    // In some browsers noopener/noreferrer returns null even when the popup opens.
    // We clear opener manually to keep isolation without triggering false negatives.
    try {
      printWindow.opener = null;
    } catch {
      // Ignore cross-browser assignment restrictions.
    }

    const paymentStatus = paymentStatusLabel(selectedOrder.paymentStatus);
    const paymentMethod = paymentMethodLabels[selectedOrder.paymentMethod] ?? "No definido";
    const documentType = documentTypeLabels[selectedOrder.documentType] ?? "Comprobante";
    const businessName = company?.companyBusinessName?.trim() || "Empresa";
    const companyRuc = company?.companyRuc?.trim() || "-";
    const companyAddress = company?.companyAddress?.trim() || "Direccion no configurada";
    const companyPhone = company?.companyPhone?.trim() || "-";
    const companyEmail = company?.companyEmail?.trim() || "-";
    const printedAt = formatDateTime(new Date().toISOString());
    const legalFooter = `Representacion impresa del comprobante interno de pago emitido por ${businessName}. Conserva este documento para consultas o reclamos.`;

    const itemsHtml = selectedOrder.items
      .map((item) => `
        <tr>
          <td>${item.quantity}x</td>
          <td>${escapeHtml(item.productName)}</td>
          <td style="text-align:right">${formatCurrency(item.total)}</td>
        </tr>
      `)
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Comprobante ${selectedOrder.number}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; background: #f4f6f8; }
            .sheet { width: 78mm; margin: 0 auto; background: #fff; color: #111; padding: 10px 12px 14px; }
            .brand { text-align: center; border-bottom: 1px dashed #bbb; padding-bottom: 8px; }
            .brand h1 { margin: 0; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; }
            .brand p { margin: 3px 0 0; font-size: 11px; color: #555; }
            .company-meta { margin-top: 5px; font-size: 10px; color: #444; line-height: 1.45; }
            .block { margin-top: 9px; font-size: 11px; }
            .row { display: flex; justify-content: space-between; gap: 10px; margin: 2px 0; }
            .muted { color: #666; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
            td { padding: 2px 0; vertical-align: top; }
            .totals { margin-top: 8px; border-top: 1px dashed #bbb; padding-top: 6px; }
            .total { font-weight: 800; font-size: 13px; }
            .footer { margin-top: 10px; border-top: 1px dashed #bbb; padding-top: 8px; text-align: center; font-size: 10px; color: #555; }
            .legal { margin-top: 8px; text-align: left; font-size: 9.5px; line-height: 1.45; color: #666; }
            @media print {
              body { background: #fff; }
              .sheet { width: 78mm; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="brand">
              <h1>${escapeHtml(businessName)}</h1>
              <p>Comprobante de pago</p>
              <div class="company-meta">
                <div>RUC: ${escapeHtml(companyRuc)}</div>
                <div>${escapeHtml(companyAddress)}</div>
                <div>Tel: ${escapeHtml(companyPhone)} | Email: ${escapeHtml(companyEmail)}</div>
              </div>
            </div>

            <div class="block">
              <div class="row"><span class="muted">Orden</span><strong>${selectedOrder.number}</strong></div>
              <div class="row"><span class="muted">Fecha</span><span>${formatDateTime(selectedOrder.createdAt)}</span></div>
              <div class="row"><span class="muted">Cliente</span><span>${escapeHtml(selectedOrder.customerName)}</span></div>
              <div class="row"><span class="muted">Documento</span><span>${escapeHtml(documentType)} ${escapeHtml(selectedOrder.documentNumber)}</span></div>
            </div>

            <div class="block">
              <div class="row"><span class="muted">Pago</span><span>${escapeHtml(paymentMethod)}</span></div>
              <div class="row"><span class="muted">Estado</span><strong>${escapeHtml(paymentStatus)}</strong></div>
              <div class="row"><span class="muted">Operacion</span><span>${escapeHtml(latestPayment?.externalReference || selectedOrder.number)}</span></div>
              <div class="row"><span class="muted">Emitido</span><span>${escapeHtml(printedAt)}</span></div>
            </div>

            <div class="block">
              <table>
                ${itemsHtml}
              </table>
            </div>

            <div class="totals block">
              <div class="row"><span>Subtotal</span><span>${formatCurrency(selectedOrder.subtotal)}</span></div>
              <div class="row"><span>Descuento</span><span>${formatCurrency(selectedOrder.discount)}</span></div>
              <div class="row"><span>Envio</span><span>${formatCurrency(selectedOrder.shipping)}</span></div>
              <div class="row total"><span>Total</span><span>${formatCurrency(selectedOrder.total)}</span></div>
            </div>

            <div class="footer">
              Gracias por su compra.
              <br />
              Documento generado por modulo admin.
              <p class="legal">${escapeHtml(legalFooter)}</p>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.onafterprint = () => window.close(); };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <>
      <AdminShell title="Ordenes" description="Seguimiento operativo de pedidos, pagos y comunicacion con clientes por WhatsApp.">
        <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Ordenes</p>
            <p className="mt-3 text-3xl font-black">{summary?.totalOrders ?? 0}</p>
            <p className="mt-2 text-xs text-foreground/60">Pedidos en el rango filtrado.</p>
          </article>
          <article className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Cobrado</p>
            <p className="mt-3 text-3xl font-black">{formatCurrency(summary?.confirmedRevenue ?? 0)}</p>
            <p className="mt-2 text-xs text-foreground/60">Ingresos con pago confirmado.</p>
          </article>
          <article className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Pendientes</p>
            <p className="mt-3 text-3xl font-black">{summary?.pendingPayments ?? 0}</p>
            <p className="mt-2 text-xs text-foreground/60">Pagos por revisar o contactar.</p>
          </article>
          <article className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Confirmados</p>
            <p className="mt-3 text-3xl font-black">{summary?.confirmedPayments ?? 0}</p>
            <p className="mt-2 text-xs text-foreground/60">Pagos aprobados en el rango.</p>
          </article>
          <article className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Rechazados</p>
            <p className="mt-3 text-3xl font-black">{summary?.rejectedPayments ?? 0}</p>
            <p className="mt-2 text-xs text-foreground/60">Pagos rechazados que requieren seguimiento.</p>
          </article>
          <article className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Anuladas</p>
            <p className="mt-3 text-3xl font-black">{summary?.cancelledOrders ?? 0}</p>
            <p className="mt-2 text-xs text-foreground/60">Ordenes cerradas sin despacho.</p>
          </article>
        </section>

        <section className="rounded-xl border border-border bg-background p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-bold">Centro de control de ordenes</h2>
              <p className="mt-1 text-sm text-foreground/60">Por recomendacion operativa agregue estado de orden, resumen ejecutivo y panel de detalle para resolver pedidos sin salir de la vista.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-orders"] })}>
              <RefreshCcw size={16} /> Actualizar
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Fecha inicio</span>
              <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Fecha fin</span>
              <input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Estado pago</span>
              <select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2">
                {paymentStatusOptions.map((option) => <option key={option.value || "all-payment"} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Estado orden</span>
              <select value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2">
                {orderStatusOptions.map((option) => <option key={option.value || "all-order"} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm xl:col-span-2">
              <span className="font-semibold">Cliente</span>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
                <input value={customerName} onChange={(event) => { setCustomerName(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3" placeholder="Nombre o correo" />
              </div>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Codigo orden</span>
              <input value={orderNumber} onChange={(event) => { setOrderNumber(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" placeholder="ORD-..." />
            </label>
          </div>
        </section>

          <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-xl border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-bold">Listado de ordenes</h2>
                <p className="text-sm text-foreground/60">{data?.page.totalItems ?? 0} orden(es) encontradas.</p>
              </div>
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value={20}>20 por pagina</option>
                <option value={50}>50 por pagina</option>
                <option value={100}>100 por pagina</option>
              </select>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              <div className="sticky top-2 z-10 rounded-xl border border-border bg-background/95 p-2 backdrop-blur">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
                  <input
                    value={mobileListQuery}
                    onChange={(event) => setMobileListQuery(event.target.value)}
                    className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-xs"
                    placeholder="Buscar orden, cliente o correo"
                  />
                </div>
              </div>
              {isLoading && <p className="text-sm text-foreground/60">Cargando ordenes...</p>}
              {!isLoading && orders.length === 0 && <p className="text-sm text-foreground/60">No hay ordenes para esos filtros.</p>}
              {!isLoading && orders.length > 0 && mobileFilteredOrders.length === 0 && <p className="text-sm text-foreground/60">Sin coincidencias para la busqueda.</p>}
              {mobileFilteredOrders.map((order) => {
                const isSelected = order.id === selectedOrderId;
                return (
                  <article key={order.id} onClick={() => setSelectedOrderId(order.id)} className={`rounded-xl border p-3 text-sm transition ${isSelected ? "border-primary/40 bg-accent/5" : "border-border bg-background"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{order.number}</p>
                        <p className="mt-1 text-xs text-foreground/55">{formatDateTime(order.createdAt)}</p>
                        <p className="mt-1 text-xs text-foreground/55">{order.itemCount} item(s)</p>
                      </div>
                      <p className="text-sm font-bold">{formatCurrency(order.total)}</p>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-foreground/70">
                      <p><span className="font-semibold">Cliente:</span> {order.customerName}</p>
                      <p className="truncate"><span className="font-semibold">Correo:</span> {order.customerEmail}</p>
                      <p><span className="font-semibold">Metodo:</span> {paymentMethodLabels[order.paymentMethod] ?? "No definido"}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentBadgeClass(order.paymentStatus)}`}>{paymentStatusLabel(order.paymentStatus)}</span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${orderBadgeClass(order.status)}`}>{orderStatusLabels[order.status] ?? "Sin estado"}</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Orden</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Pago</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td className="p-4 text-foreground/60" colSpan={5}>Cargando ordenes...</td></tr>
                  )}
                  {!isLoading && orders.length === 0 && (
                    <tr><td className="p-4 text-foreground/60" colSpan={5}>No hay ordenes para esos filtros.</td></tr>
                  )}
                  {orders.map((order) => {
                    const isSelected = order.id === selectedOrderId;
                    return (
                      <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} className={`cursor-pointer border-t border-border transition ${isSelected ? "bg-accent/5" : "hover:bg-muted/40"}`}>
                        <td className="p-3">
                          <p className="font-semibold">{order.number}</p>
                          <p className="mt-1 text-xs text-foreground/55">{formatDateTime(order.createdAt)}</p>
                          <p className="mt-1 text-xs text-foreground/55">{order.itemCount} item(s)</p>
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{order.customerName}</p>
                          <p className="mt-1 text-xs text-foreground/55">{order.customerEmail}</p>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentBadgeClass(order.paymentStatus)}`}>{paymentStatusLabel(order.paymentStatus)}</span>
                          <p className="mt-1 text-xs text-foreground/55">{paymentMethodLabels[order.paymentMethod] ?? "No definido"}</p>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${orderBadgeClass(order.status)}`}>{orderStatusLabels[order.status] ?? "Sin estado"}</span>
                        </td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(order.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm">
              <span>Pagina {page} de {totalPages}{isFetching ? " · actualizando..." : ""}</span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
                <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</Button>
              </div>
            </div>
          </div>

            <OrderDetailPanel
              order={selectedOrder}
              isLoading={selectedOrderQuery.isLoading}
              isBusy={paymentMutation.isPending || cancelMutation.isPending || reactivateMutation.isPending || whatsappMutation.isPending}
              onConfirmPayment={() => submitPaymentStatus("confirmed")}
              onRejectPayment={() => submitPaymentStatus("rejected")}
              onCancelOrder={submitCancel}
              onReactivateOrder={submitReactivate}
              onSendConfirmWhatsapp={() => submitWhatsApp("confirm")}
              onSendRejectWhatsapp={() => submitWhatsApp("reject")}
              onPrintVoucher={printVoucher}
            />
          </section>
        </div>
      </AdminShell>

      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.title ?? ""}
        description={pendingAction?.description ?? ""}
        confirmLabel={pendingAction?.confirmLabel ?? "Confirmar"}
        cancelLabel="Volver al panel"
        tone={dialogTone}
        isLoading={paymentMutation.isPending || cancelMutation.isPending || reactivateMutation.isPending}
        onConfirm={executePendingAction}
        onClose={closePendingAction}
      />
    </>
  );
}

function OrderDetailPanel({
  order,
  isLoading,
  isBusy,
  onConfirmPayment,
  onRejectPayment,
  onCancelOrder,
  onReactivateOrder,
  onSendConfirmWhatsapp,
  onSendRejectWhatsapp,
  onPrintVoucher,
}: {
  order?: OrderAdminDetailDto;
  isLoading: boolean;
  isBusy: boolean;
  onConfirmPayment: () => void;
  onRejectPayment: () => void;
  onCancelOrder: () => void;
  onReactivateOrder: () => void;
  onSendConfirmWhatsapp: () => void;
  onSendRejectWhatsapp: () => void;
  onPrintVoucher: () => void;
}) {
  if (isLoading) {
    return <aside className="rounded-xl border border-border bg-background p-5 text-sm text-foreground/60">Cargando detalle de orden...</aside>;
  }

  if (!order) {
    return <aside className="rounded-xl border border-border bg-background p-5 text-sm text-foreground/60">Selecciona una orden para ver el detalle completo.</aside>;
  }

  const isCancelled = order.status === 5;

  return (
    <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
      <section className="rounded-xl border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Orden activa</p>
            <h2 className="mt-2 text-xl font-black">{order.number}</h2>
            <p className="mt-2 text-sm text-foreground/60">{formatDateTime(order.createdAt)}</p>
          </div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentBadgeClass(order.paymentStatus)}`}>{paymentStatusLabel(order.paymentStatus)}</span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Button type="button" disabled={isBusy || isCancelled} onClick={onConfirmPayment}><CheckCircle2 size={16} /> Confirmar pago</Button>
          <Button type="button" variant="secondary" disabled={isBusy || isCancelled} onClick={onRejectPayment}><XCircle size={16} /> Rechazar pago</Button>
          <Button type="button" variant="secondary" disabled={isBusy || isCancelled} onClick={onSendConfirmWhatsapp}><MessageCircleMore size={16} /> WhatsApp pedido aprobado</Button>
          <Button type="button" variant="secondary" disabled={isBusy || isCancelled} onClick={onSendRejectWhatsapp}><Clock3 size={16} /> WhatsApp pago en revision</Button>
          <Button type="button" variant="ghost" disabled={isBusy || isCancelled} onClick={onCancelOrder}><Ban size={16} /> Anular orden</Button>
          <Button type="button" variant="secondary" disabled={isBusy || !isCancelled} onClick={onReactivateOrder}><RotateCcw size={16} /> Habilitar de nuevo</Button>
          <Button type="button" variant="secondary" disabled={isBusy} onClick={onPrintVoucher}><Printer size={16} /> Imprimir comprobante PDF</Button>
        </div>
        {isCancelled && <p className="mt-3 rounded-md bg-red-500/10 p-3 text-xs text-red-700">Esta orden esta anulada. Se deshabilitaron las demas acciones hasta que la reactives.</p>}
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h3 className="font-bold">Cliente y entrega</h3>
        <div className="mt-4 space-y-2 text-sm">
          <p><span className="font-semibold">Cliente:</span> {order.customerName}</p>
          <p><span className="font-semibold">Correo:</span> {order.customerEmail}</p>
          <p><span className="font-semibold">Telefono:</span> {order.customerPhone || "No definido"}</p>
          <p><span className="font-semibold">Comprobante:</span> {documentTypeLabels[order.documentType] ?? "No definido"} - {order.documentNumber}</p>
          <p><span className="font-semibold">Direccion:</span> {order.addressLine1}</p>
          <p><span className="font-semibold">Ubicacion:</span> {order.district}, {order.province}, {order.department}</p>
          {order.reference && <p><span className="font-semibold">Referencia:</span> {order.reference}</p>}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h3 className="font-bold">Resumen economico</h3>
        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-center justify-between gap-4"><span>Subtotal</span><strong>{formatCurrency(order.subtotal)}</strong></p>
          <p className="flex items-center justify-between gap-4"><span>Descuento</span><strong>{formatCurrency(order.discount)}</strong></p>
          <p className="flex items-center justify-between gap-4"><span>Envio</span><strong>{formatCurrency(order.shipping)}</strong></p>
          <p className="flex items-center justify-between gap-4"><span>Metodo pago</span><strong>{paymentMethodLabels[order.paymentMethod] ?? "No definido"}</strong></p>
          <p className="flex items-center justify-between gap-4 border-t border-border pt-2 text-base"><span>Total</span><strong>{formatCurrency(order.total)}</strong></p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h3 className="font-bold">Items de la orden</h3>
        <div className="mt-4 space-y-3">
          {order.items.map((item) => (
            <article key={item.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.productName}</p>
                  <p className="mt-1 text-xs text-foreground/55">SKU: {item.sku || "-"}</p>
                  {(item.color || item.size) && <p className="mt-1 text-xs text-foreground/55">{item.color || "Sin color"} / {item.size || "Sin talla"}</p>}
                </div>
                <strong>{formatCurrency(item.total)}</strong>
              </div>
              <p className="mt-2 text-xs text-foreground/55">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h3 className="font-bold">Historial de pago</h3>
        <div className="mt-4 space-y-3">
          {order.payments.map((payment) => (
            <article key={payment.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{payment.provider || "manual"}</p>
                  <p className="mt-1 text-xs text-foreground/55">{payment.integrationMode}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentBadgeClass(payment.status)}`}>{paymentStatusLabel(payment.status)}</span>
              </div>
              <p className="mt-2 text-xs text-foreground/55">Monto: {formatCurrency(payment.amount)}</p>
              {payment.externalReference && <p className="mt-1 text-xs text-foreground/55">Ref: {payment.externalReference}</p>}
              <p className="mt-1 text-xs text-foreground/55">Registrado: {formatDateTime(payment.createdAt)}</p>
            </article>
          ))}
        </div>
        {order.notes && <p className="mt-4 rounded-md bg-muted/40 p-3 text-sm text-foreground/70"><span className="font-semibold">Notas:</span> {order.notes}</p>}
      </section>
    </aside>
  );
}