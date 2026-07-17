"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Download, FileSpreadsheet, FileText, PackageSearch, RefreshCcw, Search, TrendingUp, Wallet, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import { downloadSaleSunatCdr, downloadSaleSunatXml, exportAdminSalesExcel, exportAdminSalesPdf, searchAdminSales, sendSaleToSunat } from "@/lib/admin-api";
import { formatCurrency } from "@/lib/utils";

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(value));
}

function formatCorrelative(value?: number | null) {
  return typeof value === "number" ? String(value).padStart(8, "0") : "Sin asignar";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrio un error inesperado.";
}

function sunatStatusLabel(value: string) {
  switch (value) {
    case "accepted":
      return "Aceptado";
    case "rejected":
      return "Rechazado";
    case "observed":
      return "Observado";
    case "sent":
      return "Enviado";
    case "error":
      return "Error";
    default:
      return "Pendiente";
  }
}

function sunatStatusClass(value: string) {
  switch (value) {
    case "accepted":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-rose-100 text-rose-800";
    case "observed":
      return "bg-orange-100 text-orange-800";
    case "sent":
      return "bg-sky-100 text-sky-800";
    case "error":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-muted text-foreground/70";
  }
}

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

type SunatDetailModalState = {
  orderNumber: string;
  status: string;
  message: string;
} | null;

