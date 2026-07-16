"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, Facebook, Instagram, Music2 } from "lucide-react";
import { getCategories, getPromotions, getPublicFooterSettings } from "@/lib/api";
import { useStore } from "@/lib/hooks/store-context";

export function SiteFooter() {
  const { storeName } = useStore();
  const year = new Date().getFullYear();
  const { data: categories = [] } = useQuery({ queryKey: ["public-categories"], queryFn: getCategories });
  const { data: promotions = [] } = useQuery({ queryKey: ["public-promotions"], queryFn: getPromotions });
  const { data: company } = useQuery({ queryKey: ["public-footer-settings"], queryFn: getPublicFooterSettings });

  const menuItems = useMemo(() => {
    const now = Date.now();
    const hasActivePromotion = promotions.some((promotion) => {
      if (!promotion.isActive) return false;
      const startsAt = new Date(promotion.startsAt).getTime();
      const endsAt = new Date(promotion.endsAt).getTime();
      return startsAt <= now && endsAt >= now;
    });

    const categoriesFromMenu = categories
      .filter((category) => !category.parentId && category.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((category) => ({ label: category.name, href: `/seccion/${category.slug}` }));

    return [
      { label: "Inicio", href: "/" },
      ...categoriesFromMenu,
      ...(hasActivePromotion ? [{ label: "Promociones", href: "/promociones" }] : [])
    ];
  }, [categories, promotions]);

  const companyData = company ?? {
    companyRuc: "20613512277",
    companyBusinessName: "Descosale E.I.R.L",
    companyAddress: "Direccion pendiente",
    companyPhone: "+51 937211721",
    companyEmail: "descoaostv@gmail.com"
  };

  return (
    <footer className="mt-16 border-t border-border/70 bg-[hsl(var(--customer-brand-strong))] text-[hsl(var(--customer-cta-contrast))]">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-2 lg:grid-cols-4">
        <section className="space-y-4">
          <h3 className="text-lg font-bold">Informacion de la empresa</h3>
          <p className="text-sm text-[hsl(var(--customer-cta-contrast)/0.90)]"><span className="font-semibold">RUC:</span> {companyData.companyRuc}</p>
          <p className="text-sm text-[hsl(var(--customer-cta-contrast)/0.90)]"><span className="font-semibold">Razon social:</span> {companyData.companyBusinessName}</p>
          <p className="text-sm text-[hsl(var(--customer-cta-contrast)/0.90)]"><span className="font-semibold">Direccion:</span> {companyData.companyAddress}</p>
          <p className="text-sm text-[hsl(var(--customer-cta-contrast)/0.90)]">{companyData.companyPhone}</p>
          <p className="text-sm text-[hsl(var(--customer-cta-contrast)/0.90)]">{companyData.companyEmail}</p>
          <div className="flex items-center gap-3 pt-2">
            <a className="grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--customer-cta-contrast)/0.40)] transition hover:bg-[hsl(var(--customer-cta-contrast))] hover:text-[hsl(var(--customer-brand-strong))]" href="#" aria-label="Facebook"><Facebook size={16} /></a>
            <a className="grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--customer-cta-contrast)/0.40)] transition hover:bg-[hsl(var(--customer-cta-contrast))] hover:text-[hsl(var(--customer-brand-strong))]" href="#" aria-label="Instagram"><Instagram size={16} /></a>
            <a className="grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--customer-cta-contrast)/0.40)] transition hover:bg-[hsl(var(--customer-cta-contrast))] hover:text-[hsl(var(--customer-brand-strong))]" href="#" aria-label="TikTok"><Music2 size={16} /></a>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-bold">Categorias</h3>
          <nav className="flex flex-col gap-2 text-sm">
            {menuItems.map((item) => (
              <Link key={item.href} className="text-[hsl(var(--customer-cta-contrast)/0.85)] transition hover:text-white" href={item.href}>{item.label}</Link>
            ))}
          </nav>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-bold">Contenido</h3>
          <nav className="flex flex-col gap-2 text-sm">
            <Link className="text-[hsl(var(--customer-cta-contrast)/0.85)] transition hover:text-white" href="/preguntas-frecuentes">Preguntas frecuentes</Link>
            <Link className="text-[hsl(var(--customer-cta-contrast)/0.85)] transition hover:text-white" href="/preguntas-frecuentes#terminos">Terminos y condiciones</Link>
            <Link className="text-[hsl(var(--customer-cta-contrast)/0.85)] transition hover:text-white" href="/preguntas-frecuentes#cambios">Cambios y devoluciones</Link>
          </nav>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[hsl(var(--customer-cta-contrast)/0.80)]">Libro de</h3>
          <p className="text-2xl font-black leading-tight">Reclamaciones</p>
          <div className="inline-flex items-center gap-3 rounded-xl border border-[hsl(var(--customer-cta-contrast)/0.30)] bg-[hsl(var(--customer-cta-contrast)/0.05)] px-4 py-3">
            <BookMarked size={28} />
            <span className="text-sm text-[hsl(var(--customer-cta-contrast)/0.90)]">Plataforma oficial de atencion al consumidor</span>
          </div>
          <a href="/libro-de-reclamaciones" target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-[hsl(var(--customer-cta-contrast)/0.50)] px-4 py-2 text-sm font-semibold transition hover:bg-[hsl(var(--customer-cta-contrast))] hover:text-[hsl(var(--customer-brand-strong))]">
            Registrar reclamo
          </a>
        </section>
      </div>

      <div className="border-t border-[hsl(var(--customer-cta-contrast)/0.10)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4 text-xs text-[hsl(var(--customer-cta-contrast)/0.70)] sm:flex-row sm:items-center sm:justify-between">
          <p>{storeName}</p>
          <p>© {year} {storeName}. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
