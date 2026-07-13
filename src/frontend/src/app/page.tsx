import Link from "next/link";
import { Headset, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { AnimatedReveal } from "@/components/commerce/animated-reveal";
import { HomeScrollMotion } from "@/components/commerce/home-scroll-motion";
import { ProductCard } from "@/components/commerce/product-card";
import { getBanners, getCategories, getProducts } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media-url";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default async function HomePage() {
  const [products, banners, categories] = await Promise.all([getProducts(20), getBanners(), getCategories()]);

  const now = new Date();

  const heroBanner = banners
    .filter((banner) => banner.isActive && (banner.placement === "home" || banner.placement === "home-default"))
    .filter((banner) => (!banner.startsAt || new Date(banner.startsAt) <= now) && (!banner.endsAt || new Date(banner.endsAt) >= now))
    .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;

  const heroTitle = heroBanner?.title || "Nueva coleccion";
  const heroSubtitle = heroBanner?.subtitle || "Descubre los ingresos mas recientes de la temporada.";
  const heroImage = resolveMediaUrl(heroBanner?.imageUrl || "");
  const heroHref = heroBanner?.linkUrl || "#recientes";
  const isFiestasHero = heroTitle.toLowerCase().includes("fiestas patrias");
  const heroTitleLines = heroTitle.split(/\r?\n|\s{2,}/).filter(Boolean);
  const heroTitleWords = heroTitle.trim().split(/\s+/).filter(Boolean);

  const rootCategories = categories
    .filter((category) => !category.parentId && category.isActive)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId || !category.isActive) continue;
    const current = childrenByParent.get(category.parentId) ?? [];
    current.push(category.name);
    childrenByParent.set(category.parentId, current);
  }

  const categoryCards = (rootCategories.length > 0 ? rootCategories : [
    { id: "h", name: "Hombre", slug: "hombre", isActive: true, sortOrder: 1 },
    { id: "m", name: "Mujeres", slug: "mujeres", isActive: true, sortOrder: 2 },
    { id: "z", name: "Zapatillas", slug: "zapatillas", isActive: true, sortOrder: 3 },
    { id: "a", name: "Accesorios", slug: "accesorios", isActive: true, sortOrder: 4 },
  ])
    .slice(0, 5)
    .map((category) => {
      const terms = [category.name, ...(childrenByParent.get(category.id) ?? [])].map(normalize);
      const productImage = products.find((product) => terms.some((term) => normalize(product.category) === term || normalize(product.name).includes(term)))?.imageUrl;

      return {
        id: category.id,
        name: category.name,
        href: `/seccion/${category.slug}`,
        imageUrl: resolveMediaUrl(productImage ?? ""),
      };
    });

  const benefits = [
    { id: "shipping", title: "Envio gratis", description: "En compras mayores a S/199", icon: Truck },
    { id: "secure", title: "Compra segura", description: "Tus datos protegidos", icon: ShieldCheck },
    { id: "returns", title: "Cambios faciles", description: "Hasta 30 dias", icon: RotateCcw },
    { id: "support", title: "Atencion 24/7", description: "Estamos para ayudarte", icon: Headset },
  ] as const;

  const recentProducts = products.slice(0, 8);

  return (
    <HomeScrollMotion>
      <main className="overflow-x-hidden bg-[#F5F5F6] pb-14">
        <section className="relative overflow-hidden bg-transparent">
          <div className="relative min-h-[620px] overflow-hidden">
            {heroImage ? (
              <img src={heroImage} alt={heroTitle} className="absolute inset-0 h-full w-full object-cover object-center" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#EFEFF1] via-[#F9F9FB] to-[#EDEDF0]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/48 to-white/8" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/12 via-transparent to-transparent" />

            <div className="absolute inset-y-0 left-0 z-10 flex max-w-[620px] items-center px-7 py-8 sm:px-12">
              <AnimatedReveal className="space-y-4 text-[#151923]" delay={0.05} y={18}>
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#CF4A43]">
                  Celebra con estilo
                  <span className="h-px w-16 bg-[#CF4A43]/35" />
                </p>
                {isFiestasHero ? (
                  <h1 className="text-balance font-serif text-6xl font-black leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl">
                    {heroTitleLines.length > 1 ? (
                      heroTitleLines.map((line, index) => (
                        <span key={`${line}-${index}`} className={index === heroTitleLines.length - 1 ? "text-[#CC4A46]" : "text-[#121212]"}>
                          {line}
                          {index < heroTitleLines.length - 1 ? <br /> : null}
                        </span>
                      ))
                    ) : heroTitleWords.length >= 2 ? (
                      <>
                        <span className="text-[#121212]">{heroTitleWords.slice(0, -1).join(" ")}</span>
                        <br />
                        <span className="text-[#CC4A46]">{heroTitleWords.at(-1)}</span>
                      </>
                    ) : (
                      <span className="text-[#CC4A46]">{heroTitle}</span>
                    )}
                  </h1>
                ) : (
                  <h1 className="text-balance text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">{heroTitle}</h1>
                )}
                <p className="max-w-sm text-base leading-relaxed text-[#2D333B]/85 sm:text-lg">{heroSubtitle}</p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link href={heroHref} className="inline-flex h-11 items-center rounded-full bg-[#141920] px-7 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:bg-[#0C1118]">
                    Comprar ahora
                  </Link>
                  <Link href="/promociones" className="inline-flex h-11 items-center rounded-full border border-[#AFB5C0] bg-white px-7 text-sm font-semibold uppercase tracking-[0.08em] text-[#222B36] transition hover:-translate-y-0.5 hover:bg-[#F7F9FC]">
                    Ver ofertas
                  </Link>
                </div>
              </AnimatedReveal>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1700px] space-y-6 px-4 pt-4 lg:pt-5">

          <section className="bg-transparent px-1 py-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div key={benefit.id} className="flex items-center gap-3 border-[#E8E8ED] md:[&:not(:last-child)]:border-r md:pr-4">
                    <div className="grid h-10 w-10 place-items-center bg-[#F3F4F7] text-[#1B2431]">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1A2230]">{benefit.title}</p>
                      <p className="text-xs text-[#6A7482]">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-transparent px-1 py-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[30px] font-black text-[#1A2230]">Categorias destacadas</h2>
              <Link href="/collections" className="text-sm font-semibold text-[#CF4A43] transition hover:opacity-80">Ver todas</Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {categoryCards.map((category) => (
                <Link key={category.id} href={category.href} className="group overflow-hidden bg-transparent transition hover:-translate-y-0.5">
                  <div className="relative h-28 w-full overflow-hidden bg-[#EEF0F5]">
                    {category.imageUrl ? (
                      <img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-[#E9ECF2] to-[#F7F8FB]" />
                    )}
                  </div>
                  <div className="space-y-1 px-3 py-3">
                    <p className="text-sm font-bold text-[#1B2431]">{category.name}</p>
                    <p className="text-xs font-semibold text-[#596473]">Ver todo →</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section id="recientes" className="bg-transparent px-1 py-6">
            <AnimatedReveal className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" delay={0.06} y={14}>
              <div>
                <p className="text-sm uppercase tracking-[0.12em] text-[#6A7482]">Ropa más reciente</p>
                <h2 className="text-[30px] font-black text-[#1A2230]">Ultimos ingresos</h2>
              </div>
              <Link href="/collections" className="inline-flex h-10 items-center justify-center rounded-full border border-[#D2D8E1] px-5 text-sm font-semibold text-[#1B2431] transition hover:-translate-y-0.5 hover:bg-[#F3F5F8]">
                Ver todo
              </Link>
            </AnimatedReveal>
            {recentProducts.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {recentProducts.map((product, index) => (
                  <AnimatedReveal key={product.id} delay={0.08 + index * 0.05} y={18}>
                    <ProductCard product={product} flat />
                  </AnimatedReveal>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[#D8DDE6] p-8 text-center text-[#6A7482]">Registra productos desde el panel admin para verlos aqui.</div>
            )}
          </section>
        </div>
      </main>
    </HomeScrollMotion>
  );
}