import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/commerce/product-card";
import { getCategories, getProducts } from "@/lib/api";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const toSlug = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ marca?: string }>;
};

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, resolvedSearchParams, categories, products] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<{ marca?: string }>({}),
    getCategories(),
    getProducts(200)
  ]);

  const selectedCategory = categories.find((category) => category.slug === slug);
  if (!selectedCategory) notFound();

  const childCategories = categories.filter((category) => category.parentId === selectedCategory.id);
  const categoryNames = new Set([selectedCategory.name, ...childCategories.map((category) => category.name)].map((name) => normalize(name)));

  const categoryProducts = products.filter((product) => categoryNames.has(normalize(product.category)));

  const brands = Array.from(new Set(categoryProducts.map((product) => product.brand))).sort((a, b) => a.localeCompare(b));
  const selectedBrandSlug = resolvedSearchParams?.marca ?? "";

  const visibleProducts = selectedBrandSlug
    ? categoryProducts.filter((product) => toSlug(product.brand) === selectedBrandSlug)
    : categoryProducts;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 space-y-3">
        <p className="text-sm uppercase tracking-wide text-primary">Categoria</p>
        <h1 className="text-4xl font-black">{selectedCategory.name}</h1>
        <p className="text-sm text-foreground/70">{visibleProducts.length} producto(s) disponibles.</p>
      </header>

      <section className="mb-8 rounded-md border border-border p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">Marcas</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/categoria/${selectedCategory.slug}`} className={`rounded-full border px-4 py-2 text-sm transition ${!selectedBrandSlug ? "border-foreground/20 bg-foreground text-background" : "border-border hover:bg-muted"}`}>
            Todas
          </Link>
          {brands.map((brand) => {
            const brandSlug = toSlug(brand);
            const isActive = brandSlug === selectedBrandSlug;
            return (
              <Link key={brand} href={`/categoria/${selectedCategory.slug}?marca=${brandSlug}`} className={`rounded-full border px-4 py-2 text-sm transition ${isActive ? "border-foreground/20 bg-foreground text-background" : "border-border hover:bg-muted"}`}>
                {brand}
              </Link>
            );
          })}
        </div>
      </section>

      {visibleProducts.length > 0 ? (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </section>
      ) : (
        <section className="rounded-md border border-dashed border-border p-8 text-center text-foreground/65">
          No hay productos para la marca seleccionada dentro de esta categoria.
        </section>
      )}
    </main>
  );
}
