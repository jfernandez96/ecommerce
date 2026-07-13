"use client";

import Link from "next/link";
import {
  Boxes,
  ChevronDown,
  LayoutDashboard,
  LoaderCircle,
  Percent,
  Settings,
  ShoppingCart,
  Warehouse
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type NavItem = { href: string; label: string };

type NavGroup = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [{ href: "/admin", label: "Resumen" }]
  },
  {
    key: "catalogo",
    label: "Catalogo",
    icon: Boxes,
    items: [
      { href: "/admin/products", label: "Productos" },
      { href: "/admin/categories", label: "Categorias" },
      { href: "/admin/brands", label: "Marcas" },
      { href: "/admin/inventory", label: "Mercaderia" }
    ]
  },
  {
    key: "comercial",
    label: "Comercial",
    icon: Percent,
    items: [
      { href: "/admin/promotions", label: "Promociones" },
      { href: "/admin/banners", label: "Banners" },
      { href: "/admin/menu", label: "Menu" }
    ]
  },
  {
    key: "ventas",
    label: "Ventas",
    icon: ShoppingCart,
    items: [
      { href: "/admin/orders", label: "Ordenes" },
      { href: "/admin/sales", label: "Ventas" }
    ]
  },
  {
    key: "ajustes",
    label: "Ajustes",
    icon: Settings,
    items: [
      { href: "/admin/stores", label: "Tiendas" },
      { href: "/admin/settings", label: "Configuracion" },
      { href: "/admin/users", label: "Usuarios" }
    ]
  }
];

function resolveGroupByPath(pathname: string) {
  return groups.find((group) => group.items.some((item) => item.href === pathname)) ?? groups[0];
}

export function AdminTopMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>(resolveGroupByPath(pathname).key);
  const [hoveredGroupKey, setHoveredGroupKey] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPendingHref(null);
    setSelectedGroupKey(resolveGroupByPath(pathname).key);
    setHoveredGroupKey(null);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    groups.forEach((group) => {
      group.items.forEach((item) => {
        router.prefetch(item.href);
      });
    });
  }, [router]);

  const openGroup = (groupKey: string) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setSelectedGroupKey(groupKey);
    setHoveredGroupKey(groupKey);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setHoveredGroupKey(null);
      closeTimerRef.current = null;
    }, 140);
  };

  const selectedGroup = useMemo(
    () => groups.find((group) => group.key === selectedGroupKey) ?? groups[0],
    [selectedGroupKey]
  );

  const activeItem = useMemo(
    () => selectedGroup.items.find((item) => item.href === pathname) ?? selectedGroup.items[0],
    [pathname, selectedGroup]
  );

  return (
    <div className="relative z-[60] border-t border-[#E5EAEF] bg-white/98 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <nav className="no-scrollbar flex h-[62px] items-center gap-2">
          {groups.map((group) => {
            const isActiveGroup = group.key === selectedGroup.key;
            const isPathActive = group.items.some((item) => item.href === pathname);
            const isPending = pendingHref != null && group.items.some((item) => item.href === pendingHref);
            const isHovered = hoveredGroupKey === group.key;

            return (
              <div
                key={group.key}
                className="relative"
                onMouseEnter={() => openGroup(group.key)}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  onClick={() => openGroup(group.key)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    isActiveGroup || isPathActive || isHovered
                      ? "bg-[#E8F4FF] text-[#1D9BF0]"
                      : "text-[#5A6A85] hover:bg-[#F2F7FC] hover:text-[#334155]"
                  }`}
                >
                  {isPending ? <LoaderCircle size={17} className="animate-spin" /> : <group.icon size={17} />}
                  <span>{group.label}</span>
                  <ChevronDown size={15} className={`opacity-80 transition ${isHovered ? "rotate-180" : ""}`} />
                </button>

                {isHovered && (
                  <div
                    className="absolute left-0 top-[calc(100%-1px)] z-[80] w-[360px] max-w-[92vw] rounded-b-[22px] border border-[#DCE4EE] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900"
                    onMouseEnter={() => openGroup(group.key)}
                    onMouseLeave={scheduleClose}
                  >
                    <div className="mb-2 rounded-xl bg-[#F2F7FC] px-3 py-2 text-sm font-semibold text-[#355070]">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const isActiveItem = pathname === item.href;
                      const isPendingItem = pendingHref === item.href;

                      return (
                        <Link
                          key={`${group.key}-${item.href}`}
                          href={item.href}
                          onClick={() => {
                            if (pathname !== item.href) {
                              setPendingHref(item.href);
                            }
                            setHoveredGroupKey(null);
                          }}
                          className={`mb-1 flex items-center rounded-xl px-3 py-2 text-sm transition last:mb-0 ${
                            isActiveItem
                              ? "bg-[#1D9BF0] text-white"
                              : "text-[#4E6076] hover:bg-[#F2F7FC]"
                          }`}
                        >
                          {isPendingItem ? `Cargando ${item.label.toLowerCase()}...` : item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
