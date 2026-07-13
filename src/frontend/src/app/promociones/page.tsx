import { ProductCard } from "@/components/commerce/product-card";
import { getBrands, getCategories, getProducts, getPromotions } from "@/lib/api";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default async function PromotionsPage() {
  const [products, promotions, categories, brands] = await Promise.all([getProducts(200), getPromotions(), getCategories(), getBrands()]);

  const now = new Date();
  const activePromotions = promotions.filter((promotion) => promotion.isActive && new Date(promotion.startsAt) <= now && new Date(promotion.endsAt) >= now);

  const categoryNameById = new Map(categories.map((category) => [category.id, normalize(category.name)]));
  const brandNameById = new Map(brands.map((brand) => [brand.id, normalize(brand.name)]));

  const promotedProducts = products.filter((product) => {
    const productCategory = normalize(product.category);
    const productBrand = normalize(product.brand);

    return activePromotions.some((promotion) => {
      if (promotion.productId && promotion.productId === product.id) return true;
      if (!promotion.productId && promotion.categoryId) return categoryNameById.get(promotion.categoryId) === productCategory;
      if (!promotion.productId && !promotion.categoryId && promotion.brandId) return brandNameById.get(promotion.brandId) === productBrand;
      return !promotion.productId && !promotion.categoryId && !promotion.brandId;
    });
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 space-y-3">
        <p className="text-sm uppercase tracking-wide text-primary">Promociones</p>
        <h1 className="text-4xl font-black">Productos en promoción</h1>
        <p className="text-sm text-foreground/70">{promotedProducts.length} producto(s) promocionados actualmente.</p>
      </header>

      {promotedProducts.length > 0 ? (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {promotedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </section>
      ) : (
        <section className="rounded-md border border-dashed border-border p-8 text-center text-foreground/65">
          No hay promociones activas por ahora.
        </section>
      )}
    </main>
  );
}
