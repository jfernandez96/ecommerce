import Link from "next/link";
import { ProductCard } from "@/components/commerce/product-card";
import { getProducts } from "@/lib/api";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const toSlug = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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

type CollectionsSearchParams = { q?: string; categoria?: string; marca?: string; talla?: string; min?: string; max?: string; orden?: string };

type PageProps = {
  searchParams?: Promise<CollectionsSearchParams>;
};

const orderOptions = [
  { value: "recent", label: "Recientes" },
  { value: "name-asc", label: "Nombre A-Z" },
  { value: "price-asc", label: "Precio menor" },
  { value: "price-desc", label: "Precio mayor" }
] as const;

const priceRanges = [
  { label: "S/ 0 - S/ 99", min: 0, max: 99 },
  { label: "S/ 100 - S/ 199", min: 100, max: 199 },
  { label: "S/ 200 - S/ 299", min: 200, max: 299 },
  { label: "S/ 300 - S/ 459", min: 300, max: 459 }
] as const;

function buildCollectionsHref(filters: CollectionsSearchParams) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.categoria) query.set("categoria", filters.categoria);
  if (filters.marca) query.set("marca", filters.marca);
  if (filters.talla) query.set("talla", filters.talla);
  if (filters.min) query.set("min", filters.min);
  if (filters.max) query.set("max", filters.max);
  if (filters.orden) query.set("orden", filters.orden);
  const queryString = query.toString();
  return queryString ? `/collections?${queryString}` : "/collections";
}

