"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Search, Rocket } from "lucide-react";
import Link from "next/link";
import { AdminTopMenu } from "@/components/admin/admin-top-menu";
import { CartDrawer } from "@/components/commerce/cart-drawer";
import { SiteFooter } from "@/components/commerce/site-footer";
import { SiteHeader } from "@/components/commerce/site-header";
import { VirtualShopAssistant } from "@/components/commerce/virtual-shop-assistant";
import { Button } from "@/components/ui/button";
import { searchAdminOrders } from "@/lib/admin-api";
import { api } from "@/lib/api";
import { useStore } from "@/lib/hooks/store-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

export function AppChrome({ children }: Readonly<{ children: React.ReactNode }>) {
  const { storeName } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const isAdminArea = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const pendingOrdersQuery = useQuery({
    queryKey: ["admin-topbar-orders"],
    queryFn: () => searchAdminOrders({ page: 1, pageSize: 50 }),
    refetchInterval: isNotificationsOpen ? 2000 : 10000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: isAdminArea && !isLoginPage,
  });

  const pendingOrders = useMemo(() => {
    const rawItems = pendingOrdersQuery.data?.page?.items;
    const orders = Array.isArray(rawItems) ? rawItems : [];
    return orders
      .filter((order) => order.paymentStatus === "pending" || order.paymentStatus === "pending_contact")
      .slice(0, 5);
  }, [pendingOrdersQuery.data]);

  const pendingOrdersCount = useMemo(() => {
    const rawItems = pendingOrdersQuery.data?.page?.items;
    const orders = Array.isArray(rawItems) ? rawItems : [];
    return orders.filter((order) => order.paymentStatus === "pending" || order.paymentStatus === "pending_contact").length;
  }, [pendingOrdersQuery.data]);

  useEffect(() => {
    setIsNotificationsOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  };

  const toggleNotifications = () => {
    if (!isNotificationsOpen) {
      void pendingOrdersQuery.refetch();
    }

    setIsNotificationsOpen((current) => !current);
  };

  if (isAdminArea) {
    return (
      <div className="min-h-screen bg-transparent">
        <div className="sticky top-0 z-40 border-b border-[#E5EAEF] bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F4FF] text-[#1D9BF0] sm:h-10 sm:w-10">
                <Rocket size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A889A] sm:text-xs sm:tracking-[0.22em]">{storeName}</p>
                <p className="text-xl font-extrabold leading-none text-[#1F2A37] dark:text-slate-100 sm:text-[32px]">Admin Console</p>
              </div>
            </div>

            {!isLoginPage && (
              <div className="hidden min-w-[240px] flex-1 items-center justify-center px-6 md:flex">
                <div className="flex h-11 w-full max-w-[420px] items-center gap-2 rounded-full border border-[#DFE5EC] bg-[#F9FBFD] px-4 text-sm text-[#6C7B8A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Search size={18} />
                  <input
                    type="text"
                    readOnly
                    value="Buscar modulo, pedido o venta"
                    className="w-full border-none bg-transparent p-0 text-[15px] text-[#556273] outline-none dark:text-slate-300"
                    aria-label="Buscador"
                  />
                </div>
              </div>
            )}

            <div className="relative ml-auto flex items-center gap-2 sm:gap-3">
              {!isLoginPage && <div className="relative">
                <Button variant="secondary" type="button" className="h-11 rounded-2xl border border-[#DFE5EC] bg-[#F9FBFD] px-3 text-[#435266] hover:bg-[#F1F6FB] dark:border-slate-700 dark:bg-slate-900" onClick={toggleNotifications}>
                  <Bell size={16} />
                  {pendingOrdersCount > 0 && (
                    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#1D9BF0] px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {pendingOrdersCount > 99 ? "99+" : pendingOrdersCount}
                    </span>
                  )}
                </Button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-[360px] max-w-[92vw] rounded-2xl border border-border bg-background p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-bold">Pendientes de pago</p>
                      <span className="text-xs text-foreground/55">Top 5</span>
                    </div>

                    <div className="max-h-80 space-y-2 overflow-auto pr-1">
                      {pendingOrdersQuery.isLoading && <p className="text-sm text-foreground/60">Cargando ordenes...</p>}
                      {!pendingOrdersQuery.isLoading && pendingOrders.length === 0 && (
                        <p className="text-sm text-foreground/60">No hay ordenes pendientes de pago.</p>
                      )}
                      {pendingOrders.map((order) => (
                        <Link key={order.id} href={`/admin/orders?selected=${order.id}`} className="block rounded-xl border border-border px-3 py-2 transition hover:bg-muted">
                          <p className="text-sm font-semibold">{order.number}</p>
                          <p className="mt-1 text-xs text-foreground/60">{order.customerName} · {paymentStatusLabel(order.paymentStatus)}</p>
                        </Link>
                      ))}
                    </div>

                    <div className="mt-3 border-t border-border pt-3">
                      <Link href="/admin/orders" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">Ver todos</Link>
                    </div>
                  </div>
                )}
              </div>}
              {!isLoginPage && (
                <>
                  <div className="hidden items-center gap-2 rounded-2xl border border-[#DFE5EC] bg-[#F9FBFD] px-3 py-2 md:flex dark:border-slate-700 dark:bg-slate-900">
                    <div className="h-8 w-8 rounded-full bg-[#DDEBFF]" />
                    <p className="text-sm font-semibold leading-none text-[#1F2A37] dark:text-slate-100">Administrador</p>
                  </div>
                  <Button variant="secondary" type="button" className="h-11 rounded-2xl border border-[#DFE5EC] bg-[#F9FBFD] px-3 text-[#435266] hover:bg-[#F1F6FB] dark:border-slate-700 dark:bg-slate-900" onClick={handleLogout}>
                    <LogOut size={16} />
                  </Button>
                </>
              )}
            </div>
          </div>

          {!isLoginPage && <AdminTopMenu />}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="customer-shell min-h-screen">
      <SiteHeader />
      <CartDrawer />
      <VirtualShopAssistant />
      {children}
      <SiteFooter />
    </div>
  );
}
