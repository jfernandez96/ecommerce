"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, BarChart3, Boxes, ChevronRight, CircleDollarSign, Image, PackageX, Percent, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getLowStockAlerts, listBanners, listPromotions, searchAdminOrders, searchAdminProducts, searchAdminSales } from "@/lib/admin-api";
import { formatCurrency } from "@/lib/utils";

const modules = [
  { title: "Ventas", icon: BarChart3, href: "/admin/sales" },
  { title: "Ordenes", icon: ShoppingCart, href: "/admin/orders" },
  { title: "Clientes", icon: Users, href: "/admin" },
  { title: "Productos", icon: Boxes, href: "/admin/products" },
  { title: "Promociones", icon: Percent, href: "/admin/promotions" },
  { title: "Banners", icon: Image, href: "/admin/banners" }
];

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
    end: toInputDate(now),
  };
}

function paymentStatusLabel(value: string) {
  switch (value) {
    case "pending":
      return "Pendiente";
    case "pending_contact":
      return "Pendiente contacto";
    case "confirmed":
      return "Confirmado";
    case "rejected":
      return "Rechazado";
    case "cancelled":
      return "Cancelado";
    default:
      return value;
  }
}

function orderStatusLabel(value: number) {
  switch (value) {
    case 0:
      return "Pendiente";
    case 1:
      return "Pagada";
    case 2:
      return "Preparando";
    case 3:
      return "Enviada";
    case 4:
      return "Entregada";
    case 5:
      return "Anulada";
    case 6:
      return "Devuelta";
    default:
      return "-";
  }
}

function kpiTrendText(value: number, positiveLabel: string, neutralLabel: string) {
  if (value > 0) return `${positiveLabel}: ${value}`;
  return neutralLabel;
}