export default async function CollectionsPage({ searchParams }: PageProps) {
  const [products, resolvedSearchParams] = await Promise.all([
    getProducts(200),
    searchParams ?? Promise.resolve<CollectionsSearchParams>({})
  ]);
  const selectedCategorySlug = resolvedSearchParams?.categoria ?? "";
  const searchQuery = (resolvedSearchParams?.q ?? "").trim();
  const normalizedSearchQuery = normalize(searchQuery);
  const selectedBrandSlugs = parseSlugList(resolvedSearchParams?.marca);
  const selectedSizeSlugs = parseSlugList(resolvedSearchParams?.talla);
  const selectedMinPrice = parseAmount(resolvedSearchParams?.min);
  const selectedMaxPrice = parseAmount(resolvedSearchParams?.max);
  const selectedOrder = orderOptions.some((option) => option.value === resolvedSearchParams?.orden) ? resolvedSearchParams?.orden ?? "recent" : "recent";

  const categories = Array.from(new Set(products.map((product) => product.category.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map((category) => ({ label: category, slug: toSlug(category) }));

  const textFilteredProducts = normalizedSearchQuery
    ? products.filter((product) => {
      const searchable = `${product.name} ${product.brand} ${product.category} ${product.sku}`;
      return normalize(searchable).includes(normalizedSearchQuery);
    })
    : products;

  const categoryFilteredProducts = selectedCategorySlug
    ? textFilteredProducts.filter((product) => toSlug(product.category) === selectedCategorySlug)
    : textFilteredProducts;

  const brands = Array.from(new Set(categoryFilteredProducts.map((product) => product.brand.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));

  const brandCounts = brands.map((brand) => ({
    name: brand,
    slug: toSlug(brand),
    count: categoryFilteredProducts.filter((product) => toSlug(product.brand) === toSlug(brand)).length
  }));

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
    if (selectedOrder === "price-asc") return getEffectivePrice(a.regularPrice, a.salePrice) - getEffectivePrice(b.regularPrice, b.salePrice);
    if (selectedOrder === "price-desc") return getEffectivePrice(b.regularPrice, b.salePrice) - getEffectivePrice(a.regularPrice, a.salePrice);
    return 0;
  });

  const currentFilters: CollectionsSearchParams = {
    q: searchQuery || undefined,
    categoria: selectedCategorySlug || undefined,
    marca: serializeSlugList(selectedBrandSlugs),
    talla: serializeSlugList(selectedSizeSlugs),
    min: selectedMinPrice !== undefined ? String(selectedMinPrice) : undefined,
    max: selectedMaxPrice !== undefined ? String(selectedMaxPrice) : undefined,
    orden: selectedOrder
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 space-y-3">
        <p className="text-sm uppercase tracking-wide text-primary">Catalogo</p>
        <h1 className="text-4xl font-black">Collections</h1>
        <p className="text-foreground/65">Explora todas las prendas y accesorios con filtros por categoria, marca, talla y precio.</p>
        {searchQuery && <p className="text-sm text-foreground/70">Busqueda: <span className="font-semibold">{searchQuery}</span></p>}
      </header>

      <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-6 rounded-md border border-border bg-background p-5 lg:sticky lg:top-24 lg:h-fit">
          <details className="group border-b border-border pb-6 [&_summary::-webkit-details-marker]:hidden" open>
            <summary className="mb-3 flex cursor-pointer list-none items-center justify-between">
              <h2 className="text-2xl font-black">Categoria</h2>
              <span className="text-lg text-foreground/45 group-open:hidden">+</span>
              <span className="hidden text-lg text-foreground/45 group-open:inline">-</span>
            </summary>
            <div className="max-h-72 space-y-1 overflow-auto pr-1 text-[1.05rem]">
              <Link href={buildCollectionsHref({ ...currentFilters, categoria: undefined })} className={`block rounded px-2 py-1.5 transition ${!selectedCategorySlug ? "bg-muted font-semibold" : "text-foreground/80 hover:bg-muted"}`}>
                Todas ({textFilteredProducts.length})
              </Link>
              {categories.map((category) => {
                const count = textFilteredProducts.filter((product) => toSlug(product.category) === category.slug).length;
                const isActive = category.slug === selectedCategorySlug;
                return (
                  <Link
                    key={category.slug}
                    href={buildCollectionsHref({ ...currentFilters, categoria: category.slug })}
                    className={`block rounded px-2 py-1.5 transition ${isActive ? "bg-muted font-semibold" : "text-foreground/80 hover:bg-muted"}`}
                  >
                    {category.label} ({count})
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
              <Link href={buildCollectionsHref({ ...currentFilters, marca: undefined })} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                <span className={`inline-block h-5 w-5 rounded border border-border ${selectedBrandSlugs.length === 0 ? "bg-foreground/10" : "bg-background"}`} />
                <span className={selectedBrandSlugs.length === 0 ? "font-semibold" : "text-foreground/80"}>Todas ({categoryFilteredProducts.length})</span>
              </Link>
              {brandCounts.map((brand) => {
                const isActive = selectedBrandSlugs.includes(brand.slug);
                const nextBrandSelection = serializeSlugList(toggleSelection(selectedBrandSlugs, brand.slug));
                return (
                  <Link key={brand.slug} href={buildCollectionsHref({ ...currentFilters, marca: nextBrandSelection })} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
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
              <Link href={buildCollectionsHref({ ...currentFilters, talla: undefined })} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                <span className={`inline-block h-5 w-5 rounded border border-border ${selectedSizeSlugs.length === 0 ? "bg-foreground/10" : "bg-background"}`} />
                <span className={selectedSizeSlugs.length === 0 ? "font-semibold" : "text-foreground/80"}>Todas ({brandFilteredProducts.length})</span>
              </Link>
              {sizeCounts.map((size) => {
                const isActive = selectedSizeSlugs.includes(size.slug);
                const nextSizeSelection = serializeSlugList(toggleSelection(selectedSizeSlugs, size.slug));
                return (
                  <Link key={size.slug} href={buildCollectionsHref({ ...currentFilters, talla: nextSizeSelection })} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
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
                    <Link key={range.label} href={buildCollectionsHref({ ...currentFilters, min: String(range.min), max: String(range.max) })} className={`rounded border px-3 py-2 text-sm transition ${isActive ? "border-foreground/20 bg-muted font-semibold" : "border-border hover:bg-muted"}`}>
                      {range.label}
                    </Link>
                  );
                })}
              </div>

              <form action="/collections" method="get" className="space-y-2">
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
                  <Link href={buildCollectionsHref({ ...currentFilters, min: undefined, max: undefined })} className="rounded border border-border px-3 py-2 text-sm hover:bg-muted">Limpiar</Link>
                </div>
              </form>
            </div>
          </details>
        </aside>

        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg text-foreground/80">Hay {sortedProducts.length} resultados</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-foreground/70">Ordenar por:</span>
              <div className="inline-flex items-center rounded border border-border bg-background px-3 py-2">
                {orderOptions.map((option, index) => {
                  const href = buildCollectionsHref({ ...currentFilters, orden: option.value });
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
              No hay productos para los filtros seleccionados.
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
