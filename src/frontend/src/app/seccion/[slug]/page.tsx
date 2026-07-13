import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/commerce/product-card";
import { getCategories, getProducts } from "@/lib/api";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const toSlug = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const formatBrand = (value: string) => value.trim();
const getEffectivePrice = (regularPrice: number, salePrice?: number) => salePrice ?? regularPrice;
const parseSlugList = (value?: string) => (value ?? "").split(",").map((item) => item.trim()).filter((item) => item.length > 0);
const serializeSlugList = (values: string[]) => {
  const unique = Array.from(new Set(values));
  return unique.length > 0 ? unique.join(",") : undefined;
};
const toggleSelection = (selected: string[], value: string) => (selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
const getProductSizes = (product: { size?: string; sizesCsv?: string }) => {
  const sizesFromCsv = (product.sizesCsv ?? "")
    .split(",")
    .map((size) => size.trim())
    .filter((size) => size.length > 0);

  if (sizesFromCsv.length > 0) return Array.from(new Set(sizesFromCsv));

  const fallbackSize = (product.size ?? "").trim();
  return fallbackSize ? [fallbackSize] : [];
};
const parseAmount = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
};

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ categoria?: string; marca?: string; talla?: string; min?: string; max?: string; orden?: string }>;
};

type SectionSearchParams = { categoria?: string; marca?: string; talla?: string; min?: string; max?: string; orden?: string };