export default function AdminPage() {
  const monthRange = getCurrentMonthRange();

  const salesQuery = useQuery({
    queryKey: ["admin-dashboard-sales", monthRange.start, monthRange.end],
    queryFn: () => searchAdminSales({ startDate: monthRange.start, endDate: monthRange.end, page: 1, pageSize: 10 }),
  });

  const ordersQuery = useQuery({
    queryKey: ["admin-dashboard-orders"],
    queryFn: () => searchAdminOrders({ page: 1, pageSize: 5 }),
  });

  const productsQuery = useQuery({
    queryKey: ["admin-dashboard-products"],
    queryFn: () => searchAdminProducts({ page: 1, pageSize: 1 }),
  });

  const lowStockQuery = useQuery({
    queryKey: ["admin-dashboard-low-stock"],
    queryFn: () => getLowStockAlerts(5),
  });

  const promotionsQuery = useQuery({
    queryKey: ["admin-dashboard-promotions"],
    queryFn: listPromotions,
  });

  const bannersQuery = useQuery({
    queryKey: ["admin-dashboard-banners"],
    queryFn: listBanners,
  });

  const salesSummary = salesQuery.data?.summary;
  const salesDaily = salesQuery.data?.dashboard.dailySales ?? [];
  const orderSummary = ordersQuery.data?.summary;
  const recentOrders = ordersQuery.data?.page.items ?? [];
  const lowStockItems = lowStockQuery.data ?? [];
  const totalProducts = productsQuery.data?.totalItems ?? 0;
  const promotions = Array.isArray(promotionsQuery.data) ? promotionsQuery.data : [];
  const banners = Array.isArray(bannersQuery.data) ? bannersQuery.data : [];
  const activePromotions = promotions.filter((promotion) => promotion.isActive).length;
  const activeBanners = banners.filter((banner) => banner.isActive).length;

  const maxDailySales = Math.max(...salesDaily.map((point) => point.grossSales), 1);

  return (
    <AdminShell title="Dashboard" description="Resumen operativo, accesos rapidos y modulos administrativos.">
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Venta bruta del mes"
            value={formatCurrency(salesSummary?.grossSales ?? 0)}
            description={kpiTrendText(salesSummary?.totalOrders ?? 0, "Ordenes vendidas", "Aun sin ordenes confirmadas este mes")}
            icon={<CircleDollarSign size={18} />}
            isLoading={salesQuery.isLoading}
          />
          <KpiCard
            title="Pagos pendientes"
            value={String(orderSummary?.pendingPayments ?? 0)}
            description="Pagos que requieren validacion operativa"
            icon={<AlertTriangle size={18} />}
            isLoading={ordersQuery.isLoading}
          />
          <KpiCard
            title="Catalogo activo"
            value={String(totalProducts)}
            description={kpiTrendText(lowStockItems.length, "Alertas de bajo stock", "Sin alertas criticas de stock")}
            icon={<Boxes size={18} />}
            isLoading={productsQuery.isLoading || lowStockQuery.isLoading}
          />
          <KpiCard
            title="Campanas en vitrina"
            value={String(activePromotions + activeBanners)}
            description={`${activePromotions} promociones y ${activeBanners} banners activos`}
            icon={<TrendingUp size={18} />}
            isLoading={promotionsQuery.isLoading || bannersQuery.isLoading}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-5 xl:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Tendencia diaria de ventas</h2>
                <p className="mt-1 text-sm text-foreground/60">Comportamiento del mes en curso por monto facturado.</p>
              </div>
              <Link href="/admin/sales" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Ver ventas <ChevronRight size={15} />
              </Link>
            </div>

            <div className="mt-6 h-52 rounded-xl border border-border/60 bg-gradient-to-b from-muted/20 to-background px-3 pb-3 pt-4">
              {salesQuery.isLoading ? (
                <p className="text-sm text-foreground/55">Cargando indicadores de ventas...</p>
              ) : salesDaily.length === 0 ? (
                <p className="text-sm text-foreground/55">Aun no hay ventas registradas para graficar este mes.</p>
              ) : (
                <div className="flex h-full items-end gap-2">
                  {salesDaily.map((point) => {
                    const height = Math.max((point.grossSales / maxDailySales) * 100, point.grossSales > 0 ? 8 : 2);
                    return (
                      <div key={point.dateLabel} className="group flex-1">
                        <div className="relative flex h-full items-end">
                          <div
                            className="w-full rounded-t-md bg-primary/80 transition-all group-hover:bg-primary"
                            style={{ height: `${height}%` }}
                            title={`${point.dateLabel}: ${formatCurrency(point.grossSales)} (${point.orders} ordenes)`}
                          />
                        </div>
                        <p className="mt-1 truncate text-center text-[11px] text-foreground/55">{point.dateLabel}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Alertas de inventario</h2>
                <p className="mt-1 text-sm text-foreground/60">Top de productos con riesgo operativo inmediato.</p>
              </div>
              <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Ver inventario <ChevronRight size={15} />
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {lowStockQuery.isLoading && <p className="text-sm text-foreground/55">Cargando alertas...</p>}
              {!lowStockQuery.isLoading && lowStockItems.length === 0 && (
                <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground/60">Sin productos con stock bajo.</p>
              )}
              {lowStockItems.map((item) => (
                <div key={item.productId} className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-sm font-semibold">{item.productName}</p>
                  <p className="text-xs text-foreground/60">SKU: {item.sku}</p>
                  <p className="mt-1 text-xs font-semibold text-rose-700">Stock: {item.stock} / Min: {item.minimumStock}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-5 xl:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Ordenes recientes</h2>
                <p className="mt-1 text-sm text-foreground/60">Seguimiento rapido de los ultimos pedidos ingresados.</p>
              </div>
              <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Ver ordenes <ChevronRight size={15} />
              </Link>
            </div>

            <div className="mt-4 overflow-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-muted/40 text-left text-foreground/70">
                  <tr>
                    <th className="p-3">Numero</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Pago</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersQuery.isLoading && (
                    <tr><td className="p-3 text-foreground/55" colSpan={5}>Cargando ordenes...</td></tr>
                  )}
                  {!ordersQuery.isLoading && recentOrders.length === 0 && (
                    <tr><td className="p-3 text-foreground/55" colSpan={5}>No hay ordenes registradas aun.</td></tr>
                  )}
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-border/70">
                      <td className="p-3 font-semibold">{order.number}</td>
                      <td className="p-3">{order.customerName}</td>
                      <td className="p-3">{paymentStatusLabel(order.paymentStatus)}</td>
                      <td className="p-3">{orderStatusLabel(order.status)}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-5">
            <h2 className="text-base font-bold">Accesos rapidos</h2>
            <p className="mt-1 text-sm text-foreground/60">Atajos a modulos criticos de operacion diaria.</p>

            <div className="mt-4 space-y-2">
              {modules.map((module) => (
                <Link
                  href={module.href}
                  key={module.title}
                  className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <module.icon size={15} />
                    {module.title}
                  </span>
                  <ChevronRight size={15} className="text-foreground/45" />
                </Link>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="inline-flex items-center gap-2 font-semibold"><PackageX size={14} /> Foco del dia</p>
              <p className="mt-1">Atiende primero pagos pendientes y alertas de stock para evitar cancelaciones.</p>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function KpiCard({
  title,
  value,
  description,
  icon,
  isLoading,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground/70">{title}</p>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight">{isLoading ? "..." : value}</p>
      <p className="mt-2 text-sm text-foreground/60">{description}</p>
    </article>
  );
}