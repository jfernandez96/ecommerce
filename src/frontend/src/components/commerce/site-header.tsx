"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCategories, getPromotions } from "@/lib/api";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { useStore } from "@/lib/hooks/store-context";

type NavGroup = {
  id: string;
  label: string;
  href: string;
  isHot?: boolean;
  children: Array<{ id: string; label: string; href: string }>;
};

export function SiteHeader() {
  const router = useRouter();
  const { storeName } = useStore();
  const count = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const openDrawer = useCartStore((state) => state.openDrawer);
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const { data: categories = [] } = useQuery({ queryKey: ["public-categories"], queryFn: getCategories });
  const { data: promotions = [] } = useQuery({ queryKey: ["public-promotions"], queryFn: getPromotions });
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const openGroup = (groupId: string) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setHoveredGroupId(groupId);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setHoveredGroupId(null);
      closeTimerRef.current = null;
    }, 140);
  };

  const navItems = useMemo<NavGroup[]>(() => {
    const now = Date.now();
    const hasActivePromotion = promotions.some((promotion) => {
      if (!promotion.isActive) return false;
      const startsAt = new Date(promotion.startsAt).getTime();
      const endsAt = new Date(promotion.endsAt).getTime();
      return startsAt <= now && endsAt >= now;
    });

    const roots = categories
      .filter((category) => !category.parentId && category.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const childrenByParentId = new Map<string, typeof categories>();
    for (const category of categories) {
      if (!category.parentId || !category.isActive) continue;
      const currentChildren = childrenByParentId.get(category.parentId) ?? [];
      currentChildren.push(category);
      childrenByParentId.set(category.parentId, currentChildren);
    }

    return roots.map<NavGroup>((category) => {
      const children = (childrenByParentId.get(category.id) ?? [])
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((child) => ({ id: child.id, label: child.name, href: `/seccion/${category.slug}?categoria=${child.slug}` }));

      return {
        id: category.id,
        label: category.name,
        href: `/seccion/${category.slug}`,
        children
      };
    }).concat(hasActivePromotion ? [{ id: "promotions", label: "Promociones", href: "/promociones", isHot: true, children: [] } as NavGroup] : []);
  }, [categories, promotions]);

  const navigationItems = useMemo<NavGroup[]>(() => [
    { id: "home", label: "Inicio", href: "/", children: [] },
    ...navItems
  ], [navItems]);

  const shortcutLinks = useMemo(() => {
    const base = navigationItems
      .filter((item) => item.id !== "home")
      .slice(0, 6)
      .map((item) => ({ id: item.id, label: item.label, href: item.href, isHot: item.isHot }));

    if (!base.some((item) => item.href === "/collections")) {
      base.unshift({ id: "collections", label: "Todo", href: "/collections", isHot: false });
    }

    return base;
  }, [navigationItems]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    const query = trimmed ? `?q=${encodeURIComponent(trimmed)}` : "";
    router.push(`/collections${query}`);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[hsl(var(--customer-surface)/0.92)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            variant="ghost"
            aria-label={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
          >
            {isMobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </Button>
        </div>
        <Link href="/" className="text-lg font-black tracking-normal text-[hsl(var(--customer-brand-strong))]">{storeName}</Link>
        <nav className="hidden max-w-4xl items-center gap-4 lg:flex">
          {navigationItems.map((item) => {
            const hasChildren = item.children.length > 0;
            const isOpen = hoveredGroupId === item.id;

            if (!hasChildren) {
              return (
                <Link key={item.id} href={item.href} className="group relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[15px] font-semibold uppercase tracking-[0.04em] text-[hsl(var(--customer-brand-strong))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--customer-brand))]">
                  <span>{item.label}</span>
                  {item.isHot && <span className="absolute -right-7 -top-2 rounded-sm bg-[hsl(var(--customer-cta))] px-1.5 py-0.5 text-[9px] font-bold leading-none tracking-[0.06em] text-white">HOT</span>}
                </Link>
              );
            }

            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => openGroup(item.id)}
                onMouseLeave={scheduleClose}
              >
                <Link
                  href={item.href}
                  onClick={() => setHoveredGroupId(null)}
                  className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[15px] font-semibold uppercase tracking-[0.04em] transition duration-200 ease-out ${isOpen ? "bg-[hsl(var(--customer-brand)/0.10)] text-[hsl(var(--customer-brand))] shadow-[0_10px_22px_rgba(29,155,240,0.14)]" : "text-[hsl(var(--customer-brand-strong))] hover:-translate-y-0.5 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--customer-brand))] hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]"}`}
                >
                  <span>{item.label}</span>
                  <ChevronDown size={14} className={`opacity-80 transition ${isOpen ? "rotate-180" : ""}`} />
                  {item.isHot && <span className="absolute -right-7 -top-2 rounded-sm bg-[hsl(var(--customer-cta))] px-1.5 py-0.5 text-[9px] font-bold leading-none tracking-[0.06em] text-white">HOT</span>}
                </Link>

                {isOpen && (
                  <div
                    className="absolute left-0 top-[calc(100%-1px)] z-[80] w-[320px] rounded-2xl border border-border bg-[hsl(var(--customer-surface))] p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-900"
                    onMouseEnter={() => openGroup(item.id)}
                    onMouseLeave={scheduleClose}
                  >
                    <div className="mb-2 flex items-center justify-between px-2 pt-1">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--customer-muted))]">Categorias</p>
                      <Link href={item.href} onClick={() => setHoveredGroupId(null)} className="text-xs font-semibold text-[hsl(var(--customer-brand))] hover:underline">Ver todo</Link>
                    </div>
                    <div className="max-h-[320px] overflow-auto pr-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.id}
                          href={child.href}
                          onClick={() => setHoveredGroupId(null)}
                          className="group mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] text-[hsl(var(--customer-muted))] transition duration-200 ease-out last:mb-0 hover:-translate-y-0.5 hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--customer-brand-strong))] hover:shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[#BFC8D4] transition group-hover:bg-[hsl(var(--customer-brand))]" />
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/wishlist" className="relative inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted transition" aria-label="Favoritos">
            <Heart size={20} className="fill-[hsl(var(--customer-cta))] text-[hsl(var(--customer-cta))]" />
            {wishlistCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--customer-cta))] px-1 text-xs font-bold text-white">{wishlistCount}</span>}
          </Link>
          <button type="button" onClick={openDrawer} className="relative inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted" aria-label="Carrito">
            <ShoppingBag size={20} className="text-[hsl(var(--customer-brand-strong))]" />
            {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--customer-brand-strong))] px-1 text-xs font-bold text-white">{count}</span>}
          </button>
        </div>
      </div>

      <div className="border-t border-border/70 bg-[hsl(var(--customer-surface)/0.95)]">
        <div className="mx-auto max-w-7xl px-4 py-2.5">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <label htmlFor="global-search" className="sr-only">Buscar productos</label>
            <input
              id="global-search"
              className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm"
              placeholder="Buscar por nombre, marca, categoria o SKU"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <Button type="submit" className="h-11 rounded-full px-4" aria-label="Buscar productos">
              <Search size={18} />
            </Button>
          </form>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {shortcutLinks.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${item.isHot ? "border-[hsl(var(--customer-cta)/0.4)] bg-[hsl(var(--customer-cta)/0.10)] text-[hsl(var(--customer-cta))]" : "border-border text-foreground/75 hover:bg-muted"}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-border bg-[hsl(var(--customer-surface))] px-4 pb-5 pt-3 lg:hidden">
          <nav className="space-y-3">
            {navigationItems.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-[hsl(var(--customer-surface))] p-3">
                <Link href={item.href} onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold uppercase tracking-[0.04em] text-[hsl(var(--customer-brand-strong))]">
                  {item.label}
                </Link>
                {item.children.length > 0 && (
                  <div className="mt-2 space-y-2 border-t border-border pt-2">
                    {item.children.map((child) => (
                      <Link
                        key={child.id}
                        href={child.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block text-sm text-foreground/80"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}