const orderOptions = [
  { value: "recent", label: "Fecha: reciente a antiguo(a)" },
  { value: "name-asc", label: "Nombre: A-Z" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" }
] as const;

const priceRanges = [
  { label: "S/ 0 - S/ 99", min: 0, max: 99 },
  { label: "S/ 100 - S/ 199", min: 100, max: 199 },
  { label: "S/ 200 - S/ 299", min: 200, max: 299 },
  { label: "S/ 300 - S/ 459", min: 300, max: 459 }
] as const;

function buildSectionHref(slug: string, filters: SectionSearchParams) {
  const query = new URLSearchParams();
  if (filters.categoria) query.set("categoria", filters.categoria);
  if (filters.marca) query.set("marca", filters.marca);
  if (filters.talla) query.set("talla", filters.talla);
  if (filters.min) query.set("min", filters.min);
  if (filters.max) query.set("max", filters.max);
  if (filters.orden) query.set("orden", filters.orden);
  const queryString = query.toString();
  return queryString ? `/seccion/${slug}?${queryString}` : `/seccion/${slug}`;
}

export default async function SectionPage({ params, searchParams }: PageProps) {
  const [{ slug }, categories, products] = await Promise.all([params, getCategories(), getProducts(200)]);
  const resolvedSearchParams: SectionSearchParams = searchParams ? await searchParams : {};

  const section = categories.find((category) => !category.parentId && category.slug === slug && category.isActive);
  if (!section) notFound();

  const subcategories = categories.filter((category) => category.parentId === section.id && category.isActive);

  const selectedSubcategorySlug = resolvedSearchParams?.categoria ?? "";
  const selectedSubcategory = subcategories.find((category) => category.slug === selectedSubcategorySlug);
  const selectedBrandSlugs = parseSlugList(resolvedSearchParams?.marca);
  const selectedSizeSlugs = parseSlugList(resolvedSearchParams?.talla);
  const selectedMinPrice = parseAmount(resolvedSearchParams?.min);
  const selectedMaxPrice = parseAmount(resolvedSearchParams?.max);
  const selectedOrder = orderOptions.some((option) => option.value === resolvedSearchParams?.orden) ? resolvedSearchParams?.orden ?? "recent" : "recent";

  const sectionProducts = products.filter((product) => {
    const productCategory = normalize(product.category);
    const belongsToSubcategory = subcategories.some((category) => normalize(category.name) === productCategory);
    const belongsToRoot = normalize(section.name) === productCategory;
    return belongsToSubcategory || belongsToRoot;
  });

  const subcategoryCounts = subcategories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    count: sectionProducts.filter((product) => normalize(product.category) === normalize(category.name)).length
  }));

  const categoryFilteredProducts = selectedSubcategory
    ? sectionProducts.filter((product) => normalize(product.category) === normalize(selectedSubcategory.name))
    : sectionProducts;

  const brands = Array.from(new Set(categoryFilteredProducts.map((product) => formatBrand(product.brand)))).sort((a, b) => a.localeCompare(b));

  const brandFilteredProducts = selectedBrandSlugs.length > 0
    ? categoryFilteredProducts.filter((product) => selectedBrandSlugs.includes(toSlug(product.brand)))
    : categoryFilteredProducts;

  const sizeCounts = Array.from(new Set(categoryFilteredProducts.flatMap((product) => getProductSizes(product))))
    .map((size) => ({
      label: size,
      slug: toSlug(size),
      count: categoryFilteredProducts.filter((product) => getProductSizes(product).some((productSize) => toSlug(productSize) === toSlug(size))).length
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const sizeFilteredProducts = selectedSizeSlugs.length > 0
    ? brandFilteredProducts.filter((product) => getProductSizes(product).some((size) => selectedSizeSlugs.includes(toSlug(size))))
    : brandFilteredProducts;

  const visibleProducts = sizeFilteredProducts.filter((product) => {
    const price = getEffectivePrice(product.regularPrice, product.salePrice);
    if (selectedMinPrice !== undefined && price < selectedMinPrice) return false;
    if (selectedMaxPrice !== undefined && price > selectedMaxPrice) return false;
    return true;
  });

  const sortedProducts = [...visibleProducts].sort((a, b) => {
    if (selectedOrder === "name-asc") return a.name.localeCompare(b.name);
    if (selectedOrder === "price-asc") return (a.salePrice ?? a.regularPrice) - (b.salePrice ?? b.regularPrice);
    if (selectedOrder === "price-desc") return (b.salePrice ?? b.regularPrice) - (a.salePrice ?? a.regularPrice);
    return 0;
  });

  const brandCounts = brands
    .map((brand) => ({
      name: brand,
      slug: toSlug(brand),
      count: categoryFilteredProducts.filter((product) => toSlug(product.brand) === toSlug(brand)).length
    }))
    .filter((brand) => brand.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const currentFilters: SectionSearchParams = {
    categoria: selectedSubcategorySlug || undefined,
    marca: serializeSlugList(selectedBrandSlugs),
    talla: serializeSlugList(selectedSizeSlugs),
    min: selectedMinPrice !== undefined ? String(selectedMinPrice) : undefined,
    max: selectedMaxPrice !== undefined ? String(selectedMaxPrice) : undefined,
    orden: selectedOrder
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 space-y-3">
        <p className="text-sm uppercase tracking-wide text-primary">Seccion</p>
        <h1 className="text-4xl font-black">{section.name}</h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-6 rounded-md border border-border bg-background p-5 lg:sticky lg:top-24 lg:h-fit">
          <details className="group border-b border-border pb-6 [&_summary::-webkit-details-marker]:hidden" open>
            <summary className="mb-3 flex cursor-pointer list-none items-center justify-between">
              <h2 className="text-2xl font-black">Categorias</h2>
              <span className="text-lg text-foreground/45 group-open:hidden">+</span>
              <span className="hidden text-lg text-foreground/45 group-open:inline">-</span>
            </summary>
            <div className="max-h-72 space-y-1 overflow-auto pr-1 text-[1.05rem]">
              <Link href={buildSectionHref(slug, { ...currentFilters, categoria: undefined })} className={`block rounded px-2 py-1.5 transition ${!selectedSubcategorySlug ? "bg-muted font-semibold" : "text-foreground/80 hover:bg-muted"}`}>
                Todas ({sectionProducts.length})
              </Link>
              {subcategoryCounts.map((category) => {
                const isActive = category.slug === selectedSubcategorySlug;
                return (
                  <Link
                    key={category.id}
                    href={buildSectionHref(slug, { ...currentFilters, categoria: category.slug })}
                    className={`block rounded px-2 py-1.5 transition ${isActive ? "bg-muted font-semibold" : "text-foreground/80 hover:bg-muted"}`}
                  >
                    {category.name} ({category.count})
                  </Link>
                );
              })}
            </div>
          </details>

          <details className="group border-b border-border pb-6 [&_summary::-webkit-details-marker]:hidden" open>
            <summary className="mb-3 flex cursor-pointer list-none items-center justify-between">
              <h2 className="text-2xl font-black">Marca</h2>
              <span className="text-lg text-foreground/45 group-open:hidden">+</span>
              <span className="hidden text-lg text-foreground/45 group-open:inline">-</span>
            </summary>
            <div className="max-h-72 space-y-2 overflow-auto pr-1 text-[1.05rem]">
              <Link href={buildSectionHref(slug, { ...currentFilters, marca: undefined })} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                <span className={`inline-block h-5 w-5 rounded border border-border ${selectedBrandSlugs.length === 0 ? "bg-foreground/10" : "bg-background"}`} />
                <span className={selectedBrandSlugs.length === 0 ? "font-semibold" : "text-foreground/80"}>Todas ({categoryFilteredProducts.length})</span>
              </Link>
              {brandCounts.map((brand) => {
                const isActive = selectedBrandSlugs.includes(brand.slug);
                const nextBrandSelection = serializeSlugList(toggleSelection(selectedBrandSlugs, brand.slug));
                return (
                  <Link key={brand.slug} href={buildSectionHref(slug, { ...currentFilters, marca: nextBrandSelection })} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                    <span className={`inline-block h-5 w-5 rounded border border-border ${isActive ? "bg-foreground/10" : "bg-background"}`} />
                    <span className={isActive ? "font-semibold" : "text-foreground/80"}>{brand.name} ({brand.count})</span>
                  </Link>
                );
              })}
            </div>
          </details>

          <details className="group border-b border-border pb-6 [&_summary::-webkit-details-marker]:hidden" open>
            <summary className="mb-3 flex cursor-pointer list-none items-center justify-between">
              <h2 className="text-2xl font-black">Talla</h2>
              <span className="text-lg text-foreground/45 group-open:hidden">+</span>
              <span className="hidden text-lg text-foreground/45 group-open:inline">-</span>
            </summary>
            <div className="max-h-72 space-y-2 overflow-auto pr-1 text-[1.05rem]">
              <Link href={buildSectionHref(slug, { ...currentFilters, talla: undefined })} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                <span className={`inline-block h-5 w-5 rounded border border-border ${selectedSizeSlugs.length === 0 ? "bg-foreground/10" : "bg-background"}`} />
                <span className={selectedSizeSlugs.length === 0 ? "font-semibold" : "text-foreground/80"}>Todas ({brandFilteredProducts.length})</span>
              </Link>
              {sizeCounts.map((size) => {
                const isActive = selectedSizeSlugs.includes(size.slug);
                const nextSizeSelection = serializeSlugList(toggleSelection(selectedSizeSlugs, size.slug));
                return (
                  <Link key={size.slug} href={buildSectionHref(slug, { ...currentFilters, talla: nextSizeSelection })} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                    <span className={`inline-block h-5 w-5 rounded border border-border ${isActive ? "bg-foreground/10" : "bg-background"}`} />
                    <span className={isActive ? "font-semibold" : "text-foreground/80"}>{size.label} ({size.count})</span>
                  </Link>
                );
              })}
            </div>
          </details>

          <details className="group [&_summary::-webkit-details-marker]:hidden" open>
            <summary className="mb-3 flex cursor-pointer list-none items-center justify-between">
              <h2 className="text-2xl font-black">Precio</h2>
              <span className="text-lg text-foreground/45 group-open:hidden">+</span>
              <span className="hidden text-lg text-foreground/45 group-open:inline">-</span>
            </summary>

            <div className="space-y-3">
              <div className="grid gap-2">
                {priceRanges.map((range) => {
                  const isActive = selectedMinPrice === range.min && selectedMaxPrice === range.max;
                  return (
                    <Link key={range.label} href={buildSectionHref(slug, { ...currentFilters, min: String(range.min), max: String(range.max) })} className={`rounded border px-3 py-2 text-sm transition ${isActive ? "border-foreground/20 bg-muted font-semibold" : "border-border hover:bg-muted"}`}>
                      {range.label}
                    </Link>
                  );
                })}
              </div>

              <form action={`/seccion/${slug}`} method="get" className="space-y-2">
                {currentFilters.categoria && <input type="hidden" name="categoria" value={currentFilters.categoria} />}
                {currentFilters.marca && <input type="hidden" name="marca" value={currentFilters.marca} />}
                {currentFilters.talla && <input type="hidden" name="talla" value={currentFilters.talla} />}
                {currentFilters.orden && <input type="hidden" name="orden" value={currentFilters.orden} />}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <input type="number" min={0} name="min" defaultValue={selectedMinPrice ?? ""} className="min-w-0 w-full rounded border border-border bg-background p-2 text-sm" placeholder="Min" />
                  <span className="text-center text-foreground/60">-</span>
                  <input type="number" min={0} name="max" defaultValue={selectedMaxPrice ?? ""} className="min-w-0 w-full rounded border border-border bg-background p-2 text-sm" placeholder="Max" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="rounded border border-border px-3 py-2 text-sm hover:bg-muted">Aplicar</button>
                  <Link href={buildSectionHref(slug, { ...currentFilters, min: undefined, max: undefined })} className="rounded border border-border px-3 py-2 text-sm hover:bg-muted">Limpiar</Link>
                </div>
              </form>
            </div>
          </details>
        </aside>

        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg text-foreground/80">Hay {sortedProducts.length} resultados en total</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-foreground/70">Ordenar por:</span>
              <div className="inline-flex items-center rounded border border-border bg-background px-3 py-2">
                {orderOptions.map((option, index) => {
                  const href = buildSectionHref(slug, { ...currentFilters, orden: option.value });
                  const isActive = option.value === selectedOrder;
                  return (
                    <span key={option.value} className="inline-flex items-center">
                      <Link href={href} className={isActive ? "font-semibold" : "text-foreground/75 hover:text-foreground"}>{option.label}</Link>
                      {index < orderOptions.length - 1 && <span className="mx-2 text-foreground/30">|</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {sortedProducts.length > 0 ? (
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {sortedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </section>
          ) : (
            <section className="rounded-md border border-dashed border-border p-8 text-center text-foreground/65">
              No hay productos para los filtros seleccionados en esta seccion.
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