export default function AdminSalesPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [product, setProduct] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const [downloadingFileKey, setDownloadingFileKey] = useState<string | null>(null);
  const [sunatDetailModal, setSunatDetailModal] = useState<SunatDetailModalState>(null);
  const [mobileListQuery, setMobileListQuery] = useState("");

  const filters = useMemo(() => ({ startDate, endDate, product: product.trim(), page, pageSize }), [endDate, page, pageSize, product, startDate]);

  const salesQuery = useQuery({
    queryKey: ["admin-sales", filters],
    queryFn: () => searchAdminSales(filters),
  });

  const sendSunatMutation = useMutation({
    mutationFn: (orderId: string) => sendSaleToSunat(orderId),
    onSuccess: async (result) => {
      if (result.status === "error" || result.status === "rejected") {
        toast.error(result.message || "No se pudo procesar el envio a SUNAT.");
      } else {
        toast.success(result.message || "Documento enviado a SUNAT.");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-sales"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "No se pudo enviar el documento a SUNAT.");
    },
    onSettled: () => {
      setSendingOrderId(null);
    },
  });

  const result = salesQuery.data;
  const items = result?.page.items ?? [];
  const mobileFilteredItems = useMemo(() => {
    const term = mobileListQuery.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => (`${item.orderNumber} ${item.customerName} ${item.customerEmail} ${item.productName} ${item.sku}`).toLowerCase().includes(term));
  }, [items, mobileListQuery]);
  const summary = result?.summary;
  const dashboard = result?.dashboard;
  const totalPages = Math.max(result?.page.totalPages ?? 1, 1);

  const exportParams = useMemo(() => ({ startDate: startDate || undefined, endDate: endDate || undefined, product: product.trim() }), [endDate, product, startDate]);

  const applyCurrentMonth = () => {
    const now = new Date();
    setStartDate(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    setEndDate(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    setPage(1);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setProduct("");
    setPage(1);
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportAdminSalesExcel(exportParams);
      toast.success("Reporte Excel generado correctamente.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportAdminSalesPdf(exportParams);
      toast.success("Reporte PDF generado correctamente.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSendToSunat = (orderId: string) => {
    setSendingOrderId(orderId);
    sendSunatMutation.mutate(orderId);
  };

  const handleDownloadXml = async (orderId: string) => {
    try {
      setDownloadingFileKey(`${orderId}-xml`);
      await downloadSaleSunatXml(orderId);
      toast.success("XML descargado correctamente.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloadingFileKey(null);
    }
  };

  const handleDownloadCdr = async (orderId: string) => {
    try {
      setDownloadingFileKey(`${orderId}-cdr`);
      await downloadSaleSunatCdr(orderId);
      toast.success("CDR descargado correctamente.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloadingFileKey(null);
    }
  };

  const showObservationIcon = (status: string, message?: string | null) =>
    (status === "rejected" || status === "observed" || status === "error") && Boolean(message);

  return (
    <AdminShell
      title="Ventas"
      description="Ventas reales materializadas en Sales/SaleItems al confirmar el pago, con trazabilidad comercial y exportacion ejecutiva."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Venta bruta" value={formatCurrency(summary?.grossSales ?? 0)} description="Ingresos filtrados de lineas vendidas." icon={<Wallet size={18} />} />
          <MetricCard title="Ordenes vendidas" value={String(summary?.totalOrders ?? 0)} description="Pedidos con venta materializada." icon={<TrendingUp size={18} />} />
          <MetricCard title="Lineas vendidas" value={String(summary?.totalLines ?? 0)} description="Detalle comercial por producto." icon={<PackageSearch size={18} />} />
          <MetricCard title="Unidades" value={String(summary?.unitsSold ?? 0)} description="Volumen total de unidades." icon={<Download size={18} />} />
        </section>

        <section className="rounded-xl border border-border bg-background p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-bold">Centro de ventas</h2>
              <p className="mt-1 text-sm text-foreground/60">Filtra por fechas y producto; exporta el resultado a Excel o PDF con el mismo criterio aplicado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={applyCurrentMonth}>
                Mes actual
              </Button>
              <Button type="button" variant="secondary" onClick={clearFilters}>
                Quitar filtros
              </Button>
              <Button type="button" variant="secondary" onClick={() => salesQuery.refetch()}>
                <RefreshCcw size={16} /> Actualizar
              </Button>
              <Button type="button" variant="secondary" disabled={isExportingExcel} onClick={handleExportExcel}>
                <FileSpreadsheet size={16} /> {isExportingExcel ? "Generando Excel..." : "Exportar Excel"}
              </Button>
              <Button type="button" variant="secondary" disabled={isExportingPdf} onClick={handleExportPdf}>
                <FileText size={16} /> {isExportingPdf ? "Generando PDF..." : "Exportar PDF"}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Fecha inicio</span>
              <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Fecha fin</span>
              <input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm xl:col-span-2">
              <span className="font-semibold">Producto</span>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
                <input value={product} onChange={(event) => { setProduct(event.target.value); setPage(1); }} className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3" placeholder="Nombre del producto o SKU" />
              </div>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Filas</span>
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="w-full rounded-md border border-border bg-background px-3 py-2">
                <option value={20}>20 por pagina</option>
                <option value={50}>50 por pagina</option>
                <option value={100}>100 por pagina</option>
              </select>
            </label>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <article className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Ventas por dia</h3>
                <p className="mt-1 text-sm text-foreground/60">Tendencia diaria de ingresos y unidades sobre el filtro actual.</p>
              </div>
              <span className="text-xs text-foreground/55">{dashboard?.dailySales.length ?? 0} dia(s)</span>
            </div>
            <DailySalesChart points={dashboard?.dailySales ?? []} />
          </article>

          <article className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Top productos vendidos</h3>
                <p className="mt-1 text-sm text-foreground/60">Ranking por unidades y facturacion.</p>
              </div>
              <span className="text-xs text-foreground/55">Top 10</span>
            </div>
            <div className="mt-4 space-y-3">
              {(dashboard?.topProducts ?? []).length === 0 && <p className="text-sm text-foreground/60">Sin datos suficientes para el ranking.</p>}
              {(dashboard?.topProducts ?? []).map((item, index) => (
                <div key={`${item.productId}-${item.sku}`} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">#{index + 1}</p>
                      <p className="mt-1 font-semibold">{item.productName}</p>
                      <p className="mt-1 text-xs text-foreground/55">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.unitsSold} u.</p>
                      <p className="mt-1 text-xs text-foreground/55">{formatCurrency(item.revenue)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-foreground/55">{item.orders} orden(es) involucradas.</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-xl border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-bold">Detalle de ventas materializadas</h2>
              <p className="text-sm text-foreground/60">{result?.page.totalItems ?? 0} registro(s) en el reporte.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/55">
              <Wallet size={14} /> Solo ventas con pago confirmado
            </div>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            <div className="sticky top-2 z-10 rounded-xl border border-border bg-background/95 p-2 backdrop-blur">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
                <input
                  value={mobileListQuery}
                  onChange={(event) => setMobileListQuery(event.target.value)}
                  className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-xs"
                  placeholder="Buscar orden, cliente, producto o SKU"
                />
              </div>
            </div>
            {salesQuery.isLoading && <p className="text-sm text-foreground/60">Cargando ventas...</p>}
            {!salesQuery.isLoading && items.length === 0 && <p className="text-sm text-foreground/60">No hay ventas para el filtro aplicado.</p>}
            {!salesQuery.isLoading && items.length > 0 && mobileFilteredItems.length === 0 && <p className="text-sm text-foreground/60">Sin coincidencias para la busqueda.</p>}
            {mobileFilteredItems.map((item) => (
              <article key={`${item.orderId}-${item.productId}-${item.productVariantId ?? "base"}-${item.sku}-${item.saleDate}`} className="rounded-xl border border-border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.orderNumber}</p>
                    <p className="mt-1 text-xs text-foreground/55">{formatDateTime(item.saleDate)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sunatStatusClass(item.sunatStatus)}`}>{sunatStatusLabel(item.sunatStatus)}</span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-foreground/70">
                  <p><span className="font-semibold">Cliente:</span> {item.customerName}</p>
                  <p className="truncate"><span className="font-semibold">Correo:</span> {item.customerEmail}</p>
                  <p><span className="font-semibold">Producto:</span> {item.productName}</p>
                  <p><span className="font-semibold">SKU:</span> {item.sku}</p>
                  <p><span className="font-semibold">Metodo:</span> {paymentMethodLabels[item.paymentMethod] ?? "No definido"}</p>
                  <p><span className="font-semibold">Cantidad:</span> {item.quantity}</p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <p className="rounded-md border border-border p-2"><span className="block text-foreground/55">P. unit.</span><strong>{formatCurrency(item.unitPrice)}</strong></p>
                  <p className="rounded-md border border-border p-2"><span className="block text-foreground/55">Total linea</span><strong>{formatCurrency(item.lineTotal)}</strong></p>
                  <p className="col-span-2 rounded-md border border-border p-2"><span className="block text-foreground/55">Total orden</span><strong>{formatCurrency(item.orderTotal)}</strong></p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {showObservationIcon(item.sunatStatus, item.sunatStatusMessage) && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSunatDetailModal({
                        orderNumber: item.orderNumber,
                        status: item.sunatStatus,
                        message: item.sunatStatusMessage ?? "SUNAT no devolvio detalle adicional.",
                      })}
                    >
                      Ver detalle SUNAT
                    </Button>
                  )}

                  {item.sunatStatus === "accepted" ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={downloadingFileKey === `${item.orderId}-xml`}
                        onClick={() => handleDownloadXml(item.orderId)}
                      >
                        XML
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={downloadingFileKey === `${item.orderId}-cdr`}
                        onClick={() => handleDownloadCdr(item.orderId)}
                      >
                        CDR
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        sendingOrderId === item.orderId ||
                        item.paymentStatus !== "confirmed" ||
                        item.orderStatus === 5 ||
                        item.orderStatus === 6
                      }
                      onClick={() => handleSendToSunat(item.orderId)}
                    >
                      {sendingOrderId === item.orderId ? "Enviando..." : "Enviar SUNAT"}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-auto md:block">
            <table className="w-full min-w-[1440px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Fecha venta</th>
                  <th className="p-3">Orden</th>
                  <th className="p-3">Serie</th>
                  <th className="p-3">Correlativo</th>
                  <th className="p-3">SUNAT</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Metodo</th>
                  <th className="p-3 text-right">Cant.</th>
                  <th className="p-3 text-right">P. unit.</th>
                  <th className="p-3 text-right">Total linea</th>
                  <th className="p-3 text-right">Total orden</th>
                  <th className="p-3">Accion</th>
                </tr>
              </thead>
              <tbody>
                {salesQuery.isLoading && (
                  <tr><td className="p-4 text-foreground/60" colSpan={13}>Cargando ventas...</td></tr>
                )}
                {!salesQuery.isLoading && items.length === 0 && (
                  <tr><td className="p-4 text-foreground/60" colSpan={13}>No hay ventas para el filtro aplicado. Prueba con "Quitar filtros" o confirma pagos en Ordenes.</td></tr>
                )}
                {items.map((item) => (
                  <tr key={`${item.orderId}-${item.productId}-${item.productVariantId ?? "base"}-${item.sku}-${item.saleDate}`} className="border-t border-border align-top">
                    <td className="p-3 text-foreground/70">{formatDateTime(item.saleDate)}</td>
                    <td className="p-3">
                      <p className="font-semibold">{item.orderNumber}</p>
                      <p className="mt-1 text-xs text-foreground/55">{orderStatusLabels[item.orderStatus] ?? "Sin estado"}</p>
                    </td>
                    <td className="p-3 font-medium">{item.sunatSeries ?? "Sin asignar"}</td>
                    <td className="p-3 text-foreground/70">{formatCorrelative(item.sunatCorrelative)}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sunatStatusClass(item.sunatStatus)}`}>
                        {sunatStatusLabel(item.sunatStatus)}
                      </span>
                      {showObservationIcon(item.sunatStatus, item.sunatStatusMessage) && (
                        <button
                          type="button"
                          className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full ${item.sunatStatus === "error" ? "text-amber-800 hover:bg-amber-100" : "text-rose-700 hover:bg-rose-100"}`}
                          title="Ver detalle SUNAT"
                          onClick={() => setSunatDetailModal({
                            orderNumber: item.orderNumber,
                            status: item.sunatStatus,
                            message: item.sunatStatusMessage ?? "SUNAT no devolvio detalle adicional.",
                          })}
                        >
                          <CircleAlert size={14} />
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{item.customerName}</p>
                      <p className="mt-1 text-xs text-foreground/55">{item.customerEmail}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-start gap-2">
                        <PackageSearch size={15} className="mt-0.5 text-foreground/45" />
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="mt-1 text-xs text-foreground/55">SKU: {item.sku}</p>
                          {item.variantLabel && <p className="mt-1 text-xs text-foreground/55">{item.variantLabel}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{paymentMethodLabels[item.paymentMethod] ?? "No definido"}</p>
                      <p className="mt-1 text-xs text-emerald-700">{item.paymentStatus}</p>
                    </td>
                    <td className="p-3 text-right font-semibold">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-3 text-right font-semibold">{formatCurrency(item.lineTotal)}</td>
                    <td className="p-3 text-right">{formatCurrency(item.orderTotal)}</td>
                    <td className="p-3">
                      {item.sunatStatus === "accepted" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={downloadingFileKey === `${item.orderId}-xml`}
                            onClick={() => handleDownloadXml(item.orderId)}
                          >
                            {downloadingFileKey === `${item.orderId}-xml` ? "Descargando XML..." : "XML"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={downloadingFileKey === `${item.orderId}-cdr`}
                            onClick={() => handleDownloadCdr(item.orderId)}
                          >
                            {downloadingFileKey === `${item.orderId}-cdr` ? "Descargando CDR..." : "CDR"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={
                            sendingOrderId === item.orderId ||
                            item.paymentStatus !== "confirmed" ||
                            item.orderStatus === 5 ||
                            item.orderStatus === 6
                          }
                          onClick={() => handleSendToSunat(item.orderId)}
                        >
                          {sendingOrderId === item.orderId ? "Enviando..." : "Enviar SUNAT"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm">
            <span>Pagina {page} de {totalPages}{salesQuery.isFetching ? " · actualizando..." : ""}</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
              <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</Button>
            </div>
          </div>
        </section>
      </div>

      <SunatDetailModal
        open={Boolean(sunatDetailModal)}
        orderNumber={sunatDetailModal?.orderNumber ?? ""}
        status={sunatDetailModal?.status ?? ""}
        message={sunatDetailModal?.message ?? ""}
        onClose={() => setSunatDetailModal(null)}
      />
    </AdminShell>
  );
}

function SunatDetailModal({
  open,
  orderNumber,
  status,
  message,
  onClose,
}: {
  open: boolean;
  orderNumber: string;
  status: string;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Cerrar detalle SUNAT" />

      <article className="relative w-full max-w-2xl rounded-[28px] border border-border bg-background shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-foreground/45">Detalle SUNAT</p>
            <h3 className="mt-1 text-xl font-black">Orden {orderNumber}</h3>
            <p className="mt-1 text-sm text-foreground/65">Estado: {sunatStatusLabel(status)}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground/55 transition hover:bg-muted hover:text-foreground" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="max-h-[360px] overflow-auto rounded-2xl border border-border bg-muted/25 p-4">
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/80">{message}</pre>
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </article>
    </div>
  );
}

function MetricCard({ title, value, description, icon }: { title: string; value: string; description: string; icon: ReactNode }) {
  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">{title}</p>
        <div className="text-foreground/55">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs text-foreground/60">{description}</p>
    </article>
  );
}

function DailySalesChart({ points }: { points: Array<{ dateLabel: string; grossSales: number; orders: number; unitsSold: number }> }) {
  if (points.length === 0) {
    return <p className="mt-6 text-sm text-foreground/60">Sin datos suficientes para graficar el periodo.</p>;
  }

  const maxValue = Math.max(...points.map((point) => point.grossSales), 1);

  return (
    <div className="mt-6">
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_60%)] p-4">
        <div className="flex h-56 min-w-max items-end gap-5">
        {points.map((point) => (
          <div key={point.dateLabel} className="flex w-[84px] shrink-0 flex-col items-center gap-2">
            <div className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground/70">{formatCurrency(point.grossSales)}</div>
            <div className="flex h-40 w-3 items-end rounded-full bg-muted/80">
              <div
                className="w-full rounded-full bg-[linear-gradient(180deg,#0f172a,#334155)] shadow-[0_4px_14px_rgba(15,23,42,0.25)] transition-all"
                style={{ height: `${Math.max((point.grossSales / maxValue) * 100, 8)}%` }}
              />
            </div>
            <div className="text-xs font-semibold">{point.dateLabel}</div>
            <div className="text-[11px] text-foreground/55">{point.orders} ord / {point.unitsSold} u.</div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